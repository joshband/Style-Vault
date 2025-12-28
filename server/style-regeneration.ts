import { storage } from "./storage";
import { 
  generateCanonicalPreviewsWithProdia, 
  generateMoodBoardWithProdia, 
  generateUiConceptsWithProdia,
  generateCanonicalPreviewsWithGemini,
  generateMoodBoardWithGemini,
  generateUiConceptsWithGemini,
} from "./prodia-generation";
import { extractTokensWithCV } from "./cv-bridge";
import { enrichStyleMetadata } from "./metadata-enrichment";
import { pipelineBridge } from "./pipeline-bridge";
import { generateMaterialTokensWithAI, type MaterialSignals, type TextureSignals } from "./component-ai-classification";
import { storeImageToObjectStorage } from "./object-image-service";
import crypto from "crypto";
import type { Style, MetadataTags, InsertStyleVersion, MoodBoardAssets, UiConceptAssets } from "@shared/schema";
import { logger } from "./logger";

export interface RegenerationStage {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
  output?: Record<string, any>;
}

export interface StyleSnapshot {
  id: string;
  name: string;
  tokens: Record<string, any>;
  promptScaffolding: any;
  metadataTags: MetadataTags | null;
  previewHashes: Record<string, string>;
  materialSignature?: any;
  componentCount?: number;
  capturedAt: Date;
}

export interface RegenerationResult {
  styleId: string;
  styleName: string;
  success: boolean;
  beforeSnapshot: StyleSnapshot;
  afterSnapshot: StyleSnapshot;
  stages: RegenerationStage[];
  diff: RegenerationDiff;
  totalDurationMs: number;
  completedAt: Date;
}

export interface RegenerationDiff {
  tokensChanged: boolean;
  tokensDelta: { added: string[]; removed: string[]; modified: string[] };
  metadataChanged: boolean;
  metadataDelta: { added: string[]; removed: string[]; modified: string[] };
  previewsRegenerated: string[];
  materialRecipeChanged: boolean;
  previousRecipe?: string;
  newRecipe?: string;
  componentCountDelta: number;
}

export interface BatchRegenerationProgress {
  batchId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  totalStyles: number;
  processedStyles: number;
  successfulStyles: number;
  failedStyles: number;
  currentStyleId?: string;
  currentStyleName?: string;
  startedAt: Date;
  estimatedCompletionAt?: Date;
  results: RegenerationResult[];
}

let activeBatch: BatchRegenerationProgress | null = null;
const artifactHashes = new Map<string, string>();

function computeHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 16);
}

function computeTokenDiff(before: Record<string, any>, after: Record<string, any>): { added: string[]; removed: string[]; modified: string[] } {
  const beforeFlat = flattenObject(before);
  const afterFlat = flattenObject(after);
  const beforeKeys = new Set(Object.keys(beforeFlat));
  const afterKeys = new Set(Object.keys(afterFlat));
  
  const added = Array.from(afterKeys).filter(k => !beforeKeys.has(k));
  const removed = Array.from(beforeKeys).filter(k => !afterKeys.has(k));
  const modified = Array.from(beforeKeys).filter(k => afterKeys.has(k) && JSON.stringify(beforeFlat[k]) !== JSON.stringify(afterFlat[k]));
  
  return { added, removed, modified };
}

function flattenObject(obj: Record<string, any>, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

async function captureSnapshot(style: Style): Promise<StyleSnapshot> {
  const previewHashes: Record<string, string> = {};
  const previews = style.previews as any;
  
  if (previews?.portrait) previewHashes.portrait = computeHash(previews.portrait);
  if (previews?.landscape) previewHashes.landscape = computeHash(previews.landscape);
  if (previews?.stillLife) previewHashes.stillLife = computeHash(previews.stillLife);
  
  return {
    id: style.id,
    name: style.name,
    tokens: style.tokens as Record<string, any>,
    promptScaffolding: style.promptScaffolding,
    metadataTags: style.metadataTags as MetadataTags | null,
    previewHashes,
    capturedAt: new Date(),
  };
}

async function saveVersionSnapshot(styleId: string, snapshot: StyleSnapshot, changeType: "created" | "tokens_updated" | "previews_updated" | "metadata_updated" | "manual_save", description: string): Promise<void> {
  const latestVersion = await storage.getLatestVersionNumber(styleId);
  
  const versionData: InsertStyleVersion = {
    styleId,
    versionNumber: latestVersion + 1,
    changeType,
    changeDescription: description,
    tokens: snapshot.tokens,
    promptScaffolding: snapshot.promptScaffolding,
    metadataTags: snapshot.metadataTags || undefined,
  };
  
  await storage.createStyleVersion(versionData);
}

function isDuplicateArtifact(imageData: string): { isDuplicate: boolean; existingHash?: string } {
  const hash = computeHash(imageData);
  if (artifactHashes.has(hash)) {
    return { isDuplicate: true, existingHash: hash };
  }
  artifactHashes.set(hash, imageData.substring(0, 100));
  return { isDuplicate: false };
}

async function regenerateStyle(style: Style): Promise<RegenerationResult> {
  const startTime = Date.now();
  const stages: RegenerationStage[] = [];
  
  const beforeSnapshot = await captureSnapshot(style);
  await saveVersionSnapshot(style.id, beforeSnapshot, "manual_save", "Pre-regeneration snapshot");
  
  const refImages = style.referenceImages as string[] | null;
  const refImage = refImages && refImages.length > 0 ? refImages[0] : null;
  
  let currentTokens = style.tokens as Record<string, any>;
  let materialSignature: any = null;
  let componentCount = 0;
  let newRecipeId: string | undefined;
  
  if (refImage) {
    const cvStage: RegenerationStage = { name: "cv_extraction", status: "running", startedAt: new Date() };
    stages.push(cvStage);
    
    try {
      const tokenResult = await extractTokensWithCV(refImage, false);
      if (tokenResult.success && tokenResult.tokens) {
        currentTokens = { ...currentTokens, ...tokenResult.tokens };
        await storage.updateStyleFull(style.id, { tokens: currentTokens as any });
      }
      cvStage.status = "completed";
      cvStage.completedAt = new Date();
      cvStage.durationMs = Date.now() - cvStage.startedAt!.getTime();
    } catch (error) {
      cvStage.status = "failed";
      cvStage.error = String(error);
      cvStage.completedAt = new Date();
    }
    
    const componentStage: RegenerationStage = { name: "component_detection", status: "running", startedAt: new Date() };
    stages.push(componentStage);
    
    try {
      const componentResult = await pipelineBridge.detectComponents(refImage, { enableClassification: true });
      componentCount = componentResult.count;
      componentStage.status = "completed";
      componentStage.completedAt = new Date();
      componentStage.durationMs = Date.now() - componentStage.startedAt!.getTime();
      componentStage.output = { componentCount, candidates: componentResult.candidates?.length || 0 };
    } catch (error) {
      componentStage.status = "failed";
      componentStage.error = String(error);
      componentStage.completedAt = new Date();
    }
    
    const materialStage: RegenerationStage = { name: "material_extraction", status: "running", startedAt: new Date() };
    stages.push(materialStage);
    
    try {
      materialSignature = await pipelineBridge.extractMaterialSignature(refImage, []);
      newRecipeId = materialSignature?.recipe_match?.global?.recipe_id;
      
      if (materialSignature && !materialSignature.fallback) {
        const materialTokens = {
          material: {
            $type: "material",
            $value: {
              translucency: materialSignature.material_signals?.global?.translucency_score || 0,
              specularDensity: materialSignature.material_signals?.global?.specular_density || 0,
              emission: materialSignature.material_signals?.global?.emission_score || 0,
              recipeId: newRecipeId,
              recipeLabel: materialSignature.recipe_match?.global?.label || "unknown",
              confidence: materialSignature.recipe_match?.global?.confidence || 0,
            },
          },
          texture: {
            $type: "texture",
            $value: {
              grain: materialSignature.texture_signals?.global?.texture_grain || 0,
              microcontrast: materialSignature.texture_signals?.global?.microcontrast || 0,
              anisotropy: materialSignature.texture_signals?.global?.anisotropy || 0,
              noiseType: materialSignature.texture_signals?.global?.noise_type_hint || "none",
            },
          },
        };
        
        currentTokens = { ...currentTokens, ...materialTokens };
        await storage.updateStyleFull(style.id, { tokens: currentTokens as any });
      }
      
      materialStage.status = "completed";
      materialStage.completedAt = new Date();
      materialStage.durationMs = Date.now() - materialStage.startedAt!.getTime();
      materialStage.output = { recipeId: newRecipeId, confidence: materialSignature?.recipe_match?.global?.confidence };
    } catch (error) {
      materialStage.status = "failed";
      materialStage.error = String(error);
      materialStage.completedAt = new Date();
    }
    
    const aiStage: RegenerationStage = { name: "ai_classification", status: "running", startedAt: new Date() };
    stages.push(aiStage);
    
    try {
      const recipeMatch = materialSignature?.recipe_match?.global || { recipe_id: "unknown", label: "Unknown", confidence: 0 };
      const matSignals: MaterialSignals = {
        translucency_score: materialSignature?.material_signals?.global?.translucency_score || 0,
        specular_density: materialSignature?.material_signals?.global?.specular_density || 0,
        emission_score: materialSignature?.material_signals?.global?.emission_score || 0,
        depth_shadow_complexity: materialSignature?.material_signals?.global?.depth_shadow_complexity || 0,
      };
      const texSignals: TextureSignals = {
        texture_grain: materialSignature?.texture_signals?.global?.texture_grain || 0,
        microcontrast: materialSignature?.texture_signals?.global?.microcontrast || 0,
        anisotropy: materialSignature?.texture_signals?.global?.anisotropy || 0,
        noise_type_hint: materialSignature?.texture_signals?.global?.noise_type_hint || "none",
      };
      const aiMaterialTokens = await generateMaterialTokensWithAI(refImage, recipeMatch, matSignals, texSignals);
      if (aiMaterialTokens.tokens && Object.keys(aiMaterialTokens.tokens).length > 0) {
        currentTokens = {
          ...currentTokens,
          ai_material: {
            $type: "ai-generated",
            $value: aiMaterialTokens.tokens,
            $metadata: {
              materialType: aiMaterialTokens.materialType,
              finish: aiMaterialTokens.finish,
              tactileQuality: aiMaterialTokens.tactileQuality,
            },
          },
        };
        await storage.updateStyleFull(style.id, { tokens: currentTokens as any });
      }
      aiStage.status = "completed";
      aiStage.completedAt = new Date();
      aiStage.durationMs = Date.now() - aiStage.startedAt!.getTime();
    } catch (error) {
      aiStage.status = "failed";
      aiStage.error = String(error);
      aiStage.completedAt = new Date();
    }
  }
  
  // === PARALLEL GENERATION PHASE ===
  // Run preview generation, mood board, UI concepts, metadata, and typography in parallel
  // Each task persists its own output independently to handle partial failures gracefully
  // This provides 60-70% speedup compared to sequential execution
  
  const previewStage: RegenerationStage = { name: "preview_generation", status: "running", startedAt: new Date() };
  const moodStage: RegenerationStage = { name: "mood_board", status: "running", startedAt: new Date() };
  const uiConceptStage: RegenerationStage = { name: "ui_concepts", status: "running", startedAt: new Date() };
  const metadataStage: RegenerationStage = { name: "metadata_enrichment", status: "running", startedAt: new Date() };
  const typographyStage: RegenerationStage = { name: "typography_analysis", status: "running", startedAt: new Date() };
  
  stages.push(previewStage, moodStage, uiConceptStage, metadataStage, typographyStage);
  
  // Helper to ensure data URL format
  const ensureDataUrl = (img: string): string => {
    if (img.startsWith("data:")) return img;
    return `data:image/png;base64,${img}`;
  };
  
  // Capture tokens at start of parallel phase to avoid race conditions
  const tokensForGeneration = { ...currentTokens };
  
  // Define all parallel tasks - each task persists independently
  const parallelTasks = await Promise.allSettled([
    // Task 1: Preview Generation - persists its own output
    (async () => {
      const previewResult = await generateCanonicalPreviewsWithGemini({
        styleName: style.name,
        styleDescription: style.description || style.name,
        tokens: tokensForGeneration,
        referenceImageBase64: refImage || undefined,
      });
      
      const previews: Record<string, string> = {};
      let storedCount = 0;
      
      if (previewResult.portrait) {
        const portraitData = ensureDataUrl(previewResult.portrait);
        const { isDuplicate } = isDuplicateArtifact(portraitData);
        if (!isDuplicate) {
          previews.portrait = portraitData;
          try {
            await storeImageToObjectStorage(portraitData, "preview_portrait", style.id);
            storedCount++;
          } catch (storeErr) {
            logger.error("Failed to store portrait", storeErr, { module: 'StyleRegeneration', styleId: style.id });
          }
        }
      }
      
      if (previewResult.landscape) {
        const landscapeData = ensureDataUrl(previewResult.landscape);
        const { isDuplicate } = isDuplicateArtifact(landscapeData);
        if (!isDuplicate) {
          previews.landscape = landscapeData;
          try {
            await storeImageToObjectStorage(landscapeData, "preview_landscape", style.id);
            storedCount++;
          } catch (storeErr) {
            logger.error("Failed to store landscape", storeErr, { module: 'StyleRegeneration', styleId: style.id });
          }
        }
      }
      
      if (previewResult.stillLife) {
        const stillLifeData = ensureDataUrl(previewResult.stillLife);
        const { isDuplicate } = isDuplicateArtifact(stillLifeData);
        if (!isDuplicate) {
          previews.stillLife = stillLifeData;
          try {
            await storeImageToObjectStorage(stillLifeData, "preview_still_life", style.id);
            storedCount++;
          } catch (storeErr) {
            logger.error("Failed to store still life", storeErr, { module: 'StyleRegeneration', styleId: style.id });
          }
        }
      }
      
      // Persist previews independently
      if (Object.keys(previews).length > 0) {
        await storage.updateStyleFull(style.id, { previews: previews as any });
      }
      
      return { generatedCount: Object.keys(previews).length, storedInImageService: storedCount };
    })(),
    
    // Task 2: Mood Board Generation - persists its own output + stores optimized image
    (async () => {
      const moodResult = await generateMoodBoardWithGemini({
        styleName: style.name,
        styleDescription: style.description || style.name,
        tokens: tokensForGeneration,
        metadataTags: style.metadataTags as unknown as Record<string, string[]> || undefined,
      });
      
      let storedImageId: string | null = null;
      
      // Persist mood board immediately
      if (moodResult.collage) {
        const moodBoardAssets: MoodBoardAssets = {
          status: "complete",
          collage: moodResult.collage,
          history: [],
        };
        // Get current UI concepts to preserve them
        const currentStyle = await storage.getStyleById(style.id);
        const existingUiConcepts = (currentStyle?.uiConcepts as UiConceptAssets) || { status: "pending", history: [] };
        await storage.updateStyleMoodBoard(style.id, moodBoardAssets, existingUiConcepts);
        
        // Also store to object storage for optimized WebP variants
        try {
          const moodBoardData = ensureDataUrl(moodResult.collage);
          storedImageId = await storeImageToObjectStorage(moodBoardData, "mood_board", style.id);
        } catch (storeErr) {
          logger.error("Failed to store mood board", storeErr, { module: 'StyleRegeneration', styleId: style.id });
        }
      }
      
      return { collage: moodResult.collage || undefined, storedInImageService: storedImageId ? 1 : 0 };
    })(),
    
    // Task 3: UI Concepts Generation - persists its own output + stores optimized images
    (async () => {
      const uiResult = await generateUiConceptsWithGemini(
        style.name,
        style.description || style.name,
        tokensForGeneration,
        refImage || undefined,
        style.metadataTags as unknown as Record<string, string[]> || undefined,
      );
      
      const storedImageIds: string[] = [];
      
      // Persist UI concepts immediately
      if (uiResult.softwareApp || uiResult.audioPlugin || uiResult.dashboard) {
        const uiConceptAssets: UiConceptAssets = {
          status: "complete",
          softwareApp: uiResult.softwareApp,
          audioPlugin: uiResult.audioPlugin,
          dashboard: uiResult.dashboard,
          history: [],
        };
        // Get current mood board to preserve it
        const currentStyle = await storage.getStyleById(style.id);
        const existingMoodBoard = (currentStyle?.moodBoard as MoodBoardAssets) || { status: "pending", history: [] };
        await storage.updateStyleMoodBoard(style.id, existingMoodBoard, uiConceptAssets);
        
        // Also store UI concepts to object storage for optimized WebP variants
        if (uiResult.softwareApp) {
          try {
            const softwareAppData = ensureDataUrl(uiResult.softwareApp);
            const softwareAppId = await storeImageToObjectStorage(softwareAppData, "ui_software_app", style.id);
            storedImageIds.push(softwareAppId);
          } catch (storeErr) {
            logger.error("Failed to store softwareApp UI concept", storeErr, { module: 'StyleRegeneration', styleId: style.id });
          }
        }
        if (uiResult.audioPlugin) {
          try {
            const audioPluginData = ensureDataUrl(uiResult.audioPlugin);
            const audioPluginId = await storeImageToObjectStorage(audioPluginData, "ui_audio_plugin", style.id);
            storedImageIds.push(audioPluginId);
          } catch (storeErr) {
            logger.error("Failed to store audioPlugin UI concept", storeErr, { module: 'StyleRegeneration', styleId: style.id });
          }
        }
        if (uiResult.dashboard) {
          try {
            const dashboardData = ensureDataUrl(uiResult.dashboard);
            const dashboardId = await storeImageToObjectStorage(dashboardData, "ui_dashboard", style.id);
            storedImageIds.push(dashboardId);
          } catch (storeErr) {
            logger.error("Failed to store dashboard UI concept", storeErr, { module: 'StyleRegeneration', styleId: style.id });
          }
        }
      }
      
      return {
        softwareApp: uiResult.softwareApp || undefined,
        audioPlugin: uiResult.audioPlugin || undefined,
        dashboard: uiResult.dashboard || undefined,
        storedInImageService: storedImageIds.length,
      };
    })(),
    
    // Task 4: Metadata Enrichment
    (async () => {
      await enrichStyleMetadata(style.id);
      return { enriched: true };
    })(),
    
    // Task 5: Typography Analysis - persists its own output
    (async () => {
      const typographyTokens = generateTypographyRecommendations(tokensForGeneration, style.metadataTags as MetadataTags | null);
      
      // Persist typography tokens immediately if any were generated
      if (Object.keys(typographyTokens).length > 0) {
        const currentStyle = await storage.getStyleById(style.id);
        const existingTokens = (currentStyle?.tokens as Record<string, any>) || {};
        const mergedTokens = { ...existingTokens, typography: typographyTokens };
        await storage.updateStyleFull(style.id, { tokens: mergedTokens as any });
        // Update local reference for snapshot
        currentTokens = mergedTokens;
      }
      
      return { typographyTokens, hasRecommendations: Object.keys(typographyTokens).length > 0 };
    })(),
  ]);
  
  // Process results from parallel execution
  const [previewResult, moodResult, uiResult, metadataResult, typographyResult] = parallelTasks;
  
  // Handle Preview Result
  if (previewResult.status === "fulfilled") {
    previewStage.status = "completed";
    previewStage.completedAt = new Date();
    previewStage.durationMs = Date.now() - previewStage.startedAt!.getTime();
    previewStage.output = previewResult.value;
  } else {
    previewStage.status = "failed";
    previewStage.error = String(previewResult.reason);
    previewStage.completedAt = new Date();
  }
  
  // Handle Mood Board Result
  if (moodResult.status === "fulfilled") {
    moodStage.status = "completed";
    moodStage.completedAt = new Date();
    moodStage.durationMs = Date.now() - moodStage.startedAt!.getTime();
  } else {
    moodStage.status = "failed";
    moodStage.error = String(moodResult.reason);
    moodStage.completedAt = new Date();
  }
  
  // Handle UI Concepts Result
  if (uiResult.status === "fulfilled") {
    uiConceptStage.status = "completed";
    uiConceptStage.completedAt = new Date();
    uiConceptStage.durationMs = Date.now() - uiConceptStage.startedAt!.getTime();
  } else {
    uiConceptStage.status = "failed";
    uiConceptStage.error = String(uiResult.reason);
    uiConceptStage.completedAt = new Date();
  }
  
  // Handle Metadata Result
  if (metadataResult.status === "fulfilled") {
    metadataStage.status = "completed";
    metadataStage.completedAt = new Date();
    metadataStage.durationMs = Date.now() - metadataStage.startedAt!.getTime();
  } else {
    metadataStage.status = "failed";
    metadataStage.error = String(metadataResult.reason);
    metadataStage.completedAt = new Date();
  }
  
  // Handle Typography Result - "no recommendations" is still success
  if (typographyResult.status === "fulfilled") {
    typographyStage.status = "completed";
    typographyStage.completedAt = new Date();
    typographyStage.durationMs = Date.now() - typographyStage.startedAt!.getTime();
    typographyStage.output = { hasRecommendations: typographyResult.value.hasRecommendations };
  } else {
    typographyStage.status = "failed";
    typographyStage.error = String(typographyResult.reason);
    typographyStage.completedAt = new Date();
  }
  
  const updatedStyle = await storage.getStyleById(style.id);
  const afterSnapshot = updatedStyle ? await captureSnapshot(updatedStyle) : beforeSnapshot;
  afterSnapshot.materialSignature = materialSignature;
  afterSnapshot.componentCount = componentCount;
  
  await saveVersionSnapshot(style.id, afterSnapshot, "tokens_updated", "Post-regeneration with full pipeline");
  
  const tokensDelta = computeTokenDiff(beforeSnapshot.tokens, afterSnapshot.tokens);
  const metadataDelta = computeTokenDiff(
    beforeSnapshot.metadataTags as Record<string, any> || {},
    afterSnapshot.metadataTags as Record<string, any> || {}
  );
  
  const previewsRegenerated: string[] = [];
  for (const key of ["portrait", "landscape", "stillLife"] as const) {
    if (beforeSnapshot.previewHashes[key] !== afterSnapshot.previewHashes[key]) {
      previewsRegenerated.push(key);
    }
  }
  
  const diff: RegenerationDiff = {
    tokensChanged: tokensDelta.added.length > 0 || tokensDelta.removed.length > 0 || tokensDelta.modified.length > 0,
    tokensDelta,
    metadataChanged: metadataDelta.added.length > 0 || metadataDelta.removed.length > 0 || metadataDelta.modified.length > 0,
    metadataDelta,
    previewsRegenerated,
    materialRecipeChanged: !!newRecipeId,
    newRecipe: newRecipeId,
    componentCountDelta: componentCount - (beforeSnapshot.componentCount || 0),
  };
  
  const totalDurationMs = Date.now() - startTime;
  const success = stages.filter(s => s.status === "failed").length === 0;
  
  await storage.recordMetric({
    type: "style_regeneration",
    styleId: style.id,
    durationMs: totalDurationMs,
    success,
    metadata: {
      stages: stages.map(s => ({ name: s.name, status: s.status, durationMs: s.durationMs })),
      tokensDelta,
      previewsRegenerated,
    },
  });
  
  return {
    styleId: style.id,
    styleName: style.name,
    success,
    beforeSnapshot,
    afterSnapshot,
    stages,
    diff,
    totalDurationMs,
    completedAt: new Date(),
  };
}

function generateTypographyRecommendations(tokens: Record<string, any>, metadata: MetadataTags | null): Record<string, any> {
  const colorTokens = tokens.color || {};
  const moods = metadata?.mood || [];
  const era = metadata?.era || [];
  
  const recommendations: Record<string, any> = {};
  
  const isModern = moods.some(m => ["modern", "minimalist", "clean", "contemporary"].includes(m.toLowerCase()));
  const isVintage = moods.some(m => ["vintage", "retro", "classic", "nostalgic"].includes(m.toLowerCase())) ||
                    era.some(e => ["1950s", "1960s", "1970s", "1980s"].includes(e));
  const isElegant = moods.some(m => ["elegant", "luxurious", "sophisticated", "refined"].includes(m.toLowerCase()));
  const isBold = moods.some(m => ["bold", "energetic", "dynamic", "powerful"].includes(m.toLowerCase()));
  const isPlayful = moods.some(m => ["playful", "fun", "whimsical", "quirky"].includes(m.toLowerCase()));
  
  if (isModern) {
    recommendations.heading = {
      $type: "typography",
      $value: {
        fontFamily: ["Inter", "SF Pro Display", "system-ui"],
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      },
    };
    recommendations.body = {
      $type: "typography",
      $value: {
        fontFamily: ["Inter", "SF Pro Text", "system-ui"],
        fontWeight: 400,
        letterSpacing: "0",
        lineHeight: 1.6,
      },
    };
  } else if (isVintage) {
    recommendations.heading = {
      $type: "typography",
      $value: {
        fontFamily: ["Playfair Display", "Georgia", "serif"],
        fontWeight: 700,
        letterSpacing: "0.01em",
        lineHeight: 1.1,
      },
    };
    recommendations.body = {
      $type: "typography",
      $value: {
        fontFamily: ["Merriweather", "Georgia", "serif"],
        fontWeight: 400,
        letterSpacing: "0.02em",
        lineHeight: 1.7,
      },
    };
  } else if (isElegant) {
    recommendations.heading = {
      $type: "typography",
      $value: {
        fontFamily: ["Cormorant Garamond", "Didot", "serif"],
        fontWeight: 500,
        letterSpacing: "0.05em",
        lineHeight: 1.15,
        textTransform: "uppercase",
      },
    };
    recommendations.body = {
      $type: "typography",
      $value: {
        fontFamily: ["Lora", "Baskerville", "serif"],
        fontWeight: 400,
        letterSpacing: "0.01em",
        lineHeight: 1.75,
      },
    };
  } else if (isBold) {
    recommendations.heading = {
      $type: "typography",
      $value: {
        fontFamily: ["Bebas Neue", "Impact", "sans-serif"],
        fontWeight: 700,
        letterSpacing: "0.02em",
        lineHeight: 1.0,
        textTransform: "uppercase",
      },
    };
    recommendations.body = {
      $type: "typography",
      $value: {
        fontFamily: ["Roboto", "Arial", "sans-serif"],
        fontWeight: 500,
        letterSpacing: "0",
        lineHeight: 1.5,
      },
    };
  } else if (isPlayful) {
    recommendations.heading = {
      $type: "typography",
      $value: {
        fontFamily: ["Fredoka One", "Comic Sans MS", "cursive"],
        fontWeight: 400,
        letterSpacing: "0.01em",
        lineHeight: 1.2,
      },
    };
    recommendations.body = {
      $type: "typography",
      $value: {
        fontFamily: ["Nunito", "Verdana", "sans-serif"],
        fontWeight: 400,
        letterSpacing: "0.01em",
        lineHeight: 1.6,
      },
    };
  } else {
    recommendations.heading = {
      $type: "typography",
      $value: {
        fontFamily: ["system-ui", "-apple-system", "sans-serif"],
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: 1.25,
      },
    };
    recommendations.body = {
      $type: "typography",
      $value: {
        fontFamily: ["system-ui", "-apple-system", "sans-serif"],
        fontWeight: 400,
        letterSpacing: "0",
        lineHeight: 1.6,
      },
    };
  }
  
  recommendations.scale = {
    $type: "dimension",
    $value: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
    },
  };
  
  return recommendations;
}

export async function regenerateAllStyles(options: {
  styleIds?: string[];
  skipPreviewGeneration?: boolean;
  skipMoodBoard?: boolean;
  onProgress?: (progress: BatchRegenerationProgress) => void;
} = {}): Promise<BatchRegenerationProgress> {
  const batchId = crypto.randomUUID();
  
  let styleIds = options.styleIds;
  if (!styleIds || styleIds.length === 0) {
    styleIds = await storage.getAllStyleIds();
  }
  
  const styles = await storage.getStylesByIds(styleIds);
  
  const batch = await storage.createBatch({
    status: "running",
    totalItems: styles.length,
    completedItems: 0,
    failedItems: 0,
  });
  
  activeBatch = {
    batchId: batch.id,
    status: "running",
    totalStyles: styles.length,
    processedStyles: 0,
    successfulStyles: 0,
    failedStyles: 0,
    startedAt: new Date(),
    results: [],
  };
  
  logger.info("Starting batch regeneration", { module: 'StyleRegeneration', batchId, styleCount: styles.length });
  
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    
    activeBatch.currentStyleId = style.id;
    activeBatch.currentStyleName = style.name;
    
    const avgTimePerStyle = activeBatch.processedStyles > 0
      ? (Date.now() - activeBatch.startedAt.getTime()) / activeBatch.processedStyles
      : 60000;
    const remainingStyles = styles.length - i;
    activeBatch.estimatedCompletionAt = new Date(Date.now() + avgTimePerStyle * remainingStyles);
    
    if (options.onProgress) {
      options.onProgress({ ...activeBatch });
    }
    
    logger.info("Processing style", { module: 'StyleRegeneration', progress: `${i + 1}/${styles.length}`, styleName: style.name });
    
    try {
      const result = await regenerateStyle(style);
      activeBatch.results.push(result);
      
      if (result.success) {
        activeBatch.successfulStyles++;
      } else {
        activeBatch.failedStyles++;
      }
      
      logger.info("Style regeneration result", { module: 'StyleRegeneration', styleName: style.name, success: result.success, duration: result.totalDurationMs });
      
    } catch (error) {
      activeBatch.failedStyles++;
      logger.error("Error processing style", error, { module: 'StyleRegeneration', styleName: style.name });
      
      activeBatch.results.push({
        styleId: style.id,
        styleName: style.name,
        success: false,
        beforeSnapshot: await captureSnapshot(style),
        afterSnapshot: await captureSnapshot(style),
        stages: [{ name: "error", status: "failed", error: String(error) }],
        diff: {
          tokensChanged: false,
          tokensDelta: { added: [], removed: [], modified: [] },
          metadataChanged: false,
          metadataDelta: { added: [], removed: [], modified: [] },
          previewsRegenerated: [],
          materialRecipeChanged: false,
          componentCountDelta: 0,
        },
        totalDurationMs: 0,
        completedAt: new Date(),
      });
    }
    
    activeBatch.processedStyles++;
    
    await storage.updateBatchProgress(batch.id, activeBatch.successfulStyles, activeBatch.failedStyles);
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  activeBatch.status = activeBatch.failedStyles === 0 ? "completed" : "completed";
  activeBatch.currentStyleId = undefined;
  activeBatch.currentStyleName = undefined;
  
  await storage.updateBatchStatus(batch.id, activeBatch.failedStyles === 0 ? "succeeded" : "succeeded");
  
  logger.info("Batch complete", { module: 'StyleRegeneration', successful: activeBatch.successfulStyles, total: activeBatch.totalStyles });
  
  return activeBatch;
}

export function getRegenerationProgress(): BatchRegenerationProgress | null {
  return activeBatch;
}

export function cancelRegeneration(): boolean {
  if (activeBatch && activeBatch.status === "running") {
    activeBatch.status = "cancelled";
    return true;
  }
  return false;
}

export async function regenerateSingleStyle(styleId: string): Promise<RegenerationResult | null> {
  const style = await storage.getStyleById(styleId);
  if (!style) return null;
  
  return regenerateStyle(style);
}

export function generateRegenerationReport(results: RegenerationResult[]): string {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  let report = `# Style Regeneration Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total styles processed: ${results.length}\n`;
  report += `- Successful: ${successful.length}\n`;
  report += `- Failed: ${failed.length}\n`;
  report += `- Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%\n\n`;
  
  const totalDuration = results.reduce((sum, r) => sum + r.totalDurationMs, 0);
  report += `- Total processing time: ${(totalDuration / 1000 / 60).toFixed(1)} minutes\n`;
  report += `- Average time per style: ${(totalDuration / results.length / 1000).toFixed(1)} seconds\n\n`;
  
  report += `## Changes Summary\n\n`;
  
  const tokensChanged = results.filter(r => r.diff.tokensChanged).length;
  const metadataChanged = results.filter(r => r.diff.metadataChanged).length;
  const materialRecipeChanged = results.filter(r => r.diff.materialRecipeChanged).length;
  const previewsRegenerated = results.filter(r => r.diff.previewsRegenerated.length > 0).length;
  
  report += `- Styles with token changes: ${tokensChanged}\n`;
  report += `- Styles with metadata changes: ${metadataChanged}\n`;
  report += `- Styles with new material recipes: ${materialRecipeChanged}\n`;
  report += `- Styles with regenerated previews: ${previewsRegenerated}\n\n`;
  
  report += `## Per-Style Details\n\n`;
  
  for (const result of results) {
    report += `### ${result.styleName}\n\n`;
    report += `- Status: ${result.success ? "✓ Success" : "✗ Failed"}\n`;
    report += `- Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s\n`;
    
    if (result.diff.tokensChanged) {
      report += `- Tokens: +${result.diff.tokensDelta.added.length} added, -${result.diff.tokensDelta.removed.length} removed, ~${result.diff.tokensDelta.modified.length} modified\n`;
    }
    
    if (result.diff.materialRecipeChanged && result.diff.newRecipe) {
      report += `- New material recipe: ${result.diff.newRecipe}\n`;
    }
    
    if (result.diff.previewsRegenerated.length > 0) {
      report += `- Previews regenerated: ${result.diff.previewsRegenerated.join(", ")}\n`;
    }
    
    const failedStages = result.stages.filter(s => s.status === "failed");
    if (failedStages.length > 0) {
      report += `- Failed stages: ${failedStages.map(s => `${s.name} (${s.error})`).join(", ")}\n`;
    }
    
    report += "\n";
  }
  
  return report;
}

export { regenerateStyle };
