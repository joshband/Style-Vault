import { generateWithFluxSchnell, isProdiaEnabled, ProdiaGenerationResult } from "./prodia-service";
import { storage } from "./storage";
import { ai, generateWithGemini, generateWithOpenAI, analyzeRenderingStyle, RenderingStyle } from "./replit_integrations/image/client";
import { withImageGenRetry } from "./retry-utils";
import { logger } from "./logger";

type ProgressCallback = (progress: number, message: string) => Promise<void>;
type ImageProvider = "gemini" | "openai" | "prodia";

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
    
    const response = await withImageGenRetry(
      () => ai.models.generateContent({
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
      }),
      "Gemini image analysis"
    );
    
    const text = response.candidates?.[0]?.content?.parts?.[0];
    if (!text || typeof text !== "object" || !("text" in text)) return null;
    
    const jsonStr = String(text.text).replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr) as ImageAnalysis;
  } catch (error) {
    logger.error("Failed to analyze reference image", error, { module: 'ProdiaGeneration' });
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
  metadataTags?: Record<string, string[]>;
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

// UI-specific canonical subjects for audio/software/dashboard styles
const UI_CANONICAL_SUBJECTS = {
  portrait: "a vintage audio equipment panel with analog VU meters, rotary knobs with brass bezels, toggle switches, and colorful LED indicators arranged in a symmetrical layout",
  landscape: "a control room console with channel strips, faders, vintage patch bay, rack-mounted gear with illuminated displays, and industrial metal housing with ventilation grilles",
  stillLife: "a close-up arrangement of audio equipment components including potentiometers, vintage toggle switches, colorful enamel buttons, analog gauges, and brass fittings on a textured metal surface",
};

// Detect if a style is UI-related based on metadata tags
function isUiStyleFromMetadata(metadataTags?: Record<string, string[]>): boolean {
  if (!metadataTags) return false;
  
  // Check usageExamples for UI-related terms
  const usageExamples = metadataTags.usageExamples || [];
  const uiUsagePatterns = ['plugin', 'software', 'app', 'dashboard', 'ui', 'interface', 'game'];
  if (usageExamples.some(usage => 
    uiUsagePatterns.some(pattern => usage.toLowerCase().includes(pattern))
  )) {
    return true;
  }
  
  // Check subjects for equipment/technical terms
  const subjects = metadataTags.subjects || [];
  const uiSubjectPatterns = ['audio', 'equipment', 'gauge', 'dial', 'switch', 'knob', 'meter', 'control', 'panel'];
  if (subjects.some(subject => 
    uiSubjectPatterns.some(pattern => subject.toLowerCase().includes(pattern))
  )) {
    return true;
  }
  
  return false;
}

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

function buildStylePromptFragment(
  styleName: string, 
  styleDescription: string, 
  summary: TokenSummary,
  metadataTags?: Record<string, string[]>
): string {
  const colorFragment = buildColorPromptFragment(summary);
  const lightingFragment = `${summary.lighting.type} lighting, ${summary.lighting.intensity} intensity.`;
  const textureFragment = `${summary.texture.finish} finish with ${summary.texture.grain} grain.`;
  const moodFragment = `${summary.mood.tone} mood.`;
  
  // Build rich style keywords from metadataTags (handle both singular and plural key variants)
  const styleKeywords: string[] = [];
  if (metadataTags) {
    // Material and texture characteristics (support both material/materials, texture/textures)
    const materials = metadataTags.materials || metadataTags.material || [];
    const textures = metadataTags.textures || metadataTags.texture || [];
    if (materials.length) {
      styleKeywords.push(`Materials: ${materials.slice(0, 3).join(", ")}`);
    }
    if (textures.length) {
      styleKeywords.push(`Textures: ${textures.slice(0, 3).join(", ")}`);
    }
    // Era and artistic style (support stylisticPrinciples as fallback)
    if (metadataTags.era?.length) {
      styleKeywords.push(`Era: ${metadataTags.era.slice(0, 2).join(", ")}`);
    }
    const artStyle = metadataTags.artisticStyle || metadataTags.stylisticPrinciples || metadataTags.medium || [];
    if (artStyle.length) {
      styleKeywords.push(`Style: ${artStyle.slice(0, 2).join(", ")}`);
    }
    // Mood and atmosphere
    if (metadataTags.mood?.length) {
      styleKeywords.push(`Mood: ${metadataTags.mood.slice(0, 2).join(", ")}`);
    }
    // Visual characteristics (support depth, shadow as fallbacks)
    const visuals = metadataTags.visualAttributes || metadataTags.depth || metadataTags.shadow || [];
    if (visuals.length) {
      styleKeywords.push(`Visual: ${visuals.slice(0, 3).join(", ")}`);
    }
    // Signature motifs for additional context
    if (metadataTags.signatureMotifs?.length) {
      styleKeywords.push(`Key motifs: ${metadataTags.signatureMotifs.slice(0, 3).join(", ")}`);
    }
  }
  
  const keywordsFragment = styleKeywords.length > 0 ? styleKeywords.join(". ") + "." : "";
  
  // Use full description (up to 400 chars) instead of truncated 150
  const descFragment = styleDescription.slice(0, 400);
  
  return `In the style of "${styleName}": ${descFragment}. ${keywordsFragment} ${colorFragment} ${lightingFragment} ${textureFragment} ${moodFragment}`;
}

async function generatePreviewImage(
  type: "portrait" | "landscape" | "stillLife",
  styleName: string,
  styleDescription: string,
  summary: TokenSummary,
  analysis?: ImageAnalysis | null,
  metadataTags?: Record<string, string[]>,
  referenceImageBase64?: string,
  renderingStyle?: RenderingStyle | null
): Promise<MultiProviderResult> {
  let subject: string;
  
  // For UI-type styles (audio plugins, dashboards, etc.), use UI-specific canonical subjects
  // Check both image analysis AND metadata tags for UI detection
  const isUiStyle = analysis?.subjectType === "ui" || isUiStyleFromMetadata(metadataTags);
  const subjectSource = isUiStyle ? UI_CANONICAL_SUBJECTS : CANONICAL_SUBJECTS;
  
  if (analysis?.hasSubject && analysis.sceneDescription) {
    const elements = analysis.dominantElements?.slice(0, 3).join(", ") || "";
    const baseScene = analysis.sceneDescription;
    
    if (type === "portrait" && analysis.subjectType === "portrait") {
      subject = baseScene;
    } else if (type === "landscape" && analysis.subjectType === "landscape") {
      subject = baseScene;
    } else if (type === "stillLife" && analysis.subjectType === "still_life") {
      subject = baseScene;
    } else if (isUiStyle) {
      // For UI styles, use UI-specific subjects enriched with the original scene context
      subject = `${subjectSource[type]}. Original context: ${baseScene}`;
    } else {
      subject = `${baseScene}. Key elements: ${elements}. Rendered as a ${type === "stillLife" ? "still life composition" : type} view`;
    }
  } else {
    subject = subjectSource[type];
  }
  
  // Build enhanced prompt with metadataTags
  const styleFragment = buildStylePromptFragment(styleName, styleDescription, summary, metadataTags);
  const artisticHint = analysis?.artisticStyle ? `Rendered in ${analysis.artisticStyle} style.` : "";
  
  const prompt = `${subject}. ${styleFragment} ${artisticHint} High quality, detailed, professional artwork. Match the exact visual style, materials, textures, and artistic rendering of the reference image.`;
  
  // Use style transfer with reference image if available, otherwise fall back to Prodia
  if (referenceImageBase64) {
    return generateWithStyleTransfer(prompt, referenceImageBase64, renderingStyle, "gemini");
  }
  
  // Fallback to Prodia if no reference image
  const prodiaResult = await generateWithFluxSchnell({ prompt });
  return {
    success: prodiaResult.success,
    imageBase64: prodiaResult.imageBase64,
    provider: "prodia" as ImageProvider,
    error: prodiaResult.error,
  };
}

interface MultiProviderResult {
  success: boolean;
  imageBase64?: string;
  provider: ImageProvider;
  error?: string;
}

async function generateWithStyleTransfer(
  prompt: string,
  referenceImageBase64?: string,
  renderingStyle?: RenderingStyle | null,
  preferredProvider: ImageProvider = "gemini"
): Promise<MultiProviderResult> {
  const providers: ImageProvider[] = preferredProvider === "gemini" 
    ? ["gemini", "openai", "prodia"] 
    : preferredProvider === "openai"
    ? ["openai", "gemini", "prodia"]
    : ["prodia", "gemini", "openai"];
  
  for (const provider of providers) {
    try {
      let imageBase64: string;
      
      switch (provider) {
        case "gemini":
          imageBase64 = await withImageGenRetry(
            () => generateWithGemini(prompt, {
              referenceImageBase64,
              renderingStyle: renderingStyle || undefined,
            }),
            "Gemini image generation"
          );
          break;
          
        case "openai":
          imageBase64 = await withImageGenRetry(
            () => generateWithOpenAI(prompt, {
              renderingStyle: renderingStyle || undefined,
            }),
            "OpenAI image generation"
          );
          break;
          
        case "prodia":
          if (!isProdiaEnabled()) {
            throw new Error("Prodia not configured");
          }
          const prodiaResult = await withImageGenRetry(
            () => generateWithFluxSchnell({ prompt }),
            "Prodia image generation"
          );
          if (!prodiaResult.success || !prodiaResult.imageBase64) {
            throw new Error(prodiaResult.error || "Prodia generation failed");
          }
          imageBase64 = prodiaResult.imageBase64;
          break;
          
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      
      logger.info(`Successfully generated with ${provider}`, { module: 'ProdiaGeneration', operation: 'multiProvider' });
      return { success: true, imageBase64, provider };
      
    } catch (error) {
      logger.warn(`${provider} failed: ${error instanceof Error ? error.message : error}`, { module: 'ProdiaGeneration', operation: 'multiProvider' });
      continue;
    }
  }
  
  return { success: false, provider: providers[providers.length - 1], error: "All providers failed" };
}

async function generatePreviewWithGemini(
  type: "portrait" | "landscape" | "stillLife",
  styleName: string,
  styleDescription: string,
  summary: TokenSummary,
  referenceImageBase64?: string,
  renderingStyle?: RenderingStyle | null,
  analysis?: ImageAnalysis | null
): Promise<MultiProviderResult> {
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
  
  const colorFragment = buildColorPromptFragment(summary);
  const artisticHint = analysis?.artisticStyle ? `In ${analysis.artisticStyle} rendering style.` : "";
  
  const prompt = `${subject}. ${colorFragment} ${artisticHint} Style: "${styleName}".`;
  
  return generateWithStyleTransfer(prompt, referenceImageBase64, renderingStyle, "gemini");
}

export async function generateCanonicalPreviewsWithProdia(
  request: PreviewGenerationRequest
): Promise<PreviewResult> {
  const startTime = Date.now();
  
  if (!isProdiaEnabled()) {
    throw new Error("Prodia is not configured. Set PRODIA_TOKEN to enable.");
  }
  
  const summary = request.tokens ? extractTokenSummary(request.tokens) : extractTokenSummary({});
  
  await request.onProgress?.(5, "Starting style-accurate preview generation...");
  
  // Analyze both reference image structure and rendering style
  let analysis: ImageAnalysis | null = null;
  let renderingStyle: RenderingStyle | null = null;
  
  if (request.referenceImageBase64) {
    await request.onProgress?.(8, "Analyzing reference image style and structure...");
    
    const [rsResult, analysisResult] = await Promise.all([
      analyzeRenderingStyle(request.referenceImageBase64),
      analyzeReferenceImage(request.referenceImageBase64),
    ]);
    
    renderingStyle = rsResult;
    analysis = analysisResult;
    
    if (analysis) {
      logger.info(`Reference analyzed: ${analysis.subjectType} - ${analysis.artisticStyle}`, { module: 'ProdiaGeneration' });
    }
    if (renderingStyle) {
      logger.info(`Rendering style: ${renderingStyle.medium} / ${renderingStyle.technique}`, { module: 'ProdiaGeneration' });
    }
  }
  
  const [portraitResult, landscapeResult, stillLifeResult] = await Promise.all([
    (async () => {
      await request.onProgress?.(15, "Generating portrait preview with style transfer...");
      return generatePreviewImage(
        "portrait", request.styleName, request.styleDescription, summary, 
        analysis, request.metadataTags, request.referenceImageBase64, renderingStyle
      );
    })(),
    (async () => {
      await request.onProgress?.(30, "Generating landscape preview with style transfer...");
      return generatePreviewImage(
        "landscape", request.styleName, request.styleDescription, summary, 
        analysis, request.metadataTags, request.referenceImageBase64, renderingStyle
      );
    })(),
    (async () => {
      await request.onProgress?.(45, "Generating still life preview with style transfer...");
      return generatePreviewImage(
        "stillLife", request.styleName, request.styleDescription, summary, 
        analysis, request.metadataTags, request.referenceImageBase64, renderingStyle
      );
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
  
  logger.info(`Generated previews in ${result.processingTimeMs}ms`, { module: 'ProdiaGeneration', duration: result.processingTimeMs });
  
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
  }).catch(err => logger.error("Failed to record preview metric", err, { module: 'ProdiaGeneration' }));
  
  return result;
}

/**
 * Generate canonical previews using Gemini as the primary provider.
 * Uses the reference image for style transfer and falls back to OpenAI/Prodia if needed.
 */
export async function generateCanonicalPreviewsWithGemini(
  request: PreviewGenerationRequest
): Promise<PreviewResult> {
  const startTime = Date.now();
  
  const summary = request.tokens ? extractTokenSummary(request.tokens) : extractTokenSummary({});
  
  await request.onProgress?.(3, "Starting style-accurate preview generation...");
  
  // First, analyze the rendering style of the reference image
  let renderingStyle: RenderingStyle | null = null;
  let analysis: ImageAnalysis | null = null;
  
  if (request.referenceImageBase64) {
    await request.onProgress?.(5, "Analyzing artistic rendering style...");
    
    const [rsResult, analysisResult] = await Promise.all([
      analyzeRenderingStyle(request.referenceImageBase64),
      analyzeReferenceImage(request.referenceImageBase64),
    ]);
    
    renderingStyle = rsResult;
    analysis = analysisResult;
    
    if (renderingStyle) {
      logger.info(`Rendering style detected: ${renderingStyle.medium}, ${renderingStyle.technique}`, { module: 'ProdiaGeneration', operation: 'gemini' });
      logger.info(`Color palette: ${renderingStyle.colorPalette}`, { module: 'ProdiaGeneration', operation: 'gemini' });
      logger.info(`Characteristics: ${renderingStyle.characteristics.join(", ")}`, { module: 'ProdiaGeneration', operation: 'gemini' });
    }
    
    if (analysis) {
      logger.info(`Content analyzed: ${analysis.subjectType} - ${analysis.sceneDescription?.slice(0, 50)}...`, { module: 'ProdiaGeneration', operation: 'gemini' });
    }
  }
  
  await request.onProgress?.(15, "Generating portrait preview with style transfer...");
  
  // Generate previews in parallel using Gemini with style transfer
  const [portraitResult, landscapeResult, stillLifeResult] = await Promise.all([
    (async () => {
      await request.onProgress?.(20, "Generating portrait preview...");
      return generatePreviewWithGemini(
        "portrait", 
        request.styleName, 
        request.styleDescription, 
        summary,
        request.referenceImageBase64,
        renderingStyle,
        analysis
      );
    })(),
    (async () => {
      await request.onProgress?.(40, "Generating landscape preview...");
      return generatePreviewWithGemini(
        "landscape", 
        request.styleName, 
        request.styleDescription, 
        summary,
        request.referenceImageBase64,
        renderingStyle,
        analysis
      );
    })(),
    (async () => {
      await request.onProgress?.(60, "Generating still life preview...");
      return generatePreviewWithGemini(
        "stillLife", 
        request.styleName, 
        request.styleDescription, 
        summary,
        request.referenceImageBase64,
        renderingStyle,
        analysis
      );
    })(),
  ]);
  
  await request.onProgress?.(90, "Finalizing style-accurate previews...");
  
  const placeholder = generatePlaceholder(request.styleName);
  
  const result: PreviewResult = {
    portrait: portraitResult.success && portraitResult.imageBase64 ? portraitResult.imageBase64 : placeholder,
    landscape: landscapeResult.success && landscapeResult.imageBase64 ? landscapeResult.imageBase64 : placeholder,
    stillLife: stillLifeResult.success && stillLifeResult.imageBase64 ? stillLifeResult.imageBase64 : placeholder,
    allFailed: !portraitResult.success && !landscapeResult.success && !stillLifeResult.success,
    processingTimeMs: Date.now() - startTime,
  };
  
  await request.onProgress?.(100, "Style-accurate preview generation complete");
  
  const providers = [portraitResult.provider, landscapeResult.provider, stillLifeResult.provider];
  logger.info(`Generated previews in ${result.processingTimeMs}ms using providers: ${providers.join(", ")}`, { module: 'ProdiaGeneration', operation: 'gemini', duration: result.processingTimeMs });
  
  // Record metrics
  storage.recordMetric({
    type: "preview_generation",
    durationMs: result.processingTimeMs,
    success: !result.allFailed,
    metadata: { 
      generator: "gemini-multi",
      portrait: portraitResult.success,
      landscape: landscapeResult.success,
      stillLife: stillLifeResult.success,
      portraitProvider: portraitResult.provider,
      landscapeProvider: landscapeResult.provider,
      stillLifeProvider: stillLifeResult.provider,
      renderingStyleDetected: !!renderingStyle,
    },
  }).catch(err => logger.error("Failed to record preview metric", err, { module: 'ProdiaGeneration' }));
  
  return result;
}

/**
 * Generate UI concepts using Gemini as the primary provider with style transfer.
 */
export async function generateUiConceptsWithGemini(
  styleName: string,
  styleDescription: string,
  tokens: Record<string, unknown>,
  referenceImageBase64?: string,
  metadataTags?: Record<string, string[]>,
  onProgress?: ProgressCallback
): Promise<UiConceptResult> {
  const startTime = Date.now();
  const summary = extractTokenSummary(tokens);
  
  await onProgress?.(5, "Analyzing style for UI concepts...");
  
  // Analyze rendering style for better UI generation
  let renderingStyle: RenderingStyle | null = null;
  if (referenceImageBase64) {
    renderingStyle = await analyzeRenderingStyle(referenceImageBase64);
  }
  
  const colorList = summary.colors.slice(0, 5).map(c => c.hex).join(", ");
  const moodHint = metadataTags?.mood?.slice(0, 3).join(", ") || summary.mood.tone;
  
  const uiTypes = [
    {
      name: "softwareApp",
      prompt: `Design a software application user interface in "${styleName}" style. Show a main window with sidebar navigation, content area, and toolbar. Modern but matching the artistic style. Color palette: ${colorList}. Mood: ${moodHint}. ${summary.lighting.type} lighting aesthetic.`,
    },
    {
      name: "audioPlugin",
      prompt: `Design an audio plugin/synthesizer interface in "${styleName}" style. Include knobs, faders, VU meters, and digital displays. Skeuomorphic with artistic flair. Color palette: ${colorList}. Mood: ${moodHint}. Professional audio software aesthetic.`,
    },
    {
      name: "dashboard",
      prompt: `Design an analytics dashboard interface in "${styleName}" style. Include charts, graphs, metrics cards, and data visualizations. Clean but artistically styled. Color palette: ${colorList}. Mood: ${moodHint}. Business intelligence aesthetic.`,
    },
  ];
  
  const results: { [key: string]: string | undefined } = {};
  
  for (let i = 0; i < uiTypes.length; i++) {
    const ui = uiTypes[i];
    await onProgress?.((i + 1) * 25, `Generating ${ui.name} UI concept...`);
    
    const result = await generateWithStyleTransfer(
      ui.prompt,
      referenceImageBase64,
      renderingStyle,
      "gemini"
    );
    
    if (result.success && result.imageBase64) {
      results[ui.name] = result.imageBase64;
    }
  }
  
  await onProgress?.(100, "UI concept generation complete");
  
  const processingTimeMs = Date.now() - startTime;
  
  // Record metrics
  storage.recordMetric({
    type: "ui_concept_generation",
    durationMs: processingTimeMs,
    success: Object.keys(results).length > 0,
    metadata: { 
      generator: "gemini-multi",
      softwareApp: !!results.softwareApp,
      audioPlugin: !!results.audioPlugin,
      dashboard: !!results.dashboard,
    },
  }).catch(err => logger.error("Failed to record UI concept metric", err, { module: 'ProdiaGeneration' }));
  
  return {
    softwareApp: results.softwareApp,
    audioPlugin: results.audioPlugin,
    dashboard: results.dashboard,
    processingTimeMs,
  };
}

/**
 * Generate mood board using Gemini as the primary provider.
 */
export async function generateMoodBoardWithGemini(
  request: MoodBoardRequest
): Promise<{ collage: string; processingTimeMs: number }> {
  const startTime = Date.now();
  
  const summary = extractTokenSummary(request.tokens);
  const colorList = summary.colors.slice(0, 4).map(c => c.hex).join(", ");
  const moodKeywords = request.metadataTags?.mood?.slice(0, 3).join(", ") || summary.mood.tone;
  
  await request.onProgress?.(10, "Generating style-accurate mood board...");
  
  const prompt = `A sophisticated mood board collage for "${request.styleName}" style. Pinterest-style grid layout with 8-12 tiles. Color palette: ${colorList}. Mood: ${moodKeywords}. Includes texture samples, typography examples, color swatches, and artistic patterns. ${summary.lighting.type} lighting, ${summary.texture.finish} finish. Professional design mood board.`;
  
  const result = await generateWithStyleTransfer(prompt, undefined, undefined, "gemini");
  
  await request.onProgress?.(100, "Mood board complete");
  
  const processingTimeMs = Date.now() - startTime;
  
  // Record metrics
  storage.recordMetric({
    type: "mood_board_generation",
    durationMs: processingTimeMs,
    success: result.success,
    metadata: { generator: result.provider },
  }).catch(err => logger.error("Failed to record mood board metric", err, { module: 'ProdiaGeneration' }));
  
  if (!result.success || !result.imageBase64) {
    throw new Error(result.error || "Failed to generate mood board");
  }
  
  return {
    collage: result.imageBase64,
    processingTimeMs,
  };
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
  }).catch(err => logger.error("Failed to record mood board metric", err, { module: 'ProdiaGeneration' }));
  
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
  }).catch(err => logger.error("Failed to record UI concept metric", err, { module: 'ProdiaGeneration' }));
  
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
  logger.info(`Generated all assets in ${totalProcessingTimeMs}ms`, { module: 'ProdiaGeneration', duration: totalProcessingTimeMs });
  
  return {
    previews,
    moodBoard,
    uiConcepts,
    totalProcessingTimeMs,
  };
}
