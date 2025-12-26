import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface RemixRequest {
  styleIds: string[];
  weights?: number[];
  name?: string;
}

export interface RemixResult {
  name: string;
  description: string;
  tokens: Record<string, any>;
  promptScaffolding: {
    base: string;
    modifiers: string[];
    negative: string;
  };
  sourceStyles: { id: string; name: string; weight: number }[];
}

function extractTokenSummary(tokens: Record<string, any>): string {
  const summary: string[] = [];
  
  function traverse(obj: any, path: string = "") {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value && typeof value === "object") {
        if ("$type" in value && "$value" in value) {
          summary.push(`${path}${key}: ${value.$type} = ${JSON.stringify(value.$value)}`);
        } else {
          traverse(value, `${path}${key}.`);
        }
      }
    }
  }
  
  traverse(tokens);
  return summary.slice(0, 50).join("\n");
}

export async function remixStyles(request: RemixRequest): Promise<RemixResult> {
  const { styleIds, weights, name } = request;
  
  if (styleIds.length < 2 || styleIds.length > 4) {
    throw new Error("Please select 2-4 styles to remix");
  }
  
  const styles = await Promise.all(
    styleIds.map(id => storage.getStyleById(id))
  );
  
  const validStyles = styles.filter((s) => s !== undefined && s !== null);
  if (validStyles.length < 2) {
    throw new Error("Could not find enough valid styles to remix");
  }
  
  const normalizedWeights = weights && weights.length === validStyles.length
    ? weights.map(w => w / weights.reduce((a, b) => a + b, 0))
    : validStyles.map(() => 1 / validStyles.length);
  
  const styleDescriptions = validStyles.map((style, i) => {
    const weight = Math.round(normalizedWeights[i] * 100);
    const tokens = style.tokens as Record<string, any>;
    const scaffolding = style.promptScaffolding as { base?: string; modifiers?: string[] } | null;
    const tokenSummary = extractTokenSummary(tokens || {});
    return `
STYLE ${i + 1}: "${style.name}" (Weight: ${weight}%)
Description: ${style.description}
Prompt Base: ${scaffolding?.base || "N/A"}
Modifiers: ${scaffolding?.modifiers?.join(", ") || "N/A"}
Tokens:
${tokenSummary}
`;
  }).join("\n---\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a design token expert. Blend these ${validStyles.length} styles into a new cohesive style that combines their best qualities proportionally to their weights.

${styleDescriptions}

Create a NEW unified style that intelligently blends these sources. Consider:
- Blend colors proportionally (weighted average in OKLCH space conceptually)
- Merge typography characteristics
- Combine mood and aesthetic qualities
- Create a unified prompt scaffold that captures the essence of all sources

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "name": "${name || 'A creative 2-4 word name for this blended style'}",
  "description": "A poetic 1-2 sentence description of the new blended aesthetic",
  "tokens": {
    "color": {
      "primary": { "$type": "color", "$value": "#hexcolor", "$description": "Blended primary color" },
      "secondary": { "$type": "color", "$value": "#hexcolor", "$description": "Blended secondary color" },
      "accent": { "$type": "color", "$value": "#hexcolor", "$description": "Blended accent color" },
      "background": { "$type": "color", "$value": "#hexcolor", "$description": "Blended background color" },
      "surface": { "$type": "color", "$value": "#hexcolor", "$description": "Blended surface color" }
    },
    "typography": {
      "fontFamily": { "$type": "fontFamily", "$value": "font name", "$description": "Blended typography choice" },
      "scale": { "$type": "number", "$value": 1.2, "$description": "Type scale ratio" }
    },
    "spacing": {
      "unit": { "$type": "dimension", "$value": "8px", "$description": "Base spacing unit" }
    },
    "effects": {
      "borderRadius": { "$type": "dimension", "$value": "8px", "$description": "Corner radius" },
      "shadow": { "$type": "shadow", "$value": "0 2px 8px rgba(0,0,0,0.1)", "$description": "Blended shadow style" }
    }
  },
  "promptScaffolding": {
    "base": "A detailed base prompt that captures the blended style essence (50-100 words)",
    "modifiers": ["modifier1", "modifier2", "modifier3", "modifier4"],
    "negative": "Negative prompt to avoid unwanted elements"
  }
}`,
          },
        ],
      },
    ],
  });

  let responseText = "";
  const candidates = response.candidates;
  if (candidates && candidates.length > 0) {
    const parts = candidates[0]?.content?.parts;
    if (parts && parts.length > 0) {
      for (const part of parts) {
        if ("text" in part && typeof part.text === "string") {
          responseText = part.text;
          break;
        }
      }
    }
  }

  if (!responseText) {
    throw new Error("No response from AI model");
  }

  let cleanedText = responseText.trim();
  if (cleanedText.startsWith("```json")) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith("```")) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error("Failed to parse AI response:", cleanedText.slice(0, 500));
    throw new Error("AI generated an invalid response. Please try again.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response was empty or invalid. Please try again.");
  }

  const defaultTokens = {
    color: {
      primary: { $type: "color", $value: "#2A2A2A", $description: "Primary color" },
      secondary: { $type: "color", $value: "#6B5B4D", $description: "Secondary color" },
      accent: { $type: "color", $value: "#FF4D4D", $description: "Accent color" },
      background: { $type: "color", $value: "#F5F5F5", $description: "Background color" },
      surface: { $type: "color", $value: "#FFFFFF", $description: "Surface color" },
    },
  };

  return {
    name: parsed.name || name || "Remixed Style",
    description: parsed.description || "A blended style combining multiple sources",
    tokens: parsed.tokens || defaultTokens,
    promptScaffolding: parsed.promptScaffolding || {
      base: "A blended visual style",
      modifiers: [],
      negative: "",
    },
    sourceStyles: validStyles.map((s, i) => ({
      id: s!.id,
      name: s!.name,
      weight: normalizedWeights[i],
    })),
  };
}
