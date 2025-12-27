import { generateWithFluxSchnell, isProdiaEnabled, ProdiaGenerationResult } from "./prodia-service";
import { storage } from "./storage";
import { ai } from "./replit_integrations/image/client";

type ProgressCallback = (progress: number, message: string) => Promise<void>;

interface ImageAnalysis {
  hasSubject: boolean;
  subjectType: "portrait" | "landscape" | "still_life" | "abstract" | "ui" | "other";
  sceneDescription: string;
  dominantElements: string[];
  artisticStyle: string;
}

async function analyzeReferenceImage(base64Image: string): Promise<ImageAnalysis | null> {
  try {
    const mimeMatch = base64Image.match(/^data:(image\/[a-z]+);base64,/);
    const mimeType = mimeMatch?.[1] || "image/jpeg";
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `Analyze this image for art style transfer. Return a JSON object with:
{
  "hasSubject": boolean - true if there's a clear identifiable subject/scene,
  "subjectType": "portrait" | "landscape" | "still_life" | "abstract" | "ui" | "other",
  "sceneDescription": "Detailed 30-50 word description of the scene, subjects, and composition",
  "dominantElements": ["list", "of", "key", "visual", "elements"],
  "artisticStyle": "Brief description of the artistic rendering style (e.g., 'painterly oil', 'digital illustration', 'watercolor wash')"
}
Only return valid JSON, no markdown.`,
          },
        ],
      }],
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0];
    if (!text || typeof text !== "object" || !("text" in text)) return null;
    
    const jsonStr = String(text.text).replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr) as ImageAnalysis;
  } catch (error) {
    console.error("[Prodia] Failed to analyze reference image:", error);
    return null;
  }
}

interface TokenSummary {
  colors: { name: string; hex: string }[];
  typography: { serif: string; sans: string; mono: string };
  texture: { grain: string; finish: string };
  lighting: { type: string; direction: string; intensity: string };
  mood: { tone: string; saturation: string; contrast: string };
}

interface PreviewGenerationRequest {
  styleName: string;
  styleDescription: string;
  referenceImageBase64?: string;
  tokens?: Record<string, unknown>;
  onProgress?: ProgressCallback;
}

interface PreviewResult {
  portrait: string;
  landscape: string;
  stillLife: string;
  allFailed: boolean;
  processingTimeMs: number;
}

interface MoodBoardRequest {
  styleName: string;
  styleDescription: string;
  tokens: Record<string, unknown>;
  metadataTags?: Record<string, string[]>;
  onProgress?: ProgressCallback;
}

interface UiConceptResult {
  softwareApp?: string;
  audioPlugin?: string;
  dashboard?: string;
  processingTimeMs: number;
}

const CANONICAL_SUBJECTS = {
  portrait: "an artist standing in their sunlit atelier studio, wearing a paint-stained apron, holding a palette and brush, with an easel and canvas visible behind them",
  landscape: "an elevated stone promenade with ornate railings overlooking a layered cityscape at golden hour, with rooftops, spires, and distant mountains visible on the horizon",
  stillLife: "a curated arrangement on a wooden studio desk featuring an open leather-bound sketchbook, glass jars of colorful pigments, a small sculpted bust, dried flowers in a ceramic vase, and natural light from a nearby window",
};

function extractTokenSummary(tokens: Record<string, unknown>): TokenSummary {
  const color = (tokens.color || {}) as Record<string, unknown>;
  const typography = (tokens.typography || {}) as Record<string, unknown>;
  const texture = (tokens.texture || {}) as Record<string, unknown>;
  const lighting = (tokens.lighting || {}) as Record<string, unknown>;
  const mood = (tokens.mood || {}) as Record<string, unknown>;

  const colors: { name: string; hex: string }[] = [];
  for (const [name, token] of Object.entries(color)) {
    if (token && typeof token === "object" && "$value" in token) {
      colors.push({ name, hex: String((token as Record<string, unknown>).$value) });
    }
  }

  const fontFamily = (typography.fontFamily || {}) as Record<string, Record<string, unknown>>;

  return {
    colors: colors.slice(0, 6),
    typography: {
      serif: String(fontFamily.serif?.$value ?? "Georgia"),
      sans: String(fontFamily.sans?.$value ?? "Arial"),
      mono: String(fontFamily.mono?.$value ?? "Courier"),
    },
    texture: {
      grain: String((texture.grain as Record<string, unknown>)?.$value ?? "subtle"),
      finish: String((texture.finish as Record<string, unknown>)?.$value ?? "matte"),
    },
    lighting: {
      type: String((lighting.type as Record<string, unknown>)?.$value ?? "natural"),
      direction: String((lighting.direction as Record<string, unknown>)?.$value ?? "diffuse"),
      intensity: String((lighting.intensity as Record<string, unknown>)?.$value ?? "medium"),
    },
    mood: {
      tone: String((mood.tone as Record<string, unknown>)?.$value ?? "neutral"),
      saturation: String((mood.saturation as Record<string, unknown>)?.$value ?? 0.5),
      contrast: String((mood.contrast as Record<string, unknown>)?.$value ?? 0.5),
    },
  };
}

function buildColorPromptFragment(summary: TokenSummary): string {
  if (summary.colors.length === 0) return "";
  const colorList = summary.colors.slice(0, 4).map(c => c.hex).join(", ");
  return `Color palette: ${colorList}.`;
}

function buildStylePromptFragment(styleName: string, styleDescription: string, summary: TokenSummary): string {
  const colorFragment = buildColorPromptFragment(summary);
  const lightingFragment = `${summary.lighting.type} lighting, ${summary.lighting.intensity} intensity.`;
  const textureFragment = `${summary.texture.finish} finish with ${summary.texture.grain} grain.`;
  const moodFragment = `${summary.mood.tone} mood.`;
  
  return `In the style of "${styleName}": ${styleDescription.slice(0, 150)}. ${colorFragment} ${lightingFragment} ${textureFragment} ${moodFragment}`;
}

async function generatePreviewImage(
  type: "portrait" | "landscape" | "stillLife",
  styleName: string,
  styleDescription: string,
  summary: TokenSummary,
  analysis?: ImageAnalysis | null
): Promise<ProdiaGenerationResult> {
  let subject: string;
  
  if (analysis?.hasSubject && analysis.sceneDescription) {
    const elements = analysis.dominantElements?.slice(0, 3).join(", ") || "";
    const baseScene = analysis.sceneDescription;
    
    if (type === "portrait" && analysis.subjectType === "portrait") {
      subject = baseScene;
    } else if (type === "landscape" && analysis.subjectType === "landscape") {
      subject = baseScene;
    } else if (type === "stillLife" && analysis.subjectType === "still_life") {
      subject = baseScene;
    } else {
      subject = `${baseScene}. Key elements: ${elements}. Rendered as a ${type === "stillLife" ? "still life composition" : type} view`;
    }
  } else {
    subject = CANONICAL_SUBJECTS[type];
  }
  
  const styleFragment = buildStylePromptFragment(styleName, styleDescription, summary);
  const artisticHint = analysis?.artisticStyle ? `In ${analysis.artisticStyle} style.` : "";
  
  const prompt = `${subject}. ${styleFragment} ${artisticHint} High quality, detailed, professional artwork.`;
  
  return generateWithFluxSchnell({ prompt });
}

export async function generateCanonicalPreviewsWithProdia(
  request: PreviewGenerationRequest
): Promise<PreviewResult> {
  const startTime = Date.now();
  
  if (!isProdiaEnabled()) {
    throw new Error("Prodia is not configured. Set PRODIA_TOKEN to enable.");
  }
  
  const summary = request.tokens ? extractTokenSummary(request.tokens) : extractTokenSummary({});
  
  await request.onProgress?.(5, "Starting Prodia preview generation...");
  
  let analysis: ImageAnalysis | null = null;
  if (request.referenceImageBase64) {
    await request.onProgress?.(8, "Analyzing reference image...");
    analysis = await analyzeReferenceImage(request.referenceImageBase64);
    if (analysis) {
      console.log(`[Prodia] Reference image analyzed: ${analysis.subjectType} - ${analysis.sceneDescription?.slice(0, 50)}...`);
    }
  }
  
  const [portraitResult, landscapeResult, stillLifeResult] = await Promise.all([
    (async () => {
      await request.onProgress?.(15, "Generating portrait preview...");
      return generatePreviewImage("portrait", request.styleName, request.styleDescription, summary, analysis);
    })(),
    (async () => {
      await request.onProgress?.(30, "Generating landscape preview...");
      return generatePreviewImage("landscape", request.styleName, request.styleDescription, summary, analysis);
    })(),
    (async () => {
      await request.onProgress?.(45, "Generating still life preview...");
      return generatePreviewImage("stillLife", request.styleName, request.styleDescription, summary, analysis);
    })(),
  ]);
  
  await request.onProgress?.(90, "Finalizing previews...");
  
  const placeholder = generatePlaceholder(request.styleName);
  
  const result: PreviewResult = {
    portrait: portraitResult.success ? portraitResult.imageBase64! : placeholder,
    landscape: landscapeResult.success ? landscapeResult.imageBase64! : placeholder,
    stillLife: stillLifeResult.success ? stillLifeResult.imageBase64! : placeholder,
    allFailed: !portraitResult.success && !landscapeResult.success && !stillLifeResult.success,
    processingTimeMs: Date.now() - startTime,
  };
  
  await request.onProgress?.(100, "Preview generation complete");
  
  console.log(`[Prodia] Generated previews in ${result.processingTimeMs}ms`);
  
  // Record metrics
  storage.recordMetric({
    type: "preview_generation",
    durationMs: result.processingTimeMs,
    success: !result.allFailed,
    metadata: { 
      generator: "prodia",
      portrait: portraitResult.success,
      landscape: landscapeResult.success,
      stillLife: stillLifeResult.success,
    },
  }).catch(err => console.error("Failed to record preview metric:", err));
  
  return result;
}

export async function generateMoodBoardWithProdia(
  request: MoodBoardRequest
): Promise<{ collage: string; processingTimeMs: number }> {
  const startTime = Date.now();
  
  if (!isProdiaEnabled()) {
    throw new Error("Prodia is not configured. Set PRODIA_TOKEN to enable.");
  }
  
  const summary = extractTokenSummary(request.tokens);
  const colorList = summary.colors.slice(0, 4).map(c => c.hex).join(", ");
  const moodKeywords = request.metadataTags?.mood?.slice(0, 3).join(", ") || summary.mood.tone;
  
  await request.onProgress?.(10, "Generating mood board collage...");
  
  const prompt = `A sophisticated mood board collage for "${request.styleName}" style. Pinterest-style grid layout with 8-12 tiles. Color palette: ${colorList}. Mood: ${moodKeywords}. Includes texture samples, typography examples, color swatches, and artistic patterns. ${summary.lighting.type} lighting, ${summary.texture.finish} finish. Professional design mood board, high quality.`;
  
  const result = await generateWithFluxSchnell({ prompt });
  
  await request.onProgress?.(100, "Mood board complete");
  
  const processingTimeMs = Date.now() - startTime;
  
  // Record metrics
  storage.recordMetric({
    type: "mood_board_generation",
    durationMs: processingTimeMs,
    success: result.success,
    metadata: { generator: "prodia" },
  }).catch(err => console.error("Failed to record mood board metric:", err));
  
  if (!result.success) {
    throw new Error(result.error || "Failed to generate mood board");
  }
  
  return {
    collage: result.imageBase64!,
    processingTimeMs,
  };
}

export async function generateUiConceptsWithProdia(
  request: MoodBoardRequest
): Promise<UiConceptResult> {
  const startTime = Date.now();
  
  if (!isProdiaEnabled()) {
    throw new Error("Prodia is not configured. Set PRODIA_TOKEN to enable.");
  }
  
  const summary = extractTokenSummary(request.tokens);
  const colorList = summary.colors.slice(0, 4).map(c => c.hex).join(", ");
  
  await request.onProgress?.(10, "Generating UI concepts...");
  
  const baseStyle = `Color palette: ${colorList}. ${summary.mood.tone} mood. ${summary.lighting.type} lighting. ${summary.texture.finish} finish.`;
  
  const [softwareAppResult, audioPluginResult, dashboardResult] = await Promise.all([
    (async () => {
      await request.onProgress?.(25, "Generating software app concept...");
      const prompt = `A modern desktop software application UI design for "${request.styleName}" style. Clean interface with sidebar, toolbar, and main content area. ${baseStyle} Professional software UI mockup, detailed, high quality.`;
      return generateWithFluxSchnell({ prompt });
    })(),
    (async () => {
      await request.onProgress?.(50, "Generating audio plugin concept...");
      const prompt = `A professional audio plugin VST interface for "${request.styleName}" style. Includes knobs, sliders, meters, and waveform display. ${baseStyle} Music production plugin UI, skeuomorphic details, high quality.`;
      return generateWithFluxSchnell({ prompt });
    })(),
    (async () => {
      await request.onProgress?.(75, "Generating dashboard concept...");
      const prompt = `A data analytics dashboard UI for "${request.styleName}" style. Charts, graphs, metrics cards, and navigation. ${baseStyle} Business dashboard interface, professional, high quality.`;
      return generateWithFluxSchnell({ prompt });
    })(),
  ]);
  
  await request.onProgress?.(100, "UI concepts complete");
  
  const processingTimeMs = Date.now() - startTime;
  const allSucceeded = softwareAppResult.success && audioPluginResult.success && dashboardResult.success;
  
  // Record metrics
  storage.recordMetric({
    type: "ui_concept_generation",
    durationMs: processingTimeMs,
    success: allSucceeded,
    metadata: {
      generator: "prodia",
      softwareApp: softwareAppResult.success,
      audioPlugin: audioPluginResult.success,
      dashboard: dashboardResult.success,
    },
  }).catch(err => console.error("Failed to record UI concept metric:", err));
  
  return {
    softwareApp: softwareAppResult.success ? softwareAppResult.imageBase64 : undefined,
    audioPlugin: audioPluginResult.success ? audioPluginResult.imageBase64 : undefined,
    dashboard: dashboardResult.success ? dashboardResult.imageBase64 : undefined,
    processingTimeMs,
  };
}

export async function generateStyledImageWithProdia(
  prompt: string,
  styleName: string,
  styleDescription: string,
  promptScaffolding?: string | null,
  tokens?: Record<string, unknown> | null
): Promise<{ imageBase64: string; processingTimeMs: number }> {
  const startTime = Date.now();
  
  if (!isProdiaEnabled()) {
    throw new Error("Prodia is not configured. Set PRODIA_TOKEN to enable.");
  }
  
  const summary = tokens ? extractTokenSummary(tokens) : extractTokenSummary({});
  const styleFragment = buildStylePromptFragment(styleName, styleDescription, summary);
  
  let fullPrompt = prompt;
  if (promptScaffolding) {
    fullPrompt = `${promptScaffolding}\n\n${prompt}`;
  } else {
    fullPrompt = `${prompt}. ${styleFragment}`;
  }
  
  const result = await generateWithFluxSchnell({ prompt: fullPrompt });
  
  if (!result.success) {
    throw new Error(result.error || "Failed to generate image");
  }
  
  return {
    imageBase64: result.imageBase64!,
    processingTimeMs: Date.now() - startTime,
  };
}

function generatePlaceholder(styleName: string): string {
  let hash = 0;
  for (let i = 0; i < styleName.length; i++) {
    hash = ((hash << 5) - hash) + styleName.charCodeAt(i);
    hash = hash & hash;
  }
  const hue = Math.abs(hash % 360);
  
  return `data:image/svg+xml;base64,${Buffer.from(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect fill="hsl(${hue}, 50%, 50%)" width="512" height="512"/><text x="50%" y="50%" fill="white" font-size="24" text-anchor="middle">Generating...</text></svg>`).toString("base64")}`;
}

export async function generateAllAssetsWithProdia(request: MoodBoardRequest): Promise<{
  previews: PreviewResult;
  moodBoard: { collage: string };
  uiConcepts: UiConceptResult;
  totalProcessingTimeMs: number;
}> {
  const startTime = Date.now();
  
  await request.onProgress?.(5, "Starting full asset generation with Prodia...");
  
  const [previews, moodBoard, uiConcepts] = await Promise.all([
    generateCanonicalPreviewsWithProdia({
      styleName: request.styleName,
      styleDescription: request.styleDescription,
      tokens: request.tokens,
      onProgress: async (p, m) => {
        await request.onProgress?.(5 + p * 0.3, `Previews: ${m}`);
      },
    }),
    generateMoodBoardWithProdia({
      ...request,
      onProgress: async (p, m) => {
        await request.onProgress?.(35 + p * 0.3, `Mood Board: ${m}`);
      },
    }),
    generateUiConceptsWithProdia({
      ...request,
      onProgress: async (p, m) => {
        await request.onProgress?.(65 + p * 0.3, `UI Concepts: ${m}`);
      },
    }),
  ]);
  
  await request.onProgress?.(100, "All assets generated");
  
  const totalProcessingTimeMs = Date.now() - startTime;
  console.log(`[Prodia] Generated all assets in ${totalProcessingTimeMs}ms`);
  
  return {
    previews,
    moodBoard,
    uiConcepts,
    totalProcessingTimeMs,
  };
}
