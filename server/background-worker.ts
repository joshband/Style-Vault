import { storage } from "./storage";
import { startJobInBackground } from "./job-runner";
import { generateAllMoodBoardAssets } from "./mood-board-generation";
import { analyzeImageForStyle } from "./analysis";
import type { Style, MoodBoardAssets, UiConceptAssets, MetadataTags, JobType } from "@shared/schema";
import { cache, CACHE_KEYS } from "./cache";
import { getPLimit } from "./utils/esm-interop";

const SCHEDULER_INTERVAL_MS = 60000;
const MAX_CONCURRENT_BACKGROUND_JOBS = 2;

let backgroundLimit: Awaited<ReturnType<typeof getPLimit>> | null = null;
let schedulerRunning = false;

async function getBackgroundLimit() {
  if (!backgroundLimit) {
    backgroundLimit = await getPLimit(MAX_CONCURRENT_BACKGROUND_JOBS);
  }
  return backgroundLimit;
}

export async function repairStyleName(styleId: string): Promise<string | null> {
  const style = await storage.getStyleById(styleId);
  if (!style) return null;

  const referenceImages = style.referenceImages as string[] | null;
  const referenceImage = referenceImages?.[0];
  if (!referenceImage) {
    console.log(`[BackgroundWorker] Style ${styleId} has no reference image for name repair`);
    return null;
  }

  try {
    console.log(`[BackgroundWorker] Repairing name for style ${styleId}`);
    
    const base64Data = referenceImage.split(",")[1] || referenceImage;
    const analysis = await analyzeImageForStyle(base64Data);
    
    if (analysis.styleName && analysis.styleName !== style.name) {
      await storage.updateStyleName(styleId, analysis.styleName);
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      console.log(`[BackgroundWorker] Repaired name for style ${styleId}: "${style.name}" -> "${analysis.styleName}"`);
      return analysis.styleName;
    }
    
    return style.name;
  } catch (error) {
    console.error(`[BackgroundWorker] Failed to repair name for style ${styleId}:`, error);
    return null;
  }
}

export async function generateMissingAssets(styleId: string): Promise<boolean> {
  const style = await storage.getStyleById(styleId);
  if (!style) return false;

  const moodBoard = style.moodBoard as MoodBoardAssets | null;
  const uiConcepts = style.uiConcepts as UiConceptAssets | null;
  
  let uiConceptCount = 0;
  if (uiConcepts?.audioPlugin) uiConceptCount++;
  if (uiConcepts?.dashboard) uiConceptCount++;
  if (uiConcepts?.componentLibrary) uiConceptCount++;

  const needsMoodBoard = !moodBoard || moodBoard.status !== "complete" || !moodBoard.collage;
  const needsUiConcepts = !uiConcepts || uiConcepts.status !== "complete" || uiConceptCount < 2;

  if (!needsMoodBoard && !needsUiConcepts) {
    console.log(`[BackgroundWorker] Style ${styleId} already has all assets`);
    return true;
  }

  console.log(`[BackgroundWorker] Generating missing assets for style ${styleId} (moodBoard: ${needsMoodBoard}, uiConcepts: ${needsUiConcepts})`);

  try {
    const metadataTags = (style.metadataTags || {
      mood: [],
      colorFamily: [],
      lighting: [],
      texture: [],
      era: [],
      artPeriod: [],
      historicalInfluences: [],
      similarArtists: [],
      medium: [],
      subjects: [],
      usageExamples: [],
      narrativeTone: [],
      sensoryPalette: [],
      movementRhythm: [],
      stylisticPrinciples: [],
      signatureMotifs: [],
      contrastDynamics: [],
      psychologicalEffect: [],
      culturalResonance: [],
      audiencePerception: [],
      keywords: [],
    }) as MetadataTags;

    const refImages = style.referenceImages as string[] | null;
    const referenceImageBase64 = refImages?.[0]?.split(",")[1];

    const result = await generateAllMoodBoardAssets({
      styleName: style.name,
      styleDescription: style.description,
      tokens: style.tokens as Record<string, any>,
      metadataTags,
      referenceImageBase64,
    });

    const hasNewMoodBoard = result.moodBoard?.collage;
    const hasNewUiConcepts = result.uiConcepts?.audioPlugin || result.uiConcepts?.dashboard;
    
    if (hasNewMoodBoard || hasNewUiConcepts) {
      const currentMoodBoard = style.moodBoard as MoodBoardAssets | null;
      const currentUiConcepts = style.uiConcepts as UiConceptAssets | null;

      const updatedMoodBoard: MoodBoardAssets = {
        status: result.moodBoard?.status || currentMoodBoard?.status || "pending",
        collage: result.moodBoard?.collage || currentMoodBoard?.collage,
        history: [
          ...(currentMoodBoard?.history || []),
          ...(result.moodBoard?.collage ? [{ collage: result.moodBoard.collage, generatedAt: new Date().toISOString() }] : []),
        ],
      };

      const updatedUiConcepts: UiConceptAssets = {
        status: result.uiConcepts?.status || currentUiConcepts?.status || "pending",
        audioPlugin: result.uiConcepts?.audioPlugin || currentUiConcepts?.audioPlugin,
        dashboard: result.uiConcepts?.dashboard || currentUiConcepts?.dashboard,
        componentLibrary: result.uiConcepts?.componentLibrary || currentUiConcepts?.componentLibrary,
        history: [
          ...(currentUiConcepts?.history || []),
          ...(hasNewUiConcepts ? [{
            audioPlugin: result.uiConcepts?.audioPlugin,
            dashboard: result.uiConcepts?.dashboard,
            componentLibrary: result.uiConcepts?.componentLibrary,
            generatedAt: new Date().toISOString(),
          }] : []),
        ],
      };

      await storage.updateStyleMoodBoard(styleId, updatedMoodBoard, updatedUiConcepts);
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      
      console.log(`[BackgroundWorker] Generated assets for style ${styleId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[BackgroundWorker] Failed to generate assets for style ${styleId}:`, error);
    return false;
  }
}

async function runSchedulerCycle(): Promise<void> {
  console.log("[BackgroundWorker] Running scheduler cycle...");

  try {
    const stylesWithBadNames = await storage.getStylesWithUuidNames();
    console.log(`[BackgroundWorker] Found ${stylesWithBadNames.length} styles with UUID-like names`);

    for (const style of stylesWithBadNames) {
      const hasActiveJob = await storage.hasActiveJobForStyle(style.id, ["style_name_repair"]);
      if (!hasActiveJob) {
        await startJobInBackground(
          "style_name_repair",
          { styleId: style.id },
          async (input, onProgress) => {
            await onProgress(10, "Analyzing image for style name...");
            const limit = await getBackgroundLimit();
            const newName = await limit(() => repairStyleName(input.styleId));
            await onProgress(100, newName ? `Renamed to: ${newName}` : "Name unchanged");
            return { newName };
          },
          { maxRetries: 2, timeoutMs: 60000 },
          style.id
        );
      }
    }

    const stylesNeedingAssets = await storage.getStylesNeedingAssets();
    console.log(`[BackgroundWorker] Found ${stylesNeedingAssets.length} styles needing asset generation`);

    for (const style of stylesNeedingAssets) {
      const hasActiveJob = await storage.hasActiveJobForStyle(style.id, [
        "background_asset_generation",
        "mood_board_generation",
        "ui_concepts_generation"
      ]);
      
      if (!hasActiveJob) {
        await startJobInBackground(
          "background_asset_generation",
          { styleId: style.id },
          async (input, onProgress) => {
            await onProgress(10, "Starting asset generation...");
            const limit = await getBackgroundLimit();
            const success = await limit(() => generateMissingAssets(input.styleId));
            await onProgress(100, success ? "Assets generated" : "Generation failed");
            return { success };
          },
          { maxRetries: 2, timeoutMs: 180000 },
          style.id
        );
      }
    }

    console.log("[BackgroundWorker] Scheduler cycle complete");
  } catch (error) {
    console.error("[BackgroundWorker] Scheduler cycle error:", error);
  }
}

export function startBackgroundScheduler(): void {
  if (schedulerRunning) {
    console.log("[BackgroundWorker] Scheduler already running");
    return;
  }

  schedulerRunning = true;
  console.log("[BackgroundWorker] Starting background scheduler");

  setTimeout(() => {
    runSchedulerCycle();
  }, 5000);

  setInterval(() => {
    runSchedulerCycle();
  }, SCHEDULER_INTERVAL_MS);
}

export function stopBackgroundScheduler(): void {
  schedulerRunning = false;
  console.log("[BackgroundWorker] Background scheduler stopped");
}
