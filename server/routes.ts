import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeImageForStyle } from "./analysis";
import { generateCanonicalPreviews } from "./preview-generation";
import { generateStyledImage } from "./image-generation";
import { generateAllMoodBoardAssets } from "./mood-board-generation";
import { queueStyleForEnrichment, enrichPendingStyles, getTagsSummary } from "./metadata-enrichment";
import { extractTokensWithCV, extractTokensWithWalkthrough, convertToDTCG, isCVExtractionEnabled, CVDebugInfo } from "./cv-bridge";
import { storage } from "./storage";
import { insertStyleSchema, insertGeneratedImageSchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { cache, CACHE_KEYS } from "./cache";
import type { MetadataTags } from "@shared/schema";
import { getJobProgress, createAndRunJob } from "./job-runner";

function getDefaultMetadataTags(): MetadataTags {
  return {
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
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint for diagnosing database connectivity
  app.get("/api/health", async (req, res) => {
    try {
      const startTime = Date.now();
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - startTime;
      
      const styleCount = await storage.getStyleSummaries();
      
      res.json({
        status: "healthy",
        database: "connected",
        dbLatencyMs: dbLatency,
        styleCount: styleCount.length,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "unknown",
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "unknown",
      });
    }
  });

  // Diagnostics endpoint for operators - aggregates system health info
  app.get("/api/diagnostics", async (req, res) => {
    try {
      // Health check
      let health: any = { status: "unknown" };
      try {
        const startTime = Date.now();
        await db.execute(sql`SELECT 1`);
        const dbLatency = Date.now() - startTime;
        const styles = await storage.getStyleSummaries();
        health = {
          status: "healthy",
          database: "connected",
          dbLatencyMs: dbLatency,
          styleCount: styles.length,
        };
      } catch (error) {
        health = {
          status: "unhealthy",
          database: "disconnected",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }

      // CV extraction status
      const cvEnabled = isCVExtractionEnabled();

      // Job queue stats - get recent jobs (all statuses) for diagnostics
      const recentJobs = await storage.getRecentJobs(100);
      const activeJobs = recentJobs.filter(j => j.status === "queued" || j.status === "running");
      const jobStats = {
        queued: recentJobs.filter(j => j.status === "queued").length,
        running: recentJobs.filter(j => j.status === "running").length,
        failed: recentJobs.filter(j => j.status === "failed").length,
        succeeded: recentJobs.filter(j => j.status === "succeeded").length,
        canceled: recentJobs.filter(j => j.status === "canceled").length,
        queueDepth: activeJobs.length,
        totalRecent: recentJobs.length,
        jobs: recentJobs.map(j => ({
          id: j.id,
          type: j.type,
          status: j.status,
          progress: j.progress,
          progressMessage: j.progressMessage,
          error: j.error,
          retryCount: j.retryCount,
          maxRetries: j.maxRetries,
          createdAt: j.createdAt,
          completedAt: j.completedAt,
          styleId: j.styleId,
        })),
      };

      res.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "unknown",
        health,
        cvExtraction: {
          enabled: cvEnabled,
        },
        jobs: jobStats,
      });
    } catch (error) {
      console.error("Diagnostics error:", error);
      res.status(500).json({
        error: "Failed to gather diagnostics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get all styles (lightweight summaries for list view)
  app.get("/api/styles", async (req, res) => {
    try {
      // Check cache first
      let styles = cache.get<any[]>(CACHE_KEYS.STYLE_SUMMARIES);
      
      if (!styles) {
        styles = await storage.getStyleSummaries();
        cache.set(CACHE_KEYS.STYLE_SUMMARIES, styles, 30 * 1000); // 30 second TTL
      }
      
      // Add cache headers for browser/CDN caching
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json(styles);
    } catch (error) {
      console.error("Error fetching styles:", error);
      res.status(500).json({
        error: "Failed to fetch styles",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get a single style by ID
  app.get("/api/styles/:id", async (req, res) => {
    try {
      const styleId = req.params.id;
      
      // Check cache first
      let style = cache.get<any>(CACHE_KEYS.STYLE_DETAIL(styleId));
      
      if (!style) {
        style = await storage.getStyleById(styleId);
        if (style) {
          cache.set(CACHE_KEYS.STYLE_DETAIL(styleId), style, 5 * 60 * 1000); // 5 minute TTL
        }
      }
      
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      // Add cache headers
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json(style);
    } catch (error) {
      console.error("Error fetching style:", error);
      res.status(500).json({
        error: "Failed to fetch style",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Create a new style
  app.post("/api/styles", async (req, res) => {
    try {
      const validatedData = insertStyleSchema.parse(req.body);
      const style = await storage.createStyle(validatedData);
      
      // Invalidate cache
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      
      // Auto-trigger mood board generation in background (don't await)
      setImmediate(async () => {
        try {
          console.log(`Auto-generating mood board for style: ${style.id}`);
          
          // Mark as generating
          await storage.updateStyleMoodBoard(
            style.id,
            { collage: "", status: "generating", history: [] },
            { status: "generating", history: [] }
          );
          cache.delete(CACHE_KEYS.STYLE_DETAIL(style.id));
          cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
          
          // Generate all assets
          const { moodBoard, uiConcepts } = await generateAllMoodBoardAssets({
            styleName: style.name,
            styleDescription: style.description,
            tokens: style.tokens,
            metadataTags: style.metadataTags || getDefaultMetadataTags(),
            referenceImageBase64: style.referenceImages?.[0],
          });
          
          await storage.updateStyleMoodBoard(style.id, moodBoard, uiConcepts);
          cache.delete(CACHE_KEYS.STYLE_DETAIL(style.id));
          cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
          console.log(`Mood board generation complete for style: ${style.id}`);
          
          // Queue metadata enrichment after mood board generation
          queueStyleForEnrichment(style.id);
        } catch (error) {
          console.error(`Background mood board generation failed for ${style.id}:`, error);
          await storage.updateStyleMoodBoard(
            style.id,
            { collage: "", status: "failed", history: [] },
            { status: "failed", history: [] }
          );
          cache.delete(CACHE_KEYS.STYLE_DETAIL(style.id));
          cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
        }
      });
      
      res.status(201).json(style);
    } catch (error) {
      console.error("Error creating style:", error);
      res.status(500).json({
        error: "Failed to create style",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Delete a style
  app.delete("/api/styles/:id", async (req, res) => {
    try {
      const styleId = req.params.id;
      await storage.deleteStyle(styleId);
      
      // Invalidate cache
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      cache.delete(CACHE_KEYS.STYLE_DETAIL(styleId));
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting style:", error);
      res.status(500).json({
        error: "Failed to delete style",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Analyze image and generate style name + description using AI
  app.post("/api/analyze-image", async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image data required" });
      }

      const analysis = await analyzeImageForStyle(imageBase64);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing image:", error);
      res.status(500).json({
        error: "Failed to analyze image",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // CV-based lightweight token extraction (optional feature)
  app.post("/api/analyze-image-cv", async (req, res) => {
    try {
      if (!isCVExtractionEnabled()) {
        return res.status(503).json({ 
          error: "CV extraction is not enabled",
          message: "Set CV_EXTRACTION_ENABLED=true to enable this feature"
        });
      }

      const { imageBase64, includeWalkthrough } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image data required" });
      }

      if (includeWalkthrough) {
        const walkthroughResult = await extractTokensWithWalkthrough(imageBase64);

        if (!walkthroughResult.success) {
          return res.status(500).json({
            error: "CV walkthrough extraction failed",
            message: walkthroughResult.error,
          });
        }

        const dtcgTokens = walkthroughResult.tokens ? convertToDTCG(walkthroughResult.tokens) : null;

        res.json({
          rawTokens: walkthroughResult.tokens,
          dtcgTokens,
          debug: walkthroughResult.debug,
          processingTimeMs: walkthroughResult.processingTimeMs,
        });
      } else {
        const result = await extractTokensWithCV(imageBase64);

        if (!result.success) {
          return res.status(500).json({
            error: "CV extraction failed",
            message: result.error,
          });
        }

        const dtcgTokens = result.tokens ? convertToDTCG(result.tokens) : null;

        res.json({
          rawTokens: result.tokens,
          dtcgTokens,
          processingTimeMs: result.processingTimeMs,
        });
      }
    } catch (error) {
      console.error("Error in CV analysis:", error);
      res.status(500).json({
        error: "Failed to analyze image with CV",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get CV extraction status
  app.get("/api/cv-status", (req, res) => {
    res.json({
      enabled: isCVExtractionEnabled(),
      message: isCVExtractionEnabled() 
        ? "CV extraction is enabled" 
        : "CV extraction is disabled. Set CV_EXTRACTION_ENABLED=true to enable.",
    });
  });

  // Generate canonical preview images for a style
  app.post("/api/generate-previews", async (req, res) => {
    try {
      const { styleName, styleDescription, referenceImageBase64 } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const previews = await generateCanonicalPreviews({
        styleName,
        styleDescription,
        referenceImageBase64,
      });

      res.json({ previews });
    } catch (error) {
      console.error("Error generating previews:", error);
      res.status(500).json({
        error: "Failed to generate preview images",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Job-based image analysis with progress tracking
  app.post("/api/jobs/analyze-image", async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image data required" });
      }

      const { job } = await createAndRunJob(
        "style_analysis",
        { imageBase64 },
        async (input, onProgress) => {
          return await analyzeImageForStyle(input.imageBase64, onProgress);
        },
        { maxRetries: 2, timeoutMs: 60000 }
      );

      res.json({ jobId: job.id, status: job.status });
    } catch (error) {
      console.error("Error creating analysis job:", error);
      res.status(500).json({
        error: "Failed to analyze image",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Job-based preview generation with progress tracking
  app.post("/api/jobs/generate-previews", async (req, res) => {
    try {
      const { styleName, styleDescription, referenceImageBase64 } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const { job } = await createAndRunJob(
        "preview_generation",
        { styleName, styleDescription, referenceImageBase64 },
        async (input, onProgress) => {
          return await generateCanonicalPreviews({
            styleName: input.styleName,
            styleDescription: input.styleDescription,
            referenceImageBase64: input.referenceImageBase64,
            onProgress,
          });
        },
        { maxRetries: 2, timeoutMs: 180000 }
      );

      res.json({ jobId: job.id, status: job.status });
    } catch (error) {
      console.error("Error creating preview job:", error);
      res.status(500).json({
        error: "Failed to generate previews",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate image with style applied
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, styleId } = req.body;

      if (!prompt || !styleId) {
        return res.status(400).json({ error: "Prompt and style ID required" });
      }

      const style = await storage.getStyleById(styleId);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      const result = await generateStyledImage(
        prompt,
        style.name,
        style.description,
        style.promptScaffolding
      );

      // Save to database
      const savedImage = await storage.createGeneratedImage({
        styleId,
        prompt,
        imageData: result.imageBase64,
        thumbnailData: result.thumbnailBase64,
      });

      res.json({
        id: savedImage.id,
        imageBase64: result.imageBase64,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({
        error: "Failed to generate image",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get all generated images (admin only)
  app.get("/api/generated-images", async (req, res) => {
    try {
      const images = await storage.getGeneratedImages();
      res.json(images);
    } catch (error) {
      console.error("Error fetching generated images:", error);
      res.status(500).json({
        error: "Failed to fetch generated images",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get generated images by style
  app.get("/api/generated-images/style/:styleId", async (req, res) => {
    try {
      const images = await storage.getGeneratedImagesByStyle(req.params.styleId);
      res.json(images);
    } catch (error) {
      console.error("Error fetching generated images:", error);
      res.status(500).json({
        error: "Failed to fetch generated images",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate mood board and UI concepts for a style
  app.post("/api/styles/:id/generate-mood-board", async (req, res) => {
    try {
      const style = await storage.getStyleById(req.params.id);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      // Build history from existing assets (push current to history before regenerating)
      const existingMoodBoard = style.moodBoard as any || { status: "pending", history: [] };
      const existingUiConcepts = style.uiConcepts as any || { status: "pending", history: [] };
      
      const moodBoardHistory = [...(existingMoodBoard.history || [])];
      const uiConceptsHistory = [...(existingUiConcepts.history || [])];
      
      // If current generation was complete, add it to history
      if (existingMoodBoard.status === "complete" && existingMoodBoard.collage) {
        moodBoardHistory.unshift({
          collage: existingMoodBoard.collage,
          generatedAt: new Date().toISOString(),
        });
      }
      
      if (existingUiConcepts.status === "complete" && (existingUiConcepts.audioPlugin || existingUiConcepts.dashboard)) {
        uiConceptsHistory.unshift({
          audioPlugin: existingUiConcepts.audioPlugin,
          dashboard: existingUiConcepts.dashboard,
          componentLibrary: existingUiConcepts.componentLibrary,
          generatedAt: new Date().toISOString(),
        });
      }

      // Start generation
      const { moodBoard: newMoodBoard, uiConcepts: newUiConcepts } = await generateAllMoodBoardAssets({
        styleName: style.name,
        styleDescription: style.description,
        tokens: style.tokens,
        metadataTags: style.metadataTags || getDefaultMetadataTags(),
      });

      // Merge with history
      const moodBoardWithHistory = {
        ...newMoodBoard,
        history: moodBoardHistory,
      };
      
      const uiConceptsWithHistory = {
        ...newUiConcepts,
        history: uiConceptsHistory,
      };

      // Update style with generated assets including history
      const updated = await storage.updateStyleMoodBoard(
        req.params.id,
        moodBoardWithHistory,
        uiConceptsWithHistory
      );
      
      // Invalidate cache
      cache.delete(CACHE_KEYS.STYLE_DETAIL(req.params.id));
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);

      if (!updated) {
        return res.status(500).json({ error: "Failed to update style" });
      }

      res.json({
        moodBoard: moodBoardWithHistory,
        uiConcepts: uiConceptsWithHistory,
      });
    } catch (error) {
      console.error("Error generating mood board:", error);
      res.status(500).json({
        error: "Failed to generate mood board",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get mood board status for a style
  app.get("/api/styles/:id/mood-board", async (req, res) => {
    try {
      const style = await storage.getStyleById(req.params.id);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      res.json({
        moodBoard: style.moodBoard,
        uiConcepts: style.uiConcepts,
      });
    } catch (error) {
      console.error("Error fetching mood board:", error);
      res.status(500).json({
        error: "Failed to fetch mood board",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get aggregated tags summary for filtering UI
  app.get("/api/tags", async (req, res) => {
    try {
      const tagsSummary = await getTagsSummary();
      res.json(tagsSummary);
    } catch (error) {
      console.error("Error fetching tags summary:", error);
      res.status(500).json({
        error: "Failed to fetch tags",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Trigger metadata enrichment for a specific style
  app.post("/api/styles/:id/enrich", async (req, res) => {
    try {
      const styleId = req.params.id;
      const style = await storage.getStyleById(styleId);
      
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      // Queue for immediate enrichment
      queueStyleForEnrichment(styleId);
      
      res.json({ message: "Enrichment queued", styleId });
    } catch (error) {
      console.error("Error queuing enrichment:", error);
      res.status(500).json({
        error: "Failed to queue enrichment",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Process all pending enrichments (admin/cron endpoint)
  app.post("/api/enrich/process", async (req, res) => {
    try {
      const results = await enrichPendingStyles();
      
      // Invalidate caches for all processed styles
      for (const result of results) {
        cache.delete(CACHE_KEYS.STYLE_DETAIL(result.styleId));
      }
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      
      res.json({ 
        processed: results.length, 
        results 
      });
    } catch (error) {
      console.error("Error processing enrichments:", error);
      res.status(500).json({
        error: "Failed to process enrichments",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ============================================
  // Job Management API - Async operation tracking
  // ============================================

  // Get job status by ID
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJobById(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      res.json({
        ...job,
        ...getJobProgress(job),
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({
        error: "Failed to fetch job",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get all active jobs (queued or running)
  app.get("/api/jobs", async (req, res) => {
    try {
      const styleId = req.query.styleId as string | undefined;
      
      let jobsList;
      if (styleId) {
        jobsList = await storage.getJobsByStyleId(styleId);
      } else {
        jobsList = await storage.getActiveJobs();
      }
      
      res.json(jobsList.map(job => ({
        ...job,
        ...getJobProgress(job),
      })));
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({
        error: "Failed to fetch jobs",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Cancel a job
  app.post("/api/jobs/:id/cancel", async (req, res) => {
    try {
      const job = await storage.getJobById(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.status === "succeeded" || job.status === "failed" || job.status === "canceled") {
        return res.status(400).json({ 
          error: "Cannot cancel job", 
          reason: `Job is already ${job.status}` 
        });
      }
      
      const updated = await storage.updateJobStatus(job.id, "canceled", {
        progressMessage: "Canceled by user",
      });
      
      res.json({
        ...updated,
        ...getJobProgress(updated!),
      });
    } catch (error) {
      console.error("Error canceling job:", error);
      res.status(500).json({
        error: "Failed to cancel job",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Retry a failed job
  app.post("/api/jobs/:id/retry", async (req, res) => {
    try {
      const job = await storage.getJobById(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.status !== "failed" && job.status !== "canceled") {
        return res.status(400).json({ 
          error: "Cannot retry job", 
          reason: `Job status is ${job.status}, only failed or canceled jobs can be retried` 
        });
      }
      
      if (job.retryCount >= job.maxRetries) {
        return res.status(400).json({ 
          error: "Cannot retry job", 
          reason: "Maximum retries exceeded" 
        });
      }
      
      const updated = await storage.incrementJobRetry(job.id);
      
      res.json({
        ...updated,
        ...getJobProgress(updated!),
        message: "Job queued for retry",
      });
    } catch (error) {
      console.error("Error retrying job:", error);
      res.status(500).json({
        error: "Failed to retry job",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return httpServer;
}
