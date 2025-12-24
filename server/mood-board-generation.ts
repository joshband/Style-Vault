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
  const { styleName, metadataTags } = request;

  const colorList = summary.colors.map((c) => `${c.name}: ${c.hex}`).join(", ");
  const moodKeywords = metadataTags.mood.slice(0, 4).join(", ") || "refined, artistic";
  const eraKeywords = metadataTags.era.slice(0, 2).join(", ") || "contemporary";
  const textureKeywords = metadataTags.texture.slice(0, 3).join(", ") || summary.texture.finish;
  const lightingKeywords = metadataTags.lighting.slice(0, 2).join(", ") || summary.lighting.type;

  return `Create a visually cohesive mood board collage for the "${styleName}" design style.

LAYOUT: A Pinterest-style grid collage with varied tile sizes in a 3:4 portrait aspect ratio. Include 8-12 tiles arranged asymmetrically.

REQUIRED ELEMENTS:
1. COLOR PALETTE: A horizontal strip of 5-6 color swatches showing: ${colorList}
2. TYPOGRAPHY SPECIMEN: Large display text with style keywords like "${moodKeywords.toUpperCase()}" in bold display typeface
3. TEXTURE SAMPLES: 2-3 tiles showing abstract textures matching: ${textureKeywords}
4. ART REFERENCE TILES: 2-3 tiles with swirling, painterly abstract patterns using the color palette (like Van Gogh or impressionist style)
5. MATERIAL OBJECTS: 1-2 vintage-inspired 3D objects like radio knobs, oscilloscopes, or industrial controls rendered in the style's colors
6. MOOD KEYWORDS: Typography tiles with keywords like "${moodKeywords}", "${eraKeywords}", displayed as graphic design elements

COLOR PALETTE TO USE:
${summary.colors.map((c) => `- ${c.name}: ${c.hex}`).join("\n")}

STYLE CHARACTERISTICS:
- Era/Movement: ${eraKeywords}
- Mood: ${moodKeywords}
- Textures: ${textureKeywords}
- Lighting: ${lightingKeywords}
- Typography feels: ${summary.typography.serif} for headers, ${summary.typography.sans} for body

The overall feel should be aspirational design inspiration - something a designer would pin to communicate the visual direction of a project. Use cream/off-white gaps between tiles. Make it feel editorial and curated.`;
}

function buildUiConceptPrompt(
  request: MoodBoardRequest,
  summary: TokenSummary,
  conceptType: "audioPlugin" | "dashboard" | "componentLibrary"
): string {
  const { styleName } = request;
  const colorList = summary.colors.map((c) => `${c.name}: ${c.hex}`).join(", ");

  const conceptPrompts = {
    audioPlugin: `Create a UI mockup of an audio plugin/synthesizer interface in the "${styleName}" visual style.

LAYOUT: A 16:9 landscape interface with a textured background.

REQUIRED UI ELEMENTS:
- 3-4 large circular knobs with labels (WARMTH, BOOST, RESONANCE, etc.)
- A waveform display panel showing oscilloscope-style graphics
- Grid of small LED-style buttons or step sequencer pads
- Sliders and faders with labeled tracks
- Status indicators and small displays
- A header bar with the plugin name

Apply these colors throughout: ${colorList}

The interface should feel tactile and dimensional - knobs should look glossy and touchable. Use the texture and lighting characteristics of the style. The background should have subtle texture matching the style's aesthetic.`,

    dashboard: `Create a UI mockup of a data dashboard interface in the "${styleName}" visual style.

LAYOUT: A 16:9 landscape dashboard with multiple panels.

REQUIRED UI ELEMENTS:
- A sidebar with navigation icons and menu items
- 2-3 chart/graph panels (line charts, bar charts, or gauges)
- Card components with metrics and KPIs
- A header bar with title and action buttons
- Data tables or list components
- Progress bars and status indicators

Apply these colors throughout: ${colorList}

Use primary colors for key actions and accents, secondary for supporting elements. The charts and graphs should use the color palette. Background panels should use the surface and background colors from the style.`,

    componentLibrary: `Create a UI component showcase poster in the "${styleName}" visual style.

LAYOUT: A 3:4 portrait grid showing various UI components.

REQUIRED ELEMENTS:
- Typography specimen: "THE ART OF DESIGN" or similar in display type
- Alphabet specimen showing character set
- Button components in various states
- Icon set (play, pause, arrows, settings)
- Form elements (toggles, sliders, checkboxes)
- Color palette strip
- Layout/grid demonstration
- Small interface fragment showing components in context

Apply these colors throughout: ${colorList}

The poster should feel like a designer's reference sheet - organized, systematic, but also aesthetically beautiful. Use the style's typography and texture characteristics throughout.`,
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
      };
    }

    return { collage: "", status: "failed" };
  } catch (error) {
    console.error("Mood board generation failed:", error);
    return { collage: "", status: "failed" };
  }
}

export async function generateUiConcepts(
  request: MoodBoardRequest
): Promise<UiConceptAssets> {
  const summary = extractTokenSummary(request.tokens);
  const result: UiConceptAssets = { status: "generating" };

  const conceptTypes: Array<"audioPlugin" | "dashboard" | "componentLibrary"> = [
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
