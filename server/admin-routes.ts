import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { cache, CACHE_KEYS } from "./cache";
import type { MetricType, InsertAdminMetric, Style, MoodBoardAssets, UiConceptAssets } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";

type ImageType = "reference" | "previews" | "mood_board" | "ui_concepts" | "all";

interface RegenerateImagesRequest {
  styleIds?: string[];
  styleNames?: string[];
  imageTypes: ImageType[];
}

interface RegenerateFullRequest {
  styleIds?: string[];
  styleNames?: string[];
  includeTokens?: boolean;
  includeMetadata?: boolean;
  includePreviews?: boolean;
  includeMoodBoard?: boolean;
  includeUiConcepts?: boolean;
}

const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(",").map(s => s.trim()) || [];

async function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const user = req.user as { id: string } | undefined;
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  // Check if admin restriction is enabled via feature toggle
  const adminRestrictionToggle = await storage.getFeatureToggle("admin_restricted_access");
  const isRestricted = adminRestrictionToggle?.enabled ?? false;
  
  // If restricted mode is enabled, check against ADMIN_USER_IDS
  if (isRestricted && ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(user.id)) {
    return res.status(403).json({ error: "Admin access required. Your user ID is not in the allowed list." });
  }
  
  // If not restricted, allow all authenticated users
  next();
}

export function registerAdminRoutes(app: Express) {
  
  // ==================== STATS ENDPOINT ====================
  
  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const styles: Style[] = await storage.getStyles();
      
      const totalStyles = styles.length;
      const publicStyles = styles.filter((s: Style) => s.isPublic).length;
      const privateStyles = totalStyles - publicStyles;
      const pendingEnrichment = styles.filter((s: Style) => s.metadataEnrichmentStatus === "pending").length;
      
      let completedMoodBoards = 0;
      let completedUiConcepts = 0;
      
      for (const style of styles) {
        const moodBoard = style.moodBoard as { status?: string } | null;
        const uiConcepts = style.uiConcepts as { status?: string } | null;
        if (moodBoard?.status === "complete") completedMoodBoards++;
        if (uiConcepts?.status === "complete") completedUiConcepts++;
      }
      
      res.json({
        totalStyles,
        publicStyles,
        privateStyles,
        pendingEnrichment,
        completedMoodBoards,
        completedUiConcepts,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  
  // ==================== METRICS ENDPOINTS ====================
  
  // Get metrics summary
  app.get("/api/admin/metrics/summary", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const summary = await storage.getMetricsSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching metrics summary:", error);
      res.status(500).json({ error: "Failed to fetch metrics summary" });
    }
  });

  // Get detailed metrics with filtering
  app.get("/api/admin/metrics", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const type = req.query.type as MetricType | undefined;
      const styleId = req.query.styleId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const since = req.query.since ? new Date(req.query.since as string) : undefined;

      const metrics = await storage.getMetrics({ type, styleId, limit, since });
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Record a metric (internal use)
  app.post("/api/admin/metrics", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const metric = req.body as InsertAdminMetric;
      const created = await storage.recordMetric(metric);
      res.json(created);
    } catch (error) {
      console.error("Error recording metric:", error);
      res.status(500).json({ error: "Failed to record metric" });
    }
  });

  // ==================== FEATURE TOGGLES ====================
  
  // Get all feature toggles
  app.get("/api/admin/features", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const toggles = await storage.getAllFeatureToggles();
      res.json(toggles);
    } catch (error) {
      console.error("Error fetching feature toggles:", error);
      res.status(500).json({ error: "Failed to fetch feature toggles" });
    }
  });

  // Get a specific feature toggle
  app.get("/api/admin/features/:key", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const toggle = await storage.getFeatureToggle(req.params.key);
      if (!toggle) {
        return res.status(404).json({ error: "Feature toggle not found" });
      }
      res.json(toggle);
    } catch (error) {
      console.error("Error fetching feature toggle:", error);
      res.status(500).json({ error: "Failed to fetch feature toggle" });
    }
  });

  // Update a feature toggle
  app.put("/api/admin/features/:key", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { enabled, value } = req.body;
      const toggle = await storage.setFeatureToggle(req.params.key, enabled, value);
      res.json(toggle);
    } catch (error) {
      console.error("Error updating feature toggle:", error);
      res.status(500).json({ error: "Failed to update feature toggle" });
    }
  });

  // ==================== STYLE MANAGEMENT ====================
  
  // Get all styles with full data for admin
  app.get("/api/admin/styles", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const allStyles = await storage.getStyles();
      const summary = allStyles.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        isPublic: s.isPublic,
        creatorId: s.creatorId,
        hasReference: Array.isArray(s.referenceImages) && s.referenceImages.length > 0,
        hasPreviews: !!s.previews,
        moodBoardStatus: (s.moodBoard as any)?.status || "pending",
        uiConceptsStatus: (s.uiConcepts as any)?.status || "pending",
        metadataEnrichmentStatus: s.metadataEnrichmentStatus,
        tokenCount: s.tokens ? Object.keys(s.tokens).length : 0,
      }));
      res.json({ styles: summary, total: summary.length });
    } catch (error) {
      console.error("Error fetching admin styles:", error);
      res.status(500).json({ error: "Failed to fetch styles" });
    }
  });

  // ==================== REGENERATION ENDPOINTS ====================
  
  // Regenerate specific image types for styles
  app.post("/api/admin/styles/regenerate-images", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { styleIds, styleNames, imageTypes } = req.body as RegenerateImagesRequest;
      
      if (!imageTypes || imageTypes.length === 0) {
        return res.status(400).json({ error: "imageTypes is required" });
      }
      
      if ((!styleIds || styleIds.length === 0) && (!styleNames || styleNames.length === 0)) {
        return res.status(400).json({ error: "Either styleIds or styleNames is required" });
      }

      // Resolve styles
      let targetStyles: Style[] = [];
      if (styleIds && styleIds.length > 0) {
        targetStyles = await storage.getStylesByIds(styleIds);
      }
      if (styleNames && styleNames.length > 0) {
        const byName = await storage.getStylesByNames(styleNames);
        const existingIds = new Set(targetStyles.map(s => s.id));
        for (const style of byName) {
          if (!existingIds.has(style.id)) {
            targetStyles.push(style);
          }
        }
      }

      if (targetStyles.length === 0) {
        return res.status(404).json({ error: "No matching styles found" });
      }

      // Create regeneration jobs
      const jobs: { styleId: string; styleName: string; jobId: string }[] = [];
      for (const style of targetStyles) {
        const job = await storage.createJob({
          type: "background_asset_generation",
          input: {
            styleId: style.id,
            styleName: style.name,
            imageTypes,
            operation: "regenerate_images",
          },
          styleId: style.id,
        });
        jobs.push({ styleId: style.id, styleName: style.name, jobId: job.id });
      }

      // Start regeneration in background
      processImageRegeneration(jobs, imageTypes);

      res.json({
        message: `Queued ${jobs.length} style(s) for image regeneration`,
        imageTypes,
        jobs,
      });
    } catch (error) {
      console.error("Error queueing image regeneration:", error);
      res.status(500).json({ error: "Failed to queue image regeneration" });
    }
  });

  // Full style regeneration from source
  app.post("/api/admin/styles/regenerate-full", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body as RegenerateFullRequest;
      const { styleIds, styleNames, includeTokens = true, includeMetadata = true, includePreviews = true, includeMoodBoard = true, includeUiConcepts = true } = body;
      
      if ((!styleIds || styleIds.length === 0) && (!styleNames || styleNames.length === 0)) {
        return res.status(400).json({ error: "Either styleIds or styleNames is required" });
      }

      // Resolve styles
      let targetStyles: Style[] = [];
      if (styleIds && styleIds.length > 0) {
        targetStyles = await storage.getStylesByIds(styleIds);
      }
      if (styleNames && styleNames.length > 0) {
        const byName = await storage.getStylesByNames(styleNames);
        const existingIds = new Set(targetStyles.map(s => s.id));
        for (const style of byName) {
          if (!existingIds.has(style.id)) {
            targetStyles.push(style);
          }
        }
      }

      if (targetStyles.length === 0) {
        return res.status(404).json({ error: "No matching styles found" });
      }

      // Validate each style has a reference image
      const stylesWithoutReference = targetStyles.filter(s => !s.referenceImages || (s.referenceImages as string[]).length === 0);
      if (stylesWithoutReference.length > 0) {
        return res.status(400).json({
          error: "Some styles do not have reference images",
          stylesWithoutReference: stylesWithoutReference.map(s => ({ id: s.id, name: s.name })),
        });
      }

      // Create regeneration jobs
      const jobs: { styleId: string; styleName: string; jobId: string }[] = [];
      for (const style of targetStyles) {
        const job = await storage.createJob({
          type: "style_analysis",
          input: {
            styleId: style.id,
            styleName: style.name,
            referenceImage: (style.referenceImages as string[])[0],
            operation: "regenerate_full",
            includeTokens,
            includeMetadata,
            includePreviews,
            includeMoodBoard,
            includeUiConcepts,
          },
          styleId: style.id,
        });
        jobs.push({ styleId: style.id, styleName: style.name, jobId: job.id });
      }

      // Start full regeneration in background
      processFullRegeneration(jobs, { includeTokens, includeMetadata, includePreviews, includeMoodBoard, includeUiConcepts });

      res.json({
        message: `Queued ${jobs.length} style(s) for full regeneration`,
        options: { includeTokens, includeMetadata, includePreviews, includeMoodBoard, includeUiConcepts },
        jobs,
      });
    } catch (error) {
      console.error("Error queueing full regeneration:", error);
      res.status(500).json({ error: "Failed to queue full regeneration" });
    }
  });

  // Regenerate ALL community styles
  app.post("/api/admin/styles/regenerate-all", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const allStyleIds = await storage.getAllStyleIds();
      const { imageTypes = ["all"], includeTokens = true, includeMetadata = true, includePreviews = true, includeMoodBoard = true, includeUiConcepts = true } = req.body;

      if (allStyleIds.length === 0) {
        return res.status(404).json({ error: "No styles found" });
      }

      // Get all styles
      const targetStyles = await storage.getStylesByIds(allStyleIds);
      
      // Filter to only styles with reference images for full regeneration
      const eligibleStyles = targetStyles.filter(s => s.referenceImages && (s.referenceImages as string[]).length > 0);

      // Create jobs
      const jobs = [];
      for (const style of eligibleStyles) {
        const job = await storage.createJob({
          type: "style_analysis",
          input: {
            styleId: style.id,
            styleName: style.name,
            referenceImage: (style.referenceImages as string[])[0],
            operation: "regenerate_all",
            imageTypes,
            includeTokens,
            includeMetadata,
            includePreviews,
            includeMoodBoard,
            includeUiConcepts,
          },
          styleId: style.id,
        });
        jobs.push({ styleId: style.id, styleName: style.name, jobId: job.id });
      }

      // Start background processing
      processFullRegeneration(jobs, { includeTokens, includeMetadata, includePreviews, includeMoodBoard, includeUiConcepts });

      res.json({
        message: `Queued ${jobs.length} of ${allStyleIds.length} styles for full regeneration`,
        skipped: allStyleIds.length - eligibleStyles.length,
        jobs,
      });
    } catch (error) {
      console.error("Error queueing bulk regeneration:", error);
      res.status(500).json({ error: "Failed to queue bulk regeneration" });
    }
  });

  // Get regeneration job status
  app.get("/api/admin/jobs", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const jobs = await storage.getRecentJobs(limit);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching admin jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
}

// Background processing functions
async function processImageRegeneration(jobs: { styleId: string; styleName: string; jobId: string }[], imageTypes: ImageType[]) {
  const { isProdiaEnabled } = await import("./prodia-service");
  
  for (const job of jobs) {
    const startTime = Date.now();
    try {
      await storage.updateJobStatus(job.jobId, "running", { progressMessage: "Starting image regeneration" });
      
      const style = await storage.getStyleById(job.styleId);
      if (!style) {
        await storage.updateJobStatus(job.jobId, "failed", { error: "Style not found" });
        continue;
      }

      const shouldRegeneratePreviews = imageTypes.includes("previews") || imageTypes.includes("all");
      const shouldRegenerateMoodBoard = imageTypes.includes("mood_board") || imageTypes.includes("all");
      const shouldRegenerateUiConcepts = imageTypes.includes("ui_concepts") || imageTypes.includes("all");

      if (shouldRegeneratePreviews) {
        await storage.updateJobStatus(job.jobId, "running", { progress: 20, progressMessage: "Generating previews" });
        // Previews generation would go here
      }

      if (shouldRegenerateMoodBoard || shouldRegenerateUiConcepts) {
        await storage.updateJobStatus(job.jobId, "running", { progress: 50, progressMessage: "Generating mood board & UI concepts" });
        
        if (isProdiaEnabled()) {
          const { generateMoodBoardWithProdia, generateUiConceptsWithProdia } = await import("./prodia-generation");
          
          const metadataTags = (style.metadataTags || {}) as unknown as Record<string, string[]>;
          
          const [moodBoardResult, uiResult] = await Promise.all([
            shouldRegenerateMoodBoard ? generateMoodBoardWithProdia({
              styleName: style.name,
              styleDescription: style.description,
              tokens: style.tokens,
              metadataTags,
            }) : Promise.resolve(null),
            shouldRegenerateUiConcepts ? generateUiConceptsWithProdia({
              styleName: style.name,
              styleDescription: style.description,
              tokens: style.tokens,
              metadataTags,
            }) : Promise.resolve(null),
          ]);

          // Store results
          if (moodBoardResult || uiResult) {
            const moodBoard: MoodBoardAssets = moodBoardResult ? {
              collage: moodBoardResult.collage,
              status: "complete",
              history: [],
            } : { status: "pending", history: [] };
            
            const uiConcepts: UiConceptAssets = uiResult ? {
              audioPlugin: uiResult.audioPlugin,
              dashboard: uiResult.dashboard,
              softwareApp: uiResult.softwareApp,
              status: "complete",
              history: [],
            } : { status: "pending", history: [] };
            
            await storage.updateStyleMoodBoard(job.styleId, moodBoard, uiConcepts);
            cache.delete(CACHE_KEYS.STYLE_DETAIL(job.styleId));
          }
        }
      }

      await storage.updateJobStatus(job.jobId, "succeeded", { progress: 100, progressMessage: "Complete" });
      
      // Record metric
      await storage.recordMetric({
        type: "style_regeneration",
        styleId: job.styleId,
        durationMs: Date.now() - startTime,
        success: true,
        metadata: { imageTypes },
      });
    } catch (error) {
      console.error(`Image regeneration failed for ${job.styleName}:`, error);
      await storage.updateJobStatus(job.jobId, "failed", { error: String(error) });
      
      await storage.recordMetric({
        type: "style_regeneration",
        styleId: job.styleId,
        durationMs: Date.now() - startTime,
        success: false,
        errorMessage: String(error),
        metadata: { imageTypes },
      });
    }
  }
}

async function processFullRegeneration(
  jobs: { styleId: string; styleName: string; jobId: string }[],
  options: { includeTokens: boolean; includeMetadata: boolean; includePreviews: boolean; includeMoodBoard: boolean; includeUiConcepts: boolean }
) {
  for (const job of jobs) {
    const startTime = Date.now();
    try {
      await storage.updateJobStatus(job.jobId, "running", { progressMessage: "Starting full regeneration" });
      
      const style = await storage.getStyleById(job.styleId);
      if (!style || !style.referenceImages || (style.referenceImages as string[]).length === 0) {
        await storage.updateJobStatus(job.jobId, "failed", { error: "Style not found or no reference image" });
        continue;
      }

      const referenceImage = (style.referenceImages as string[])[0];
      
      // Step 1: Extract tokens using CV
      if (options.includeTokens) {
        await storage.updateJobStatus(job.jobId, "running", { progress: 10, progressMessage: "Extracting design tokens" });
        
        const { extractTokensWithCV } = await import("./cv-bridge");
        const extractionResult = await extractTokensWithCV(referenceImage);
        
        if (extractionResult.tokens) {
          await storage.updateStyleFull(job.styleId, { tokens: extractionResult.tokens });
        }
      }

      // Step 2: Generate name and description with AI
      if (options.includeMetadata) {
        await storage.updateJobStatus(job.jobId, "running", { progress: 25, progressMessage: "Generating name and description" });
        
        const { analyzeImageForStyle } = await import("./analysis");
        const analysis = await analyzeImageForStyle(referenceImage);
        
        if (analysis) {
          // Build prompt scaffolding from analysis
          const promptScaffolding = {
            base: `${analysis.styleName} style: ${analysis.description}`,
            modifiers: [
              ...analysis.metadataTags.mood,
              ...analysis.metadataTags.lighting,
              ...analysis.metadataTags.texture,
            ],
            negative: "blurry, low quality, distorted, watermark, text",
          };
          
          await storage.updateStyleFull(job.styleId, { 
            name: analysis.styleName,
            description: analysis.description,
            promptScaffolding,
          });
        }
      }

      // Step 3: Generate previews
      if (options.includePreviews) {
        await storage.updateJobStatus(job.jobId, "running", { progress: 40, progressMessage: "Generating canonical previews" });
        
        const updatedStyle = await storage.getStyleById(job.styleId);
        if (updatedStyle) {
          const { isProdiaEnabled } = await import("./prodia-service");
          
          if (isProdiaEnabled()) {
            const { generateCanonicalPreviewsWithProdia } = await import("./prodia-generation");
            const result = await generateCanonicalPreviewsWithProdia({
              styleName: updatedStyle.name,
              styleDescription: updatedStyle.description,
              tokens: updatedStyle.tokens,
            });
            
            if (result && !result.allFailed) {
              await storage.updateStyleFull(job.styleId, { 
                previews: { portrait: result.portrait, landscape: result.landscape, stillLife: result.stillLife }
              });
            }
          } else {
            const { generateCanonicalPreviews } = await import("./preview-generation");
            const result = await generateCanonicalPreviews({
              styleName: updatedStyle.name,
              styleDescription: updatedStyle.description,
              tokens: updatedStyle.tokens,
            });
            
            if (result && !result.allFailed) {
              await storage.updateStyleFull(job.styleId, { 
                previews: { portrait: result.portrait, landscape: result.landscape, stillLife: result.stillLife }
              });
            }
          }
        }
      }

      // Step 4: Enrich metadata
      if (options.includeMetadata) {
        await storage.updateJobStatus(job.jobId, "running", { progress: 60, progressMessage: "Enriching metadata" });
        
        const { enrichStyleMetadata } = await import("./metadata-enrichment");
        await enrichStyleMetadata(job.styleId);
      }

      // Step 5: Generate mood board and UI concepts
      if (options.includeMoodBoard || options.includeUiConcepts) {
        await storage.updateJobStatus(job.jobId, "running", { progress: 80, progressMessage: "Generating mood board & UI concepts" });
        
        const { isProdiaEnabled } = await import("./prodia-service");
        const updatedStyle = await storage.getStyleById(job.styleId);
        
        if (updatedStyle && isProdiaEnabled()) {
          const { generateMoodBoardWithProdia, generateUiConceptsWithProdia } = await import("./prodia-generation");
          
          const metadataTags = (updatedStyle.metadataTags || {}) as unknown as Record<string, string[]>;
          
          const [moodBoardResult, uiResult] = await Promise.all([
            options.includeMoodBoard ? generateMoodBoardWithProdia({
              styleName: updatedStyle.name,
              styleDescription: updatedStyle.description,
              tokens: updatedStyle.tokens,
              metadataTags,
            }) : Promise.resolve(null),
            options.includeUiConcepts ? generateUiConceptsWithProdia({
              styleName: updatedStyle.name,
              styleDescription: updatedStyle.description,
              tokens: updatedStyle.tokens,
              metadataTags,
            }) : Promise.resolve(null),
          ]);

          // Store generated assets
          if (moodBoardResult || uiResult) {
            const moodBoard: MoodBoardAssets = moodBoardResult ? {
              collage: moodBoardResult.collage,
              status: "complete",
              history: [],
            } : { status: "pending", history: [] };
            
            const uiConcepts: UiConceptAssets = uiResult ? {
              audioPlugin: uiResult.audioPlugin,
              dashboard: uiResult.dashboard,
              softwareApp: uiResult.softwareApp,
              status: "complete",
              history: [],
            } : { status: "pending", history: [] };
            
            await storage.updateStyleMoodBoard(job.styleId, moodBoard, uiConcepts);
            cache.delete(CACHE_KEYS.STYLE_DETAIL(job.styleId));
          }
        }
      }

      await storage.updateJobStatus(job.jobId, "succeeded", { progress: 100, progressMessage: "Full regeneration complete" });
      
      await storage.recordMetric({
        type: "style_regeneration",
        styleId: job.styleId,
        durationMs: Date.now() - startTime,
        success: true,
        metadata: { operation: "full", options },
      });
    } catch (error) {
      console.error(`Full regeneration failed for ${job.styleName}:`, error);
      await storage.updateJobStatus(job.jobId, "failed", { error: String(error) });
      
      await storage.recordMetric({
        type: "style_regeneration",
        styleId: job.styleId,
        durationMs: Date.now() - startTime,
        success: false,
        errorMessage: String(error),
        metadata: { operation: "full", options },
      });
    }
  }
}
