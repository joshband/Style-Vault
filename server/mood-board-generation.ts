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

type ProgressCallback = (progress: number, message: string) => Promise<void>;

interface MoodBoardRequest {
  styleName: string;
  styleDescription: string;
  tokens: Record<string, any>;
  metadataTags: MetadataTags;
  referenceImageBase64?: string;
  onProgress?: ProgressCallback;
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

  return `Create a mood board collage for "${styleName}".

================================================================================
PRIMARY DIRECTIVE: DESIGN TOKENS (HIGHEST PRIORITY)
================================================================================
The following Design Tokens were extracted from the source image and MUST be the primary visual drivers. These are NON-NEGOTIABLE specifications:

MANDATORY COLOR PALETTE - Use ONLY these exact hex values:
${summary.colors.map((c) => `  ${c.name}: ${c.hex} (EXACT - no substitution)`).join("\n")}

TOKEN-DEFINED PROPERTIES:
- Typography Style: serif="${summary.typography.serif}", sans="${summary.typography.sans}", mono="${summary.typography.mono}"
- Surface Texture: grain="${summary.texture.grain}", finish="${summary.texture.finish}"
- Lighting System: type="${summary.lighting.type}", direction="${summary.lighting.direction}", intensity="${summary.lighting.intensity}"
- Mood Parameters: tone="${summary.mood.tone}", saturation=${summary.mood.saturation}, contrast=${summary.mood.contrast}

================================================================================
SECONDARY: SEMANTIC CONTEXT (Lower Priority - Use to Inform Composition)
================================================================================
Style Description: ${styleDescription}
Era Context: ${eraKeywords}
Medium Reference: ${mediumKeywords}
Mood Keywords: ${moodKeywords}

================================================================================
LAYOUT & COMPOSITION
================================================================================
A sophisticated Pinterest-style grid collage with varied tile sizes in a 3:4 portrait aspect ratio. Include 8-12 tiles arranged asymmetrically with thin gaps.

REQUIRED ELEMENTS (each MUST use the token-defined colors above):
1. COLOR PALETTE STRIP: Swatches showing: ${colorList}
2. HERO TYPOGRAPHY: Display text using the token typography styles
3. TEXTURE SAMPLES: 2-3 tiles matching token texture: "${summary.texture.finish}" grain
4. ARTISTIC TILES: 2-3 abstract patterns using ONLY the token colors
5. EVOCATIVE OBJECTS: 1-2 tiles with objects lit according to token lighting: "${summary.lighting.type}"

The resulting image MUST visually match the extracted Design Tokens. Colors should be immediately recognizable as the hex values specified above.`;
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
    audioPlugin: `Create a professional audio plugin/synthesizer interface for "${styleName}".

================================================================================
PRIMARY DIRECTIVE: DESIGN TOKENS (HIGHEST PRIORITY)
================================================================================
The following Design Tokens were extracted from the source image. These are the AUTHORITATIVE visual specifications:

MANDATORY COLOR PALETTE - Use ONLY these exact hex values:
${summary.colors.map((c) => `  ${c.name}: ${c.hex} (EXACT - no substitution)`).join("\n")}

TOKEN-DEFINED PROPERTIES:
- Typography: serif="${summary.typography.serif}", sans="${summary.typography.sans}", mono="${summary.typography.mono}"
- Surface Texture: grain="${summary.texture.grain}", finish="${summary.texture.finish}"
- Lighting: type="${summary.lighting.type}", direction="${summary.lighting.direction}", intensity="${summary.lighting.intensity}"
- Mood: tone="${summary.mood.tone}", saturation=${summary.mood.saturation}, contrast=${summary.mood.contrast}

================================================================================
SECONDARY: SEMANTIC CONTEXT (Use to Inform Composition)
================================================================================
Style Description: ${styleDescription}
Visual Era: ${eraKeywords}
Mood Keywords: ${moodKeywords}

================================================================================
UI LAYOUT & ELEMENTS
================================================================================
A 16:9 landscape interface with:
- 3-4 large circular knobs using token colors for accents/indicators
- Waveform/oscilloscope display colored with the token palette
- Grid of buttons or sequencer pads in token colors
- Sliders and faders matching token aesthetic
- VU meters using token accent colors
- Plugin name header in token typography style

ALL elements MUST use the exact hex colors from the Design Tokens above. The interface should be immediately recognizable as using this specific color palette.`,

    dashboard: `Create a modern web application user interface mockup for "${styleName}".

================================================================================
PRIMARY DIRECTIVE: DESIGN TOKENS (HIGHEST PRIORITY)
================================================================================
The following Design Tokens were extracted from the source image. These are the AUTHORITATIVE visual specifications:

MANDATORY COLOR PALETTE - Use ONLY these exact hex values:
${summary.colors.map((c) => `  ${c.name}: ${c.hex} (EXACT - no substitution)`).join("\n")}

TOKEN-DEFINED PROPERTIES:
- Typography: serif="${summary.typography.serif}", sans="${summary.typography.sans}", mono="${summary.typography.mono}"
- Surface Texture: grain="${summary.texture.grain}", finish="${summary.texture.finish}"
- Lighting: type="${summary.lighting.type}", direction="${summary.lighting.direction}", intensity="${summary.lighting.intensity}"
- Mood: tone="${summary.mood.tone}", saturation=${summary.mood.saturation}, contrast=${summary.mood.contrast}

================================================================================
SECONDARY: SEMANTIC CONTEXT (Use to Inform Composition)
================================================================================
Style Description: ${styleDescription}
Visual Era: ${eraKeywords}
Mood Keywords: ${moodKeywords}

================================================================================
UI LAYOUT & ELEMENTS
================================================================================
Create a clean, professional web application interface in 16:9 landscape format showcasing standard UI components:

NAVIGATION:
- Top navigation bar with logo area and menu items using token colors
- Clear active state highlighting with token accent colors

MAIN CONTENT AREA:
- Hero section with heading, subheading, and call-to-action button
- Card grid showing 2-3 content cards with shadows and rounded corners
- Each card has an image placeholder, title, description, and action button

UI COMPONENTS SHOWCASE:
- Primary and secondary buttons in token colors
- Form inputs (text field, dropdown, toggle switch)
- Badge/tag elements
- Avatar/profile indicators
- Progress or loading indicators

FOOTER OR SIDEBAR:
- Secondary navigation or additional links

DESIGN REQUIREMENTS:
- Use ample whitespace and modern spacing
- Apply token colors consistently: primary for CTAs, secondary for backgrounds, accent for highlights
- Ensure clear visual hierarchy with the token typography
- All backgrounds, buttons, text, and accents MUST use the exact hex colors from Design Tokens above

The interface should look like a real, polished SaaS application that immediately showcases how this style applies to everyday web components.`,
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

async function generateSingleUiConcept(
  request: MoodBoardRequest,
  conceptType: "audioPlugin" | "dashboard"
): Promise<string | null> {
  const summary = extractTokenSummary(request.tokens);
  const prompt = buildUiConceptPrompt(request, summary, conceptType);
  
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

    return extractImageFromResponse(response);
  } catch (error) {
    console.error(`UI concept ${conceptType} generation failed:`, error);
    return null;
  }
}

export async function generateUiConcepts(
  request: MoodBoardRequest,
  onProgress?: ProgressCallback
): Promise<UiConceptAssets> {
  if (onProgress) {
    await onProgress(55, "Generating audio plugin UI concept...");
    const audioPlugin = await generateSingleUiConcept(request, "audioPlugin");
    
    await onProgress(75, "Generating dashboard UI concept...");
    const dashboard = await generateSingleUiConcept(request, "dashboard");
    
    return {
      audioPlugin: audioPlugin || undefined,
      dashboard: dashboard || undefined,
      status: audioPlugin || dashboard ? "complete" : "failed",
      history: [],
    };
  } else {
    const [audioPlugin, dashboard] = await Promise.all([
      generateSingleUiConcept(request, "audioPlugin"),
      generateSingleUiConcept(request, "dashboard"),
    ]);

    return {
      audioPlugin: audioPlugin || undefined,
      dashboard: dashboard || undefined,
      status: audioPlugin || dashboard ? "complete" : "failed",
      history: [],
    };
  }
}

export async function generateAllMoodBoardAssets(
  request: MoodBoardRequest
): Promise<{ moodBoard: MoodBoardAssets; uiConcepts: UiConceptAssets }> {
  const { onProgress } = request;
  
  if (onProgress) {
    await onProgress(5, "Preparing style tokens...");
    await onProgress(8, "Starting parallel asset generation: mood board, audio plugin, dashboard...");
    
    // Track completion for progress updates
    let completedCount = 0;
    const totalTasks = 3;
    
    const updateProgress = async (taskName: string) => {
      completedCount++;
      // Progress goes from 10 to 90 as tasks complete (10, 37, 63, 90)
      const progress = 10 + Math.floor((completedCount / totalTasks) * 80);
      await onProgress(progress, `Generated ${taskName} (${completedCount}/${totalTasks})`);
    };
    
    // Run all three image generations in parallel for ~3x speed improvement
    const [moodBoard, audioPlugin, dashboard] = await Promise.all([
      (async () => {
        await onProgress(12, "Generating mood board collage...");
        const result = await generateMoodBoardCollage(request);
        await updateProgress("mood board collage");
        return result;
      })(),
      (async () => {
        await onProgress(14, "Generating audio plugin UI...");
        const result = await generateSingleUiConcept(request, "audioPlugin");
        await updateProgress("audio plugin UI");
        return result;
      })(),
      (async () => {
        await onProgress(16, "Generating dashboard UI...");
        const result = await generateSingleUiConcept(request, "dashboard");
        await updateProgress("dashboard UI");
        return result;
      })(),
    ]);
    
    await onProgress(95, "Finalizing assets...");
    
    const uiConcepts: UiConceptAssets = {
      audioPlugin: audioPlugin || undefined,
      dashboard: dashboard || undefined,
      status: audioPlugin || dashboard ? "complete" : "failed",
      history: [],
    };
    
    return { moodBoard, uiConcepts };
  } else {
    const [moodBoard, uiConcepts] = await Promise.all([
      generateMoodBoardCollage(request),
      generateUiConcepts(request),
    ]);

    return { moodBoard, uiConcepts };
  }
}
