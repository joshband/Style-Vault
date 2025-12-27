import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { cache, CACHE_KEYS } from "./cache";
import type { MetricType, InsertAdminMetric, Style, MoodBoardAssets, UiConceptAssets, InsertTestRun, InsertTestCase } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { testRuns, testCases } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import { regenerateAllStyles, regenerateSingleStyle, getRegenerationProgress, cancelRegeneration, generateRegenerationReport, type BatchRegenerationProgress, type RegenerationResult } from "./style-regeneration";
import { migrateStyleImages, storeImage } from "./image-service";

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

  // ==================== TEST RUNS ====================
  
  // Get test run history
  app.get("/api/admin/test-runs", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const runs = await db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(limit);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching test runs:", error);
      res.status(500).json({ error: "Failed to fetch test runs" });
    }
  });

  // Get single test run with cases
  app.get("/api/admin/test-runs/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const [run] = await db.select().from(testRuns).where(eq(testRuns.id, req.params.id));
      if (!run) {
        return res.status(404).json({ error: "Test run not found" });
      }
      const cases = await db.select().from(testCases).where(eq(testCases.runId, req.params.id));
      res.json({ ...run, testCases: cases });
    } catch (error) {
      console.error("Error fetching test run:", error);
      res.status(500).json({ error: "Failed to fetch test run" });
    }
  });

  // Create test run with cases
  app.post("/api/admin/test-runs", async (req: Request, res: Response) => {
    try {
      const { name, browser, viewport, environment, totalTests, passedTests, failedTests, skippedTests, durationMs, summary, testCases: cases } = req.body;
      
      const status = failedTests > 0 ? "failed" : "passed";
      
      const [run] = await db.insert(testRuns).values({
        name,
        status,
        browser,
        viewport,
        environment,
        totalTests,
        passedTests,
        failedTests,
        skippedTests,
        durationMs,
        summary,
        startedAt: new Date(),
        completedAt: new Date(),
      }).returning();
      
      if (cases && Array.isArray(cases) && cases.length > 0) {
        const caseInserts = cases.map((c: any) => ({
          runId: run.id,
          name: c.name,
          suite: c.suite,
          status: c.status,
          severity: c.severity || "info",
          durationMs: c.durationMs,
          errorMessage: c.errorMessage,
          errorStack: c.errorStack,
          screenshotPath: c.screenshotPath,
          category: c.category,
          recommendation: c.recommendation,
        }));
        await db.insert(testCases).values(caseInserts);
      }
      
      res.json({ runId: run.id });
    } catch (error) {
      console.error("Error creating test run:", error);
      res.status(500).json({ error: "Failed to create test run" });
    }
  });

  // Get test metrics summary
  app.get("/api/admin/test-metrics", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const [stats] = await db.select({
        totalRuns: sql<number>`count(*)::int`,
        passedRuns: sql<number>`count(*) filter (where status = 'passed')::int`,
        failedRuns: sql<number>`count(*) filter (where status = 'failed')::int`,
        avgDuration: sql<number>`avg(duration_ms)::int`,
        totalTests: sql<number>`sum(total_tests)::int`,
        totalPassed: sql<number>`sum(passed_tests)::int`,
        totalFailed: sql<number>`sum(failed_tests)::int`,
      }).from(testRuns);
      
      const recent = await db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(5);
      
      res.json({
        summary: stats,
        recentRuns: recent,
        passRate: stats.totalTests > 0 ? ((stats.totalPassed / stats.totalTests) * 100).toFixed(1) : "0",
      });
    } catch (error) {
      console.error("Error fetching test metrics:", error);
      res.status(500).json({ error: "Failed to fetch test metrics" });
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

  // ==================== COMPREHENSIVE REGENERATION WITH BEFORE/AFTER TRACKING ====================

  // Start comprehensive regeneration (all pipelines including material intelligence)
  app.post("/api/admin/regeneration/comprehensive", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { styleIds } = req.body;
      
      // Check if regeneration is already in progress
      const existingProgress = getRegenerationProgress();
      if (existingProgress && existingProgress.status === "running") {
        return res.status(409).json({
          error: "Regeneration already in progress",
          progress: existingProgress,
        });
      }

      // Start regeneration in background
      regenerateAllStyles({ styleIds }).then((result) => {
        console.log(`[Admin] Comprehensive regeneration complete: ${result.successfulStyles}/${result.totalStyles} successful`);
      }).catch((error) => {
        console.error("[Admin] Comprehensive regeneration failed:", error);
      });

      res.json({
        message: "Comprehensive regeneration started",
        status: "running",
        estimatedStyles: styleIds?.length || (await storage.getStyleCount()),
      });
    } catch (error) {
      console.error("Error starting comprehensive regeneration:", error);
      res.status(500).json({ error: "Failed to start regeneration" });
    }
  });

  // Get comprehensive regeneration progress
  app.get("/api/admin/regeneration/progress", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const progress = getRegenerationProgress();
      
      if (!progress) {
        return res.json({ 
          status: "idle", 
          message: "No regeneration in progress" 
        });
      }

      // Return progress with limited results to avoid large payloads
      const recentResults = progress.results.slice(-10);
      
      res.json({
        batchId: progress.batchId,
        status: progress.status,
        totalStyles: progress.totalStyles,
        processedStyles: progress.processedStyles,
        successfulStyles: progress.successfulStyles,
        failedStyles: progress.failedStyles,
        currentStyleId: progress.currentStyleId,
        currentStyleName: progress.currentStyleName,
        startedAt: progress.startedAt,
        estimatedCompletionAt: progress.estimatedCompletionAt,
        progressPercent: Math.round((progress.processedStyles / progress.totalStyles) * 100),
        recentResults: recentResults.map(r => ({
          styleId: r.styleId,
          styleName: r.styleName,
          success: r.success,
          durationMs: r.totalDurationMs,
          tokensChanged: r.diff.tokensChanged,
          materialRecipe: r.diff.newRecipe,
        })),
      });
    } catch (error) {
      console.error("Error fetching regeneration progress:", error);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  // Cancel ongoing regeneration
  app.post("/api/admin/regeneration/cancel", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const cancelled = cancelRegeneration();
      
      if (cancelled) {
        res.json({ message: "Regeneration cancelled", status: "cancelled" });
      } else {
        res.status(400).json({ error: "No regeneration in progress to cancel" });
      }
    } catch (error) {
      console.error("Error cancelling regeneration:", error);
      res.status(500).json({ error: "Failed to cancel regeneration" });
    }
  });

  // Get regeneration report
  app.get("/api/admin/regeneration/report", isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
    try {
      const progress = getRegenerationProgress();
      
      if (!progress || progress.results.length === 0) {
        return res.status(404).json({ error: "No regeneration results available" });
      }

      const report = generateRegenerationReport(progress.results);
      
      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename="regeneration-report-${new Date().toISOString().split("T")[0]}.md"`);
      res.send(report);
    } catch (error) {
      console.error("Error generating regeneration report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Regenerate single style with comprehensive pipeline
  app.post("/api/admin/regeneration/style/:styleId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { styleId } = req.params;
      
      const result = await regenerateSingleStyle(styleId);
      
      if (!result) {
        return res.status(404).json({ error: "Style not found" });
      }

      res.json({
        success: result.success,
        styleId: result.styleId,
        styleName: result.styleName,
        durationMs: result.totalDurationMs,
        stages: result.stages.map(s => ({
          name: s.name,
          status: s.status,
          durationMs: s.durationMs,
          error: s.error,
        })),
        diff: {
          tokensChanged: result.diff.tokensChanged,
          tokensDelta: {
            added: result.diff.tokensDelta.added.length,
            removed: result.diff.tokensDelta.removed.length,
            modified: result.diff.tokensDelta.modified.length,
          },
          metadataChanged: result.diff.metadataChanged,
          previewsRegenerated: result.diff.previewsRegenerated,
          newMaterialRecipe: result.diff.newRecipe,
        },
        beforeSnapshot: {
          capturedAt: result.beforeSnapshot.capturedAt,
          tokenCount: Object.keys(result.beforeSnapshot.tokens).length,
        },
        afterSnapshot: {
          capturedAt: result.afterSnapshot.capturedAt,
          tokenCount: Object.keys(result.afterSnapshot.tokens).length,
          materialRecipe: result.afterSnapshot.materialSignature?.recipe_match?.global?.label,
          componentCount: result.afterSnapshot.componentCount,
        },
      });
    } catch (error) {
      console.error("Error regenerating single style:", error);
      res.status(500).json({ error: "Failed to regenerate style" });
    }
  });

  // Get before/after comparison for a specific style
  app.get("/api/admin/regeneration/comparison/:styleId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { styleId } = req.params;
      
      const progress = getRegenerationProgress();
      
      if (!progress) {
        return res.status(404).json({ error: "No regeneration data available" });
      }

      const result = progress.results.find(r => r.styleId === styleId);
      
      if (!result) {
        return res.status(404).json({ error: "Style not found in regeneration results" });
      }

      res.json({
        styleId: result.styleId,
        styleName: result.styleName,
        success: result.success,
        before: {
          capturedAt: result.beforeSnapshot.capturedAt,
          tokens: result.beforeSnapshot.tokens,
          metadataTags: result.beforeSnapshot.metadataTags,
          previewHashes: result.beforeSnapshot.previewHashes,
        },
        after: {
          capturedAt: result.afterSnapshot.capturedAt,
          tokens: result.afterSnapshot.tokens,
          metadataTags: result.afterSnapshot.metadataTags,
          previewHashes: result.afterSnapshot.previewHashes,
          materialSignature: result.afterSnapshot.materialSignature,
          componentCount: result.afterSnapshot.componentCount,
        },
        diff: result.diff,
        stages: result.stages,
      });
    } catch (error) {
      console.error("Error fetching regeneration comparison:", error);
      res.status(500).json({ error: "Failed to fetch comparison" });
    }
  });

  // ==================== IMAGE MIGRATION ENDPOINT ====================
  
  // Migrate all styles from base64 to proper image storage
  app.post("/api/admin/migrate-images", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { styleIds, dryRun = false, clearOldData = false } = req.body;
      
      let stylesToMigrate: Style[];
      if (styleIds && styleIds.length > 0) {
        stylesToMigrate = [];
        for (const id of styleIds) {
          const style = await storage.getStyleById(id);
          if (style) stylesToMigrate.push(style);
        }
      } else {
        stylesToMigrate = await storage.getStyles();
      }
      
      const results: { styleId: string; styleName: string; migrated: boolean; imageIds?: Record<string, string>; error?: string }[] = [];
      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;
      
      for (const style of stylesToMigrate) {
        try {
          // Check if already has proper imageIds (stored in separate image_assets table)
          const existingImageIds = await storage.getImageIdsByStyleId(style.id);
          const hasExistingImages = existingImageIds && Object.keys(existingImageIds).length > 0;
          
          // Get raw data
          const previews = style.previews as { portrait?: string; landscape?: string; stillLife?: string } | null;
          const referenceImages = style.referenceImages as string[] | null;
          const moodBoard = style.moodBoard as { collage?: string } | null;
          const uiConcepts = style.uiConcepts as { softwareApp?: string; audioPlugin?: string; dashboard?: string } | null;
          
          // Check if has base64 data to migrate
          const hasBase64Data = 
            (referenceImages && referenceImages[0] && referenceImages[0].length > 1000) ||
            (previews?.portrait && previews.portrait.length > 1000) ||
            (previews?.landscape && previews.landscape.length > 1000) ||
            (previews?.stillLife && previews.stillLife.length > 1000) ||
            (moodBoard?.collage && moodBoard.collage.length > 1000) ||
            (uiConcepts?.softwareApp && uiConcepts.softwareApp.length > 1000);
          
          if (!hasBase64Data) {
            skipCount++;
            results.push({ styleId: style.id, styleName: style.name, migrated: false, error: "No base64 data to migrate" });
            continue;
          }
          
          if (dryRun) {
            results.push({ styleId: style.id, styleName: style.name, migrated: false, error: "Dry run - would migrate" });
            continue;
          }
          
          // Migrate images
          const imageIds = await migrateStyleImages(style.id, {
            referenceImages: referenceImages || undefined,
            previews: previews || undefined,
            moodBoard: moodBoard || undefined,
            uiConcepts: uiConcepts || undefined,
          });
          
          // Note: imageIds are stored in the image_assets table automatically by migrateStyleImages
          // No need to update styles table - the storeImage function links assets to styleId
          
          // Optionally clear old base64 data to reduce database size
          if (clearOldData) {
            await storage.updateStyleFull(style.id, {
              previews: {} as any,
              referenceImages: [] as any,
            });
          }
          
          // Merge for result display
          const mergedImageIds = { ...existingImageIds, ...imageIds };
          
          successCount++;
          results.push({ styleId: style.id, styleName: style.name, migrated: true, imageIds });
          
          // Add small delay between migrations to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          failCount++;
          results.push({ styleId: style.id, styleName: style.name, migrated: false, error: String(error) });
          console.error(`Error migrating style ${style.id}:`, error);
        }
      }
      
      res.json({
        total: stylesToMigrate.length,
        success: successCount,
        skipped: skipCount,
        failed: failCount,
        dryRun,
        clearOldData,
        results,
      });
    } catch (error) {
      console.error("Error during image migration:", error);
      res.status(500).json({ error: "Failed to migrate images" });
    }
  });
  
  // Get migration status for a single style
  app.get("/api/admin/style/:styleId/image-status", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { styleId } = req.params;
      const style = await storage.getStyleById(styleId);
      
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      const imageIds = await storage.getImageIdsByStyleId(styleId);
      const previews = style.previews as { portrait?: string; landscape?: string; stillLife?: string } | null;
      const referenceImages = style.referenceImages as string[] | null;
      
      res.json({
        styleId,
        styleName: style.name,
        hasImageIds: Object.keys(imageIds).length > 0,
        imageIds,
        hasLegacyBase64: {
          reference: !!(referenceImages && referenceImages[0] && referenceImages[0].length > 1000),
          portrait: !!(previews?.portrait && previews.portrait.length > 1000),
          landscape: !!(previews?.landscape && previews.landscape.length > 1000),
          stillLife: !!(previews?.stillLife && previews.stillLife.length > 1000),
        },
        base64Sizes: {
          reference: referenceImages?.[0]?.length || 0,
          portrait: previews?.portrait?.length || 0,
          landscape: previews?.landscape?.length || 0,
          stillLife: previews?.stillLife?.length || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching image status:", error);
      res.status(500).json({ error: "Failed to fetch image status" });
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
