import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface GenerationResult {
  imageBase64: string;
  thumbnailBase64: string;
}

function extractColorPalette(tokens: Record<string, any> | undefined): string[] {
  if (!tokens || !tokens.color) return [];
  const colors: string[] = [];
  for (const [name, token] of Object.entries(tokens.color)) {
    if (token && typeof token === "object" && "$value" in token) {
      const value = String((token as any).$value);
      if (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl") || value.startsWith("oklch")) {
        colors.push(`${name}: ${value}`);
      }
    }
  }
  return colors.slice(0, 8);
}

export async function generateStyledImage(
  prompt: string,
  styleName: string,
  styleDescription: string,
  promptScaffolding: { base: string; modifiers: string[]; negative: string },
  tokens?: Record<string, any>
): Promise<GenerationResult> {
  try {
    const colorPalette = extractColorPalette(tokens);
    const hasTokenColors = colorPalette.length > 0;
    
    const tokenSection = hasTokenColors
      ? `================================================================================
PRIMARY DIRECTIVE: DESIGN TOKENS (HIGHEST PRIORITY)
================================================================================
The following Design Tokens were extracted from the source image. These are AUTHORITATIVE specifications:

MANDATORY COLOR PALETTE - Use ONLY these exact hex values:
${colorPalette.map(c => `  ${c} (EXACT - no substitution)`).join("\n")}

ALL major color areas in the image MUST use these exact hex values. Do NOT substitute with similar colors.

================================================================================
SECONDARY: STYLE CONTEXT (Use to Inform Technique)
================================================================================
`
      : "";

    const fullPrompt = `Generate an image for the "${styleName}" style.

${tokenSection}Style Description: ${styleDescription}
Style Base: ${promptScaffolding.base}
Style Modifiers: ${promptScaffolding.modifiers.join(", ")}

================================================================================
USER REQUEST
================================================================================
Concept: ${prompt}

Create a high-quality image that applies the style to the user's concept.${hasTokenColors ? " The image MUST use the exact Design Token colors listed above." : ""} Maintain the style's color palette, mood, lighting, and aesthetic characteristics.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
        },
      ],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    let imageBase64 = "";
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if ("inlineData" in part && part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            break;
          }
        }
      }
    }

    if (!imageBase64) {
      throw new Error("No image generated from AI");
    }

    const thumbnailBase64 = imageBase64;

    return {
      imageBase64,
      thumbnailBase64,
    };
  } catch (error) {
    console.error("Error generating styled image:", error);
    throw error;
  }
}
