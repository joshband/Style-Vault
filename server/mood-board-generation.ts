import { GoogleGenAI } from "@google/genai";
import type { MetadataTags, MoodBoardAssets, UiConceptAssets } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

interface TokenSummary {
  colors: { name: string; hex: string }[];
  typography: { serif: string; sans: string; mono: string };
  texture: { grain: string; finish: string };
  lighting: { type: string; direction: string; intensity: string };
  mood: { tone: string; saturation: string; contrast: string };
}

interface MoodBoardRequest {
  styleName: string;
  styleDescription: string;
  tokens: Record<string, any>;
  metadataTags: MetadataTags;
  referenceImageBase64?: string;
}

function extractTokenSummary(tokens: Record<string, any>): TokenSummary {
  const color = tokens.color || {};
  const typography = tokens.typography || {};
  const texture = tokens.texture || {};
  const lighting = tokens.lighting || {};
  const mood = tokens.mood || {};

  const colors: { name: string; hex: string }[] = [];
  for (const [name, token] of Object.entries(color)) {
    if (token && typeof token === "object" && "$value" in token) {
      colors.push({ name, hex: String((token as any).$value) });
    }
  }

  const fontFamily = typography.fontFamily || {};

  return {
    colors: colors.slice(0, 6),
    typography: {
      serif: fontFamily.serif?.$value || "Georgia",
      sans: fontFamily.sans?.$value || "Arial",
      mono: fontFamily.mono?.$value || "Courier",
    },
    texture: {
      grain: texture.grain?.$value || "subtle",
      finish: texture.finish?.$value || "matte",
    },
    lighting: {
      type: lighting.type?.$value || "natural",
      direction: lighting.direction?.$value || "diffuse",
      intensity: lighting.intensity?.$value || "medium",
    },
    mood: {
      tone: mood.tone?.$value || "neutral",
      saturation: String(mood.saturation?.$value || 0.5),
      contrast: String(mood.contrast?.$value || 0.5),
    },
  };
}

function buildMoodBoardPrompt(request: MoodBoardRequest, summary: TokenSummary): string {
  const { styleName, styleDescription, metadataTags } = request;

  const colorList = summary.colors.map((c) => `${c.name}: ${c.hex}`).join(", ");
  const moodKeywords = metadataTags.mood.slice(0, 4).join(", ") || "refined, artistic";
  const eraKeywords = metadataTags.era.slice(0, 2).join(", ") || "contemporary";
  const textureKeywords = metadataTags.texture.slice(0, 3).join(", ") || summary.texture.finish;
  const lightingKeywords = metadataTags.lighting.slice(0, 2).join(", ") || summary.lighting.type;
  const mediumKeywords = metadataTags.medium.slice(0, 2).join(", ") || "digital";

  return `Create a stunning, high-fidelity mood board collage that perfectly captures the visual essence of "${styleName}".

STYLE ESSENCE: ${styleDescription}

LAYOUT: A sophisticated Pinterest-style grid collage with varied tile sizes in a 3:4 portrait aspect ratio. Include 8-12 tiles arranged asymmetrically with thin gaps.

CRITICAL COLOR PALETTE - USE THESE EXACT COLORS:
${summary.colors.map((c) => `- ${c.name}: ${c.hex}`).join("\n")}

REQUIRED ELEMENTS (each should deeply reflect the style's aesthetic):
1. COLOR PALETTE STRIP: A horizontal strip of color swatches matching: ${colorList}
2. HERO TYPOGRAPHY: Large display text with style keywords "${moodKeywords.toUpperCase()}" - the typography itself should LOOK like the style (aged, modern, painterly, etc.)
3. TEXTURE SAMPLES: 2-3 tiles showing abstract textures that match "${textureKeywords}" - these should feel authentic to the style's visual language
4. ARTISTIC REFERENCE TILES: 2-3 tiles with abstract patterns/paintings that capture the movement/era: ${eraKeywords}. Use brushstrokes, gradients, or patterns that embody the style.
5. EVOCATIVE OBJECTS: 1-2 tiles showing objects that represent the style's world - could be vintage equipment, natural elements, architectural details
6. ATMOSPHERE: Ensure the overall lighting feels like "${lightingKeywords}" - warm, cool, dramatic, or soft accordingly

VISUAL COHERENCE RULES:
- Every element should feel like it belongs to the same visual universe
- The texture of paper/surfaces should match the style's era: ${eraKeywords}
- Colors should be rich and accurate to the palette provided
- Medium should feel like: ${mediumKeywords}
- Mood should evoke: ${moodKeywords}

Make this feel like a premium design agency's style exploration - editorial, refined, and deeply evocative of the visual direction.`;
}

function buildUiConceptPrompt(
  request: MoodBoardRequest,
  summary: TokenSummary,
  conceptType: "audioPlugin" | "dashboard"
): string {
  const { styleName, styleDescription, metadataTags } = request;
  const colorList = summary.colors.map((c) => `${c.name}: ${c.hex}`).join(", ");
  const moodKeywords = metadataTags.mood.slice(0, 4).join(", ") || "refined, artistic";
  const textureKeywords = metadataTags.texture.slice(0, 3).join(", ") || summary.texture.finish;
  const lightingKeywords = metadataTags.lighting.slice(0, 2).join(", ") || summary.lighting.type;
  const eraKeywords = metadataTags.era.slice(0, 2).join(", ") || "contemporary";

  const conceptPrompts = {
    audioPlugin: `Create a stunning, photorealistic UI mockup of a professional audio plugin/synthesizer interface that FULLY embodies the "${styleName}" visual style.

STYLE TO CAPTURE: ${styleDescription}

CRITICAL - This interface must LOOK and FEEL like ${styleName}:
- Every surface, knob, and element should have textures matching: ${textureKeywords}
- Lighting should feel: ${lightingKeywords}
- Overall mood should be: ${moodKeywords}
- Visual era/aesthetic: ${eraKeywords}

COLOR PALETTE - USE THESE EXACT COLORS:
${summary.colors.map((c) => `- ${c.name}: ${c.hex}`).join("\n")}

LAYOUT: A 16:9 landscape interface.

REQUIRED UI ELEMENTS (styled to match the aesthetic):
- 3-4 large circular knobs with tactile textures matching the style
- A waveform/oscilloscope display using the color palette
- Grid of buttons or sequencer pads 
- Sliders and faders
- VU meters or level indicators
- Plugin name header

VISUAL TREATMENT:
- Surfaces should have the texture of: ${textureKeywords}
- Lighting should create: ${lightingKeywords} effects on the 3D elements
- The whole interface should feel like it belongs in the world of ${styleName}
- Every detail from shadows to highlights should reinforce the style

Make this look like a premium, production-ready plugin that a designer would be proud to showcase.`,

    dashboard: `Create a stunning, high-fidelity UI mockup of a modern data dashboard that FULLY embodies the "${styleName}" visual style.

STYLE TO CAPTURE: ${styleDescription}

CRITICAL - This dashboard must LOOK and FEEL like ${styleName}:
- Every panel, card, and element should reflect: ${textureKeywords}
- Lighting/atmosphere should feel: ${lightingKeywords}
- Overall mood should be: ${moodKeywords}
- Visual era/aesthetic: ${eraKeywords}

COLOR PALETTE - USE THESE EXACT COLORS:
${summary.colors.map((c) => `- ${c.name}: ${c.hex}`).join("\n")}

LAYOUT: A 16:9 landscape dashboard.

REQUIRED UI ELEMENTS (each styled to match the aesthetic):
- Sidebar navigation with icons
- 2-3 data visualization panels (charts/graphs using the palette colors)
- Metric cards with KPIs
- Header bar with title
- Tables or list components
- Progress indicators

VISUAL TREATMENT:
- Card surfaces should have texture: ${textureKeywords}
- Charts should use the exact color palette provided
- Shadows and depth should feel like: ${lightingKeywords}
- Typography should feel appropriate for: ${eraKeywords}
- The entire interface should be cohesive with the style's visual language

This should look like a real, polished application that demonstrates how ${styleName} translates into functional UI.`,
  };

  return conceptPrompts[conceptType];
}

function extractImageFromResponse(response: any): string | null {
  if (!response?.candidates?.[0]?.content?.parts) {
    return null;
  }
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData?.mimeType?.startsWith("image/")) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export async function generateMoodBoardCollage(
  request: MoodBoardRequest
): Promise<MoodBoardAssets> {
  const summary = extractTokenSummary(request.tokens);
  const prompt = buildMoodBoardPrompt(request, summary);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    const image = extractImageFromResponse(response);
    if (image) {
      return {
        collage: image,
        status: "complete",
        history: [],
      };
    }

    return { collage: "", status: "failed", history: [] };
  } catch (error) {
    console.error("Mood board generation failed:", error);
    return { collage: "", status: "failed", history: [] };
  }
}

export async function generateUiConcepts(
  request: MoodBoardRequest
): Promise<UiConceptAssets> {
  const summary = extractTokenSummary(request.tokens);
  const result: UiConceptAssets = { status: "generating", history: [] };

  const conceptTypes: Array<"audioPlugin" | "dashboard"> = [
    "audioPlugin",
    "dashboard",
  ];

  for (const conceptType of conceptTypes) {
    try {
      const prompt = buildUiConceptPrompt(request, summary, conceptType);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseModalities: ["image", "text"],
        },
      });

      const image = extractImageFromResponse(response);
      if (image) {
        result[conceptType] = image;
      }
    } catch (error) {
      console.error(`UI concept ${conceptType} generation failed:`, error);
    }
  }

  result.status = result.audioPlugin || result.dashboard ? "complete" : "failed";
  return result;
}

export async function generateAllMoodBoardAssets(
  request: MoodBoardRequest
): Promise<{ moodBoard: MoodBoardAssets; uiConcepts: UiConceptAssets }> {
  const [moodBoard, uiConcepts] = await Promise.all([
    generateMoodBoardCollage(request),
    generateUiConcepts(request),
  ]);

  return { moodBoard, uiConcepts };
}
