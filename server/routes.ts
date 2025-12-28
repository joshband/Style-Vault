import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeImageForStyle } from "./analysis";
import { generateCanonicalPreviews, validatePreviewImages } from "./preview-generation";
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
import { getJobProgress, startJobInBackground } from "./job-runner";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { getCacheStats, getCacheMetrics, resetCacheMetrics } from "./token-cache";
import { registerAdminRoutes } from "./admin-routes";
import { pipelineBridge } from "./pipeline-bridge";
import { initializePipelineStorage, getPipelineStorageConfig, pipelineBlobStorage, pipelineVectorStorage } from "./pipeline-storage";
import { visionService } from "./vision-service";
import { analyzeImageCombined, enrichMetadataWithVision } from "./combined-analysis";
import { generateComprehensiveDTCG } from "./comprehensive-dtcg";
import { generateRandomStyle } from "./random-style-generator";

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
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Register object storage routes for App Storage
  registerObjectStorageRoutes(app);
  
  // Register admin routes for metrics, features, and regeneration
  registerAdminRoutes(app);

  // Try to start pipeline server in background (optional - will use fallback if unavailable)
  pipelineBridge.startServer().then((started) => {
    if (started) {
      console.log("[Routes] Pipeline server started successfully");
    } else {
      console.log("[Routes] Pipeline server not available, using fallback mode");
    }
  }).catch((err) => {
    console.warn("[Routes] Failed to start pipeline server:", err);
  });

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

      const tokenCacheStats = await getCacheStats();
      const cacheMetrics = getCacheMetrics();
      
      res.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "unknown",
        health,
        cvExtraction: {
          enabled: cvEnabled,
        },
        jobs: jobStats,
        tokenCache: {
          ...tokenCacheStats,
          metrics: cacheMetrics,
          hitRate: cacheMetrics.hits + cacheMetrics.misses > 0 
            ? ((cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses)) * 100).toFixed(1) + '%'
            : 'N/A',
        },
      });
    } catch (error) {
      console.error("Diagnostics error:", error);
      res.status(500).json({
        error: "Failed to gather diagnostics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Production readiness probe - for container orchestration (k8s, Cloud Run)
  app.get("/api/ready", async (req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      
      res.status(200).json({
        ready: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        ready: false,
        error: "Database not ready",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Production liveness probe - for container orchestration
  app.get("/api/live", (req, res) => {
    res.status(200).json({
      live: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Pipeline storage configuration endpoint
  app.get("/api/pipeline/storage", async (req, res) => {
    try {
      const config = getPipelineStorageConfig();
      const status = await initializePipelineStorage();
      
      res.json({
        config: {
          blob: {
            bucket: config.blob.bucket ? "configured" : "not configured",
            privateDir: config.blob.privateDir ? "configured" : "not configured",
          },
          database: config.database.connectionString ? "configured" : "not configured",
          vector: config.vector.enabled ? "enabled" : "disabled",
        },
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get storage config",
      });
    }
  });

  // Pipeline health check - checks if Python pipeline is available
  app.get("/api/pipeline/health", async (req, res) => {
    try {
      const health = await pipelineBridge.checkHealth();
      res.json({
        status: health.healthy ? "healthy" : "unhealthy",
        pipeline: {
          version: health.pipelineVersion,
          pythonVersion: health.pythonVersion,
          activeJobs: pipelineBridge.getActiveJobCount(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Pipeline unavailable",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Validate DTCG tokens using the Python validator
  app.post("/api/pipeline/validate-tokens", async (req, res) => {
    try {
      const { tokens } = req.body;
      
      if (!tokens || typeof tokens !== "object") {
        return res.status(400).json({
          error: "tokens object is required",
        });
      }
      
      const result = await pipelineBridge.validateTokens(tokens);
      res.json({
        valid: result.valid,
        tokenCount: result.tokenCount,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Token validation error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Validation failed",
      });
    }
  });

  // Assemble a canonical style artifact
  app.post("/api/pipeline/assemble", async (req, res) => {
    try {
      const { tokens, components, styleSemantics, styleId } = req.body;
      
      if (!tokens || typeof tokens !== "object") {
        return res.status(400).json({
          error: "tokens object is required",
        });
      }
      
      const result = await pipelineBridge.assembleCanonicalArtifact(
        tokens,
        components || [],
        styleSemantics || {},
        styleId
      );
      
      res.json({
        success: result.success,
        styleId: result.styleId,
        artifact: result.data,
      });
    } catch (error) {
      console.error("Assembly error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Assembly failed",
      });
    }
  });

  // Search styles using semantic search
  app.get("/api/pipeline/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query) {
        return res.status(400).json({
          error: "q (query) parameter is required",
        });
      }
      
      const results = await pipelineBridge.searchStyles(query, limit);
      res.json({
        query,
        count: results.length,
        results,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Search failed",
      });
    }
  });

  // Google Cloud Vision API endpoints
  app.get("/api/vision/status", async (req, res) => {
    const status = visionService.getStatus();
    res.json({
      available: status.available || visionService.isAvailable(),
      error: status.error,
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/vision/analyze", async (req, res) => {
    try {
      const { image, imageUrl } = req.body;
      
      if (!image && !imageUrl) {
        return res.status(400).json({
          error: "Either 'image' (base64) or 'imageUrl' is required",
        });
      }
      
      const imageSource = imageUrl || image;
      const result = await visionService.analyzeImage(imageSource);
      
      if (result.error) {
        return res.status(500).json({
          error: result.error,
        });
      }
      
      res.json({
        success: true,
        analysis: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Vision analysis error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Vision analysis failed",
      });
    }
  });

  app.post("/api/vision/labels", async (req, res) => {
    try {
      const { image, imageUrl } = req.body;
      
      if (!image && !imageUrl) {
        return res.status(400).json({
          error: "Either 'image' (base64) or 'imageUrl' is required",
        });
      }
      
      const imageSource = imageUrl || image;
      const labels = await visionService.detectLabels(imageSource);
      
      res.json({
        success: true,
        labels,
        count: labels.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Label detection error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Label detection failed",
      });
    }
  });

  app.post("/api/vision/colors", async (req, res) => {
    try {
      const { image, imageUrl } = req.body;
      
      if (!image && !imageUrl) {
        return res.status(400).json({
          error: "Either 'image' (base64) or 'imageUrl' is required",
        });
      }
      
      const imageSource = imageUrl || image;
      const colors = await visionService.extractColors(imageSource);
      
      res.json({
        success: true,
        colors,
        count: colors.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Color extraction error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Color extraction failed",
      });
    }
  });

  app.post("/api/analyze/comprehensive", async (req, res) => {
    try {
      const { image, imageUrl, includeVision = true, includeCv = true } = req.body;
      
      if (!image && !imageUrl) {
        return res.status(400).json({
          error: "Either 'image' (base64) or 'imageUrl' is required",
        });
      }
      
      const imageSource = image || imageUrl;
      
      const combinedResult = await analyzeImageCombined(imageSource, {
        includeVision,
        includeCv,
      });
      
      const comprehensiveDtcg = generateComprehensiveDTCG({
        cvTokens: combinedResult.cv.success ? combinedResult.cv.tokens : undefined,
        visionResult: combinedResult.vision,
      });
      
      res.json({
        success: true,
        tokens: comprehensiveDtcg,
        sources: {
          cv: combinedResult.cv.success,
          vision: !!combinedResult.vision && !combinedResult.vision.error,
        },
        visionMetadata: combinedResult.visionMetadata,
        mergedColors: combinedResult.mergedColors,
        processingTimeMs: combinedResult.processingTimeMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Comprehensive analysis error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Comprehensive analysis failed",
      });
    }
  });

  // Cache metrics endpoint - for debugging and monitoring cache performance
  app.get("/api/cache/metrics", async (req, res) => {
    try {
      const stats = await getCacheStats();
      const metrics = getCacheMetrics();
      
      const totalRequests = metrics.hits + metrics.misses;
      const hitRate = totalRequests > 0 
        ? ((metrics.hits / totalRequests) * 100).toFixed(1)
        : 0;
      
      res.json({
        database: stats,
        runtime: metrics,
        summary: {
          hitRate: `${hitRate}%`,
          totalRequests,
          stepBreakdown: Object.entries(metrics.stepHits).map(([step, hits]) => ({
            step,
            hits,
            misses: metrics.stepMisses[step as keyof typeof metrics.stepMisses],
          })),
        },
      });
    } catch (error) {
      console.error("Cache metrics error:", error);
      res.status(500).json({ error: "Failed to get cache metrics" });
    }
  });

  // Reset cache metrics - for debugging
  app.post("/api/cache/metrics/reset", (req, res) => {
    resetCacheMetrics();
    console.log("[CV Cache] Metrics reset");
    res.json({ message: "Cache metrics reset successfully" });
  });

  // Get all style summaries (simple list for remix/select UIs)
  app.get("/api/styles/summaries", async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      
      let styles = cache.get<any[]>(CACHE_KEYS.STYLE_SUMMARIES);
      
      if (!styles) {
        styles = await storage.getStyleSummaries();
        cache.set(CACHE_KEYS.STYLE_SUMMARIES, styles, 30 * 1000);
      }
      
      // Filter to show public styles + user's own private styles
      const visibleStyles = styles.filter((s: any) => 
        s.isPublic !== false || s.creatorId === userId
      );
      
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json(visibleStyles);
    } catch (error) {
      console.error("Error fetching style summaries:", error);
      res.status(500).json({
        error: "Failed to fetch styles",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get all styles (lightweight summaries for list view)
  app.get("/api/styles", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const cursor = req.query.cursor as string | undefined;
      const userId = (req.user as any)?.claims?.sub;
      
      const filters: { search?: string; mood?: string[]; colorFamily?: string[]; sortBy?: "newest" | "oldest" | "name" } = {};
      if (req.query.search) {
        filters.search = req.query.search as string;
      }
      if (req.query.mood) {
        filters.mood = (req.query.mood as string).split(",").map(s => s.trim()).filter(Boolean);
      }
      if (req.query.colorFamily) {
        filters.colorFamily = (req.query.colorFamily as string).split(",").map(s => s.trim()).filter(Boolean);
      }
      if (req.query.sortBy && ["newest", "oldest", "name"].includes(req.query.sortBy as string)) {
        filters.sortBy = req.query.sortBy as "newest" | "oldest" | "name";
      }
      
      if (limit) {
        const hasFilters = Object.keys(filters).length > 0;
        const result = await storage.getStyleSummariesPaginated(limit, cursor, hasFilters ? filters : undefined);
        
        const styleIds = result.items.map(s => s.id);
        const imageIdsMap = await storage.getImageIdsByStyleIds(styleIds);
        
        const itemsWithImageIds = result.items.map(item => ({
          ...item,
          thumbnailPreview: null,
          imageIds: imageIdsMap.get(item.id) || {},
        }));
        
        // Filter to show public styles + user's own private styles
        const visibleItems = itemsWithImageIds.filter((s: any) => 
          s.isPublic !== false || s.creatorId === userId
        );
        
        res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
        return res.json({ ...result, items: visibleItems, total: visibleItems.length < result.items.length ? result.total - (result.items.length - visibleItems.length) : result.total });
      }
      
      let styles = cache.get<any[]>(CACHE_KEYS.STYLE_SUMMARIES);
      
      if (!styles) {
        styles = await storage.getStyleSummaries();
        cache.set(CACHE_KEYS.STYLE_SUMMARIES, styles, 30 * 1000);
      }
      
      // Add imageIds to styles for thumbnail display
      const styleIds = styles.map(s => s.id);
      const imageIdsMap = await storage.getImageIdsByStyleIds(styleIds);
      
      const stylesWithImageIds = styles.map(style => ({
        ...style,
        thumbnailPreview: null,
        imageIds: imageIdsMap.get(style.id) || {},
      }));
      
      // Filter to show public styles + user's own private styles
      const visibleStyles = stylesWithImageIds.filter((s: any) => 
        s.isPublic !== false || s.creatorId === userId
      );
      
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json(visibleStyles);
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

  // Get lightweight style summary (for fast initial load)
  app.get("/api/styles/:id/summary", async (req, res) => {
    try {
      const styleId = req.params.id;
      const [summary, imageIds, neighbors] = await Promise.all([
        storage.getStyleCoreSummary(styleId),
        storage.getImageIdsByStyleId(styleId),
        storage.getStyleNeighbors(styleId),
      ]);
      
      if (!summary) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ ...summary, imageIds, neighbors });
    } catch (error) {
      console.error("Error fetching style summary:", error);
      res.status(500).json({ error: "Failed to fetch style summary" });
    }
  });

  // Get heavy style assets (previews, mood board, UI concepts)
  app.get("/api/styles/:id/assets", async (req, res) => {
    try {
      const assets = await storage.getStyleAssets(req.params.id);
      if (!assets) {
        return res.status(404).json({ error: "Style not found" });
      }
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      res.json(assets);
    } catch (error) {
      console.error("Error fetching style assets:", error);
      res.status(500).json({ error: "Failed to fetch style assets" });
    }
  });

  // Generate a random style (Surprise Me feature)
  app.post("/api/styles/random", async (req, res) => {
    try {
      const randomStyleData = generateRandomStyle();
      
      const styleData = {
        name: randomStyleData.name,
        description: randomStyleData.description,
        tokens: randomStyleData.tokens,
        promptScaffolding: randomStyleData.promptScaffolding,
        metadataTags: {
          ...getDefaultMetadataTags(),
          ...randomStyleData.metadataTags,
        },
        referenceImages: [],
        previews: {
          stillLife: "",
          landscape: "",
          portrait: "",
        },
      };
      
      res.json({
        success: true,
        style: styleData,
        message: `Generated random style: ${randomStyleData.name}`,
      });
    } catch (error) {
      console.error("Random style generation error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate random style",
      });
    }
  });

  // Style Consultant - analyze project description and recommend styles
  app.post("/api/styles/consultant", async (req, res) => {
    try {
      const { description } = req.body;
      
      if (!description || typeof description !== "string" || description.trim().length < 20) {
        return res.status(400).json({
          error: "Please provide a project description of at least 20 characters",
        });
      }

      const { analyzeProjectDescription, convertRecommendationToTokens } = await import("./style-consultant");
      
      const recommendation = await analyzeProjectDescription(description.trim());
      
      const tokens = convertRecommendationToTokens(recommendation.tokenSuggestions);

      res.json({
        success: true,
        recommendation,
        generatedTokens: tokens,
      });
    } catch (error) {
      console.error("Style consultant error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to analyze project description",
      });
    }
  });

  // Create style from consultant recommendations
  app.post("/api/styles/consultant/generate", async (req, res) => {
    try {
      const { analysis, tokenSuggestions, promptScaffolding, name, description } = req.body;
      
      if (!analysis || !tokenSuggestions) {
        return res.status(400).json({
          error: "Missing required recommendation data",
        });
      }

      const { convertRecommendationToTokens } = await import("./style-consultant");
      const tokens = convertRecommendationToTokens(tokenSuggestions);

      const styleName = name || analysis.aestheticStyle || `${analysis.domain} Style`;
      const styleDescription = description || analysis.summary || `A style designed for ${analysis.domain} applications.`;

      const styleData = {
        name: styleName,
        description: styleDescription,
        tokens,
        promptScaffolding: promptScaffolding || {
          base: "",
          modifiers: [],
          negative: "",
        },
        metadataTags: {
          ...getDefaultMetadataTags(),
          mood: analysis.mood || [],
          keywords: analysis.keywords || [],
        },
        referenceImages: [],
        previews: {
          stillLife: "",
          landscape: "",
          portrait: "",
        },
      };

      res.json({
        success: true,
        style: styleData,
        message: `Generated style from consultant analysis: ${styleName}`,
      });
    } catch (error) {
      console.error("Style generation from consultant error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate style from recommendations",
      });
    }
  });

  // Style Audit - Analyze screenshot against style guide
  app.post("/api/styles/:id/audit", async (req, res) => {
    try {
      const { id } = req.params;
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image is required for audit" });
      }

      const style = await storage.getStyleById(id);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      const { auditScreenshot, calculateAuditScore, generateAuditReport } = await import("./style-audit");
      
      const result = await auditScreenshot(
        imageBase64,
        style.tokens as Record<string, any>,
        style.name
      );

      const scoreInfo = calculateAuditScore(result);
      const report = await generateAuditReport(result, style.name);

      res.json({
        success: true,
        result,
        scoreInfo,
        report,
      });
    } catch (error) {
      console.error("Style audit error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to audit screenshot",
      });
    }
  });

  // Code audit - Analyze code snippet against style guide
  app.post("/api/styles/:id/audit-code", async (req, res) => {
    try {
      const { id } = req.params;
      const { code, fileType } = req.body;

      if (!code) {
        return res.status(400).json({ error: "Code is required for audit" });
      }

      const style = await storage.getStyleById(id);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      const { auditCodeSnippet } = await import("./style-audit");
      
      const result = await auditCodeSnippet(
        code,
        style.tokens as Record<string, any>,
        style.name,
        fileType || "css"
      );

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error("Code audit error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to audit code",
      });
    }
  });

  // Generic screenshot audit (without specific style)
  app.post("/api/audit/screenshot", async (req, res) => {
    try {
      const { imageBase64, tokens, styleName } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image is required for audit" });
      }

      const { auditScreenshot, calculateAuditScore } = await import("./style-audit");
      
      const result = await auditScreenshot(
        imageBase64,
        tokens || {},
        styleName || "Custom Style"
      );

      const scoreInfo = calculateAuditScore(result);

      res.json({
        success: true,
        result,
        scoreInfo,
      });
    } catch (error) {
      console.error("Screenshot audit error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to audit screenshot",
      });
    }
  });

  // Create a new style
  app.post("/api/styles", async (req, res) => {
    try {
      const validatedData = insertStyleSchema.parse(req.body);
      
      // Validate preview images contain real data (not placeholders)
      if (validatedData.previews) {
        const previewValidation = validatePreviewImages(validatedData.previews as any);
        if (!previewValidation.valid) {
          console.warn(`Style "${validatedData.name}" created with no valid preview images (all placeholders)`);
        } else if (previewValidation.invalidCount > 0) {
          console.log(`Style "${validatedData.name}" created with ${previewValidation.validCount}/3 valid previews`);
        }
      }
      
      const style = await storage.createStyle(validatedData);
      
      // Invalidate cache
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      
      // Auto-trigger mood board generation in background using Prodia for speed
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
          
          // Try Prodia first for ~10x speedup
          const { isProdiaEnabled } = await import("./prodia-service");
          let moodBoard: any;
          let uiConcepts: any;
          
          if (isProdiaEnabled()) {
            const { generateMoodBoardWithProdia, generateUiConceptsWithProdia } = await import("./prodia-generation");
            
            // Generate mood board and UI concepts in parallel with Prodia
            const [moodBoardResult, uiResult] = await Promise.all([
              generateMoodBoardWithProdia({
                styleName: style.name,
                styleDescription: style.description,
                tokens: style.tokens,
                metadataTags: (style.metadataTags || getDefaultMetadataTags()) as unknown as Record<string, string[]>,
              }),
              generateUiConceptsWithProdia({
                styleName: style.name,
                styleDescription: style.description,
                tokens: style.tokens,
                metadataTags: (style.metadataTags || getDefaultMetadataTags()) as unknown as Record<string, string[]>,
              }),
            ]);
            
            moodBoard = {
              collage: moodBoardResult.collage,
              status: "complete" as const,
              history: [],
            };
            
            uiConcepts = {
              softwareApp: uiResult.softwareApp,
              audioPlugin: uiResult.audioPlugin,
              dashboard: uiResult.dashboard,
              status: "complete" as const,
              history: [],
            };
            
            console.log(`[Prodia] Generated mood board and UI concepts in ${moodBoardResult.processingTimeMs + uiResult.processingTimeMs}ms`);
          } else {
            // Fall back to Gemini
            const result = await generateAllMoodBoardAssets({
              styleName: style.name,
              styleDescription: style.description,
              tokens: style.tokens,
              metadataTags: style.metadataTags || getDefaultMetadataTags(),
              referenceImageBase64: style.referenceImages?.[0],
            });
            moodBoard = result.moodBoard;
            uiConcepts = result.uiConcepts;
          }
          
          await storage.updateStyleMoodBoard(style.id, moodBoard, uiConcepts);
          cache.delete(CACHE_KEYS.STYLE_DETAIL(style.id));
          cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
          console.log(`Mood board generation complete for style: ${style.id}`);
          
          // Store images in image_assets table for fast retrieval
          try {
            const { storeImage } = await import("./image-service");
            const storePromises: Promise<void>[] = [];
            
            if (moodBoard?.collage) {
              storePromises.push(storeImage(moodBoard.collage, "mood_board", style.id).then(() => {}));
            }
            if (uiConcepts?.softwareApp) {
              storePromises.push(storeImage(uiConcepts.softwareApp, "ui_software_app", style.id).then(() => {}));
            }
            if (uiConcepts?.audioPlugin) {
              storePromises.push(storeImage(uiConcepts.audioPlugin, "ui_audio_plugin", style.id).then(() => {}));
            }
            if (uiConcepts?.dashboard) {
              storePromises.push(storeImage(uiConcepts.dashboard, "ui_dashboard", style.id).then(() => {}));
            }
            
            await Promise.all(storePromises);
            console.log(`[Storage] Stored ${storePromises.length} images for style: ${style.id}`);
          } catch (storageError) {
            console.error(`Failed to store images for ${style.id}:`, storageError);
          }
          
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
      
      const { deleteStyleImages } = await import("./image-service");
      const { deleteObjectAssetsByStyle } = await import("./object-image-service");
      
      await Promise.all([
        deleteStyleImages(styleId),
        deleteObjectAssetsByStyle(styleId),
      ]);
      
      await storage.deleteStyle(styleId);
      
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

  // Update style spec (usage guidelines and design notes)
  app.patch("/api/styles/:id/spec", async (req, res) => {
    try {
      const styleId = req.params.id;
      const { usageGuidelines, designNotes } = req.body;
      
      const style = await storage.getStyleById(styleId);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      const spec = {
        usageGuidelines: usageGuidelines || "",
        designNotes: designNotes || "",
        updatedAt: new Date().toISOString(),
      };
      
      const updated = await storage.updateStyleSpec(styleId, spec);
      if (!updated) {
        return res.status(500).json({ error: "Failed to update style spec" });
      }
      
      // Invalidate cache
      cache.delete(CACHE_KEYS.STYLE_DETAIL(styleId));
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating style spec:", error);
      res.status(500).json({
        error: "Failed to update style spec",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate or get share code for a style
  app.post("/api/styles/:id/share", async (req, res) => {
    try {
      const styleId = req.params.id;
      const style = await storage.getStyleById(styleId);
      
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      // If already has a share code, return it
      if (style.shareCode) {
        return res.json({ shareCode: style.shareCode });
      }
      
      // Generate a short, memorable share code (6 alphanumeric chars)
      const generateShareCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I,O,0,1 to avoid confusion
        let code = "";
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };
      
      // Try to generate a unique code (retry up to 5 times)
      let shareCode = generateShareCode();
      let attempts = 0;
      while (attempts < 5) {
        const existing = await storage.getStyleByShareCode(shareCode);
        if (!existing) break;
        shareCode = generateShareCode();
        attempts++;
      }
      
      const updated = await storage.updateStyleShareCode(styleId, shareCode);
      if (!updated) {
        return res.status(500).json({ error: "Failed to generate share code" });
      }
      
      // Invalidate cache
      cache.delete(CACHE_KEYS.STYLE_DETAIL(styleId));
      
      res.json({ shareCode });
    } catch (error) {
      console.error("Error generating share code:", error);
      res.status(500).json({
        error: "Failed to generate share code",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get style by share code (public endpoint)
  app.get("/api/shared/:code", async (req, res) => {
    try {
      const shareCode = req.params.code.toUpperCase();
      const style = await storage.getStyleByShareCode(shareCode);
      
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      res.json(style);
    } catch (error) {
      console.error("Error fetching shared style:", error);
      res.status(500).json({
        error: "Failed to fetch style",
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

  // Typography recommendation API
  // Analyzes image visual signals and recommends fonts based on style
  app.post("/api/style/typography", async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image data required" });
      }

      const { extractStyleSignals, extractStyleSignalsFallback } = await import("./typography/styleSignals");
      const { inferTypographyIntent } = await import("./typography/typographyIntent");
      const { recommendFonts, recommendFontPairing } = await import("./typography/recommendFonts");

      // Extract visual signals from image
      let signalResult = await extractStyleSignals(imageBase64);
      
      // Fallback to basic analysis if Python CV fails
      if (!signalResult.success || !signalResult.signals) {
        console.warn("[Typography] CV extraction failed, using fallback");
        signalResult = await extractStyleSignalsFallback(imageBase64);
      }

      if (!signalResult.signals) {
        return res.status(500).json({
          error: "Failed to extract visual signals",
          message: signalResult.error || "Unknown error",
        });
      }

      // Infer typography intent from signals
      const intentResult = inferTypographyIntent(signalResult.signals);

      // Get font recommendations
      const recommendations = recommendFonts(intentResult.intent, { maxResults: 3 });
      
      // Also get a heading/body pairing suggestion
      const pairing = recommendFontPairing(intentResult.intent);

      res.json({
        signals: signalResult.signals,
        intent: intentResult.intent,
        explanations: intentResult.explanations,
        recommendations: recommendations.recommendations,
        pairing: {
          heading: pairing.heading,
          body: pairing.body,
        },
        processingTimeMs: signalResult.processingTimeMs,
      });
    } catch (error) {
      console.error("Error in typography recommendation:", error);
      res.status(500).json({
        error: "Failed to generate typography recommendations",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Image assets API - serve optimized images by ID (supports both imageAssets and objectAssets)
  app.get("/api/images/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const size = (req.query.size as string) || "medium";
      
      if (!["thumb", "medium", "full"].includes(size)) {
        return res.status(400).json({ error: "Invalid size. Use: thumb, medium, or full" });
      }
      
      const { getImageFromObjectStorage } = await import("./object-image-service");
      const objectImage = await getImageFromObjectStorage(id, size as "thumb" | "medium" | "full");
      
      if (objectImage) {
        const matches = objectImage.data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          
          res.set({
            "Content-Type": mimeType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Length": buffer.length.toString(),
          });
          return res.send(buffer);
        }
      }
      
      const { getImage } = await import("./image-service");
      const image = await getImage(id, size as "thumb" | "medium" | "full");
      
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        
        res.set({
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": buffer.length.toString(),
        });
        return res.send(buffer);
      }
      
      res.json(image);
    } catch (error) {
      console.error("Error serving image:", error);
      res.status(500).json({ error: "Failed to serve image" });
    }
  });

  // Migrate all existing style images to the new image_assets table
  app.post("/api/admin/migrate-images", async (req, res) => {
    try {
      const { migrateStyleImages } = await import("./image-service");
      const allStyles = await storage.getStyles();
      
      const results: { styleId: string; styleName: string; migrated: number; error?: string }[] = [];
      
      for (const style of allStyles) {
        try {
          const imageIds = await migrateStyleImages(style.id, {
            referenceImages: style.referenceImages as string[] | undefined,
            previews: style.previews as any,
            moodBoard: style.moodBoard as any,
            uiConcepts: style.uiConcepts as any,
          });
          
          results.push({
            styleId: style.id,
            styleName: style.name,
            migrated: Object.keys(imageIds).length,
          });
        } catch (err) {
          results.push({
            styleId: style.id,
            styleName: style.name,
            migrated: 0,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
      
      const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
      res.json({
        message: `Migrated ${totalMigrated} images from ${results.length} styles`,
        results,
      });
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ error: "Migration failed" });
    }
  });

  // Enrich all styles with usage guidelines and design notes
  app.post("/api/admin/enrich-style-specs", async (req, res) => {
    try {
      const { enrichAllStyleSpecs } = await import("./metadata-enrichment");
      const result = await enrichAllStyleSpecs();
      res.json({
        message: `Processed ${result.processed} styles, ${result.success} succeeded`,
        ...result,
      });
    } catch (error) {
      console.error("Style spec enrichment error:", error);
      res.status(500).json({ error: "Style spec enrichment failed" });
    }
  });

  // Regenerate softwareApp UI for all styles (admin endpoint) - runs async in background
  app.post("/api/admin/regenerate-software-app", async (req, res) => {
    try {
      const allStyles = await storage.getStyles();
      
      // Start async regeneration in background (don't await)
      (async () => {
        const { generateSingleUiConcept } = await import("./mood-board-generation");
        const { storeImage } = await import("./image-service");
        
        console.log(`[AdminRegenerate] Starting softwareApp regeneration for ${allStyles.length} styles...`);
        let successCount = 0;
        let errorCount = 0;
        
        for (const style of allStyles) {
          try {
            console.log(`[AdminRegenerate] Generating softwareApp for "${style.name}" (${style.id})...`);
            const softwareApp = await generateSingleUiConcept({
              styleName: style.name,
              styleDescription: style.description,
              tokens: style.tokens,
              metadataTags: style.metadataTags || getDefaultMetadataTags(),
            }, "softwareApp");
            
            if (softwareApp) {
              await storeImage(softwareApp, "ui_software_app", style.id);
              
              const freshStyle = await storage.getStyleById(style.id);
              if (freshStyle) {
                const existingMoodBoard = freshStyle.moodBoard as any || { status: "complete", history: [] };
                const existingUiConcepts = freshStyle.uiConcepts as any || { status: "pending", history: [] };
                const updatedUiConcepts = {
                  ...existingUiConcepts,
                  softwareApp,
                  status: "complete",
                };
                
                await storage.updateStyleMoodBoard(style.id, existingMoodBoard, updatedUiConcepts);
                cache.delete(CACHE_KEYS.STYLE_DETAIL(style.id));
              }
              
              successCount++;
              console.log(`[AdminRegenerate] ✓ Completed "${style.name}" (${successCount}/${allStyles.length})`);
            } else {
              errorCount++;
              console.log(`[AdminRegenerate] ✗ Failed "${style.name}" - null result`);
            }
          } catch (err) {
            errorCount++;
            console.error(`[AdminRegenerate] ✗ Error for "${style.name}":`, err);
          }
        }
        
        cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
        console.log(`[AdminRegenerate] Complete! ${successCount} succeeded, ${errorCount} failed.`);
      })();
      
      // Return immediately - regeneration continues in background
      res.json({
        message: `Started regeneration for ${allStyles.length} styles in background. Check server logs for progress.`,
        styleCount: allStyles.length,
      });
    } catch (error) {
      console.error("Software app regeneration error:", error);
      res.status(500).json({ error: "Software app regeneration failed" });
    }
  });

  // Get image asset IDs for a style
  app.get("/api/styles/:id/image-ids", async (req, res) => {
    try {
      const { getImagesByStyle } = await import("./image-service");
      const imageIds = await getImagesByStyle(req.params.id);
      res.json(imageIds);
    } catch (error) {
      console.error("Error getting image IDs:", error);
      res.status(500).json({ error: "Failed to get image IDs" });
    }
  });

  // ========== REMIX ROUTES ==========

  app.post("/api/styles/remix", async (req, res) => {
    try {
      const { remixStyles } = await import("./remix");
      const { styleIds, weights, name } = req.body;
      
      if (!styleIds || !Array.isArray(styleIds) || styleIds.length < 2) {
        return res.status(400).json({ error: "Please select at least 2 styles to remix" });
      }
      
      const result = await remixStyles({ styleIds, weights, name });
      res.json(result);
    } catch (error) {
      console.error("Remix error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to remix styles" 
      });
    }
  });

  app.post("/api/styles/remix/save", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const { name, description, tokens, promptScaffolding, sourceStyles } = req.body;
      
      const safePromptScaffolding = {
        base: promptScaffolding?.base || "A blended visual style",
        modifiers: Array.isArray(promptScaffolding?.modifiers) ? promptScaffolding.modifiers : [],
        negative: typeof promptScaffolding?.negative === "string" ? promptScaffolding.negative : "",
      };
      
      const safeTokens = tokens && typeof tokens === "object" ? tokens : {
        color: {
          primary: { $type: "color", $value: "#2A2A2A", $description: "Primary color" },
          secondary: { $type: "color", $value: "#6B5B4D", $description: "Secondary color" },
          accent: { $type: "color", $value: "#FF4D4D", $description: "Accent color" },
        },
      };
      
      const newStyle = await storage.createStyle({
        name: name || "Remixed Style",
        description: description || "A blended style combining multiple sources",
        tokens: safeTokens,
        promptScaffolding: safePromptScaffolding,
        referenceImages: [],
        previews: { portrait: "", landscape: "", stillLife: "" },
        creatorId: userId,
        metadataTags: {
          mood: [],
          colorFamily: [],
          lighting: [],
          texture: [],
          era: [],
          artPeriod: [],
          historicalInfluences: [],
          similarArtists: [],
          medium: ["remix"],
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
          keywords: ["remix", ...(Array.isArray(sourceStyles) ? sourceStyles.map((s: any) => s.name?.toLowerCase() || "") : [])],
        },
      });
      
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      
      res.status(201).json(newStyle);
    } catch (error) {
      console.error("Save remix error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to save remixed style" 
      });
    }
  });

  // ========== CREATOR/VISIBILITY ROUTES ==========

  // Get styles by a specific creator
  app.get("/api/creators/:creatorId/styles", async (req, res) => {
    try {
      const { creatorId } = req.params;
      const userId = (req.user as any)?.claims?.sub;
      
      const creatorStyles = await storage.getStylesByCreator(creatorId);
      
      // Filter to only show public styles unless the viewer is the creator
      const visibleStyles = creatorStyles.filter(s => 
        s.isPublic || s.creatorId === userId
      );
      
      res.json(visibleStyles);
    } catch (error) {
      console.error("Error fetching creator styles:", error);
      res.status(500).json({ error: "Failed to fetch creator styles" });
    }
  });

  // Get creator info
  app.get("/api/creators/:creatorId", async (req, res) => {
    try {
      const { creatorId } = req.params;
      const creatorInfo = await storage.getCreatorInfo(creatorId);
      
      if (!creatorInfo) {
        return res.status(404).json({ error: "Creator not found" });
      }
      
      res.json(creatorInfo);
    } catch (error) {
      console.error("Error fetching creator info:", error);
      res.status(500).json({ error: "Failed to fetch creator info" });
    }
  });

  // Update user profile (requires auth)
  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const { displayName } = req.body;
      
      if (displayName === undefined) {
        return res.status(400).json({ error: "No fields to update" });
      }
      
      if (typeof displayName !== "string") {
        return res.status(400).json({ error: "displayName must be a string" });
      }
      
      const trimmed = displayName.trim();
      if (trimmed.length === 0) {
        return res.status(400).json({ error: "displayName cannot be empty" });
      }
      
      if (trimmed.length > 100) {
        return res.status(400).json({ error: "displayName must be 100 characters or less" });
      }
      
      const updated = await storage.updateUserProfile(userId, { displayName: trimmed });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Update style visibility (requires auth, must be owner)
  app.patch("/api/styles/:id/visibility", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const { id } = req.params;
      const { isPublic } = req.body;
      
      if (typeof isPublic !== "boolean") {
        return res.status(400).json({ error: "isPublic must be a boolean" });
      }
      
      const style = await storage.getStyleById(id);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      if (style.creatorId !== userId) {
        return res.status(403).json({ error: "You can only change visibility of your own styles" });
      }
      
      const updated = await storage.updateStyleVisibility(id, isPublic);
      res.json(updated);
    } catch (error) {
      console.error("Error updating visibility:", error);
      res.status(500).json({ error: "Failed to update style visibility" });
    }
  });

  // ========== BOOKMARK ROUTES ==========

  // Get user's bookmarked styles with full summaries (requires auth)
  app.get("/api/bookmarks", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const bookmarkedStyles = await storage.getBookmarkedStyleSummaries(userId);
      res.json(bookmarkedStyles);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
  });

  // Check if style is bookmarked (requires auth)
  app.get("/api/styles/:id/bookmark", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const isBookmarked = await storage.isStyleBookmarked(userId, req.params.id);
      res.json({ isBookmarked });
    } catch (error) {
      console.error("Error checking bookmark:", error);
      res.status(500).json({ error: "Failed to check bookmark" });
    }
  });

  // Add bookmark (requires auth)
  app.post("/api/styles/:id/bookmark", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const styleId = req.params.id;
      
      const existing = await storage.getBookmark(userId, styleId);
      if (existing) {
        return res.json(existing);
      }
      
      const bookmark = await storage.createBookmark({ userId, styleId });
      res.status(201).json(bookmark);
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  // Remove bookmark (requires auth)
  app.delete("/api/styles/:id/bookmark", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      await storage.deleteBookmark(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing bookmark:", error);
      res.status(500).json({ error: "Failed to remove bookmark" });
    }
  });

  // ========== RATING ROUTES ==========

  // Get ratings for a style (public)
  app.get("/api/styles/:id/ratings", async (req, res) => {
    try {
      const styleRatings = await storage.getRatingsByStyle(req.params.id);
      const { average, count } = await storage.getStyleAverageRating(req.params.id);
      res.json({ ratings: styleRatings, average, count });
    } catch (error) {
      console.error("Error fetching ratings:", error);
      res.status(500).json({ error: "Failed to fetch ratings" });
    }
  });

  // Get user's rating for a style (requires auth)
  app.get("/api/styles/:id/my-rating", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const rating = await storage.getRating(userId, req.params.id);
      res.json(rating || null);
    } catch (error) {
      console.error("Error fetching user rating:", error);
      res.status(500).json({ error: "Failed to fetch rating" });
    }
  });

  // Add or update rating (requires auth)
  app.post("/api/styles/:id/rating", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const styleId = req.params.id;
      const { rating, review } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      const savedRating = await storage.createOrUpdateRating({
        userId,
        styleId,
        rating,
        review: review || null,
      });
      
      res.json(savedRating);
    } catch (error) {
      console.error("Error saving rating:", error);
      res.status(500).json({ error: "Failed to save rating" });
    }
  });

  // Delete rating (requires auth)
  app.delete("/api/styles/:id/rating", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      await storage.deleteRating(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rating:", error);
      res.status(500).json({ error: "Failed to delete rating" });
    }
  });

  // ========== COLLECTION ROUTES ==========

  // Get user's collections (requires auth)
  app.get("/api/collections", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const userCollections = await storage.getCollectionsByUser(userId);
      res.json(userCollections);
    } catch (error) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  // Get user's created styles (requires auth)
  app.get("/api/my-styles", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const createdStyles = await storage.getStylesByCreator(userId);
      res.json(createdStyles);
    } catch (error) {
      console.error("Error fetching created styles:", error);
      res.status(500).json({ error: "Failed to fetch created styles" });
    }
  });

  // Create a new collection (requires auth)
  app.post("/api/collections", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const { name, description } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Collection name is required" });
      }

      const collection = await storage.createCollection({
        userId,
        name: name.trim(),
        description: description?.trim() || null,
      });
      res.status(201).json(collection);
    } catch (error) {
      console.error("Error creating collection:", error);
      res.status(500).json({ error: "Failed to create collection" });
    }
  });

  // Get a specific collection (requires auth, must own)
  app.get("/api/collections/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const collection = await storage.getCollectionById(req.params.id);
      
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const styleSummaries = await storage.getCollectionStyleSummaries(collection.id);
      res.json({ ...collection, styles: styleSummaries });
    } catch (error) {
      console.error("Error fetching collection:", error);
      res.status(500).json({ error: "Failed to fetch collection" });
    }
  });

  // Update a collection (requires auth, must own)
  app.patch("/api/collections/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const collection = await storage.getCollectionById(req.params.id);
      
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { name, description } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim() || null;

      const updated = await storage.updateCollection(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating collection:", error);
      res.status(500).json({ error: "Failed to update collection" });
    }
  });

  // Delete a collection (requires auth, must own)
  app.delete("/api/collections/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const collection = await storage.getCollectionById(req.params.id);
      
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteCollection(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  // Add style to collection (requires auth, must own collection)
  app.post("/api/collections/:id/styles/:styleId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const collection = await storage.getCollectionById(req.params.id);
      
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const style = await storage.getStyleById(req.params.styleId);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      const item = await storage.addStyleToCollection(req.params.id, req.params.styleId);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding style to collection:", error);
      res.status(500).json({ error: "Failed to add style to collection" });
    }
  });

  // Remove style from collection (requires auth, must own collection)
  app.delete("/api/collections/:id/styles/:styleId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const collection = await storage.getCollectionById(req.params.id);
      
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.removeStyleFromCollection(req.params.id, req.params.styleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing style from collection:", error);
      res.status(500).json({ error: "Failed to remove style from collection" });
    }
  });

  // Get collections containing a specific style (requires auth)
  app.get("/api/styles/:id/collections", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const containingCollections = await storage.getCollectionsContainingStyle(userId, req.params.id);
      res.json(containingCollections);
    } catch (error) {
      console.error("Error fetching style collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  // ========== STYLE VERSION ROUTES ==========

  // Get all versions for a style
  app.get("/api/styles/:id/versions", async (req, res) => {
    try {
      const versions = await storage.getStyleVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching style versions:", error);
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  // Get a specific version
  app.get("/api/styles/:id/versions/:versionId", async (req, res) => {
    try {
      const version = await storage.getStyleVersionById(req.params.versionId);
      if (!version || version.styleId !== req.params.id) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(version);
    } catch (error) {
      console.error("Error fetching style version:", error);
      res.status(500).json({ error: "Failed to fetch version" });
    }
  });

  // Create a manual version snapshot (requires auth, owner only)
  app.post("/api/styles/:id/versions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const styleId = req.params.id;
      const { description } = req.body;

      const style = await storage.getStyleById(styleId);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      // Only the creator can create versions
      if (style.creatorId && style.creatorId !== userId) {
        return res.status(403).json({ error: "Only the creator can save versions" });
      }

      const latestVersion = await storage.getLatestVersionNumber(styleId);
      const version = await storage.createStyleVersion({
        styleId,
        versionNumber: latestVersion + 1,
        changeType: "manual_save",
        changeDescription: description || "Manual snapshot",
        createdBy: userId,
        tokens: style.tokens,
        promptScaffolding: style.promptScaffolding,
        metadataTags: style.metadataTags as any,
      });

      res.json(version);
    } catch (error) {
      console.error("Error creating style version:", error);
      res.status(500).json({ error: "Failed to create version" });
    }
  });

  // Revert to a previous version (requires auth, owner only)
  app.post("/api/styles/:id/versions/:versionId/revert", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const { id: styleId, versionId } = req.params;

      const style = await storage.getStyleById(styleId);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }

      // Only the creator can revert versions; block if no creator (legacy styles)
      if (!style.creatorId) {
        return res.status(403).json({ error: "Cannot revert style with unknown creator" });
      }
      if (style.creatorId !== userId) {
        return res.status(403).json({ error: "Only the creator can revert versions" });
      }

      // Create a version of current state before reverting
      const latestVersion = await storage.getLatestVersionNumber(styleId);
      await storage.createStyleVersion({
        styleId,
        versionNumber: latestVersion + 1,
        changeType: "reverted",
        changeDescription: `State before reverting to version ${versionId}`,
        createdBy: userId,
        tokens: style.tokens,
        promptScaffolding: style.promptScaffolding,
        metadataTags: style.metadataTags as any,
      });

      const updated = await storage.revertToVersion(styleId, versionId);
      if (!updated) {
        return res.status(400).json({ error: "Failed to revert" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error reverting style version:", error);
      res.status(500).json({ error: "Failed to revert version" });
    }
  });

  // Generate canonical preview images for a style - uses Prodia for speed
  app.post("/api/generate-previews", async (req, res) => {
    try {
      const { styleName, styleDescription, referenceImageBase64, tokens, useProdia = true } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      // Try Prodia first for ~10-50x speedup
      const { isProdiaEnabled } = await import("./prodia-service");
      if (useProdia && isProdiaEnabled()) {
        const { generateCanonicalPreviewsWithProdia } = await import("./prodia-generation");
        const result = await generateCanonicalPreviewsWithProdia({
          styleName,
          styleDescription,
          tokens,
        });
        
        return res.json({ 
          previews: {
            portrait: result.portrait,
            landscape: result.landscape,
            stillLife: result.stillLife,
          },
          successCount: result.allFailed ? 0 : 3,
          allFailed: result.allFailed,
          processingTimeMs: result.processingTimeMs,
          engine: "prodia",
        });
      }

      // Fall back to Gemini
      const result = await generateCanonicalPreviews({
        styleName,
        styleDescription,
        referenceImageBase64,
        tokens,
      });

      res.json({ 
        previews: {
          portrait: result.portrait,
          landscape: result.landscape,
          stillLife: result.stillLife,
        },
        successCount: result.successCount,
        allFailed: result.allFailed,
        engine: "gemini",
      });
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

      const job = await startJobInBackground(
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

  // Job-based preview generation with progress tracking - uses Prodia for speed
  app.post("/api/jobs/generate-previews", async (req, res) => {
    try {
      const { styleName, styleDescription, referenceImageBase64, tokens, useProdia = true } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const job = await startJobInBackground(
        "preview_generation",
        { styleName, styleDescription, referenceImageBase64, tokens, useProdia },
        async (input, onProgress) => {
          // Try Prodia first for ~10-50x speedup (~500ms vs 5-30s per image)
          const { isProdiaEnabled } = await import("./prodia-service");
          if (input.useProdia && isProdiaEnabled()) {
            const { generateCanonicalPreviewsWithProdia } = await import("./prodia-generation");
            const result = await generateCanonicalPreviewsWithProdia({
              styleName: input.styleName,
              styleDescription: input.styleDescription,
              tokens: input.tokens,
              onProgress,
            });
            
            if (result.allFailed) {
              throw new Error("All preview generations failed. Please try again.");
            }
            
            return {
              portrait: result.portrait,
              landscape: result.landscape,
              stillLife: result.stillLife,
              allFailed: result.allFailed,
              successCount: result.allFailed ? 0 : 3,
              processingTimeMs: result.processingTimeMs,
            };
          }
          
          // Fall back to Gemini if Prodia not available
          const result = await generateCanonicalPreviews({
            styleName: input.styleName,
            styleDescription: input.styleDescription,
            referenceImageBase64: input.referenceImageBase64,
            tokens: input.tokens,
            onProgress,
          });
          
          if (result.allFailed) {
            throw new Error("All preview generations failed. Please try again.");
          }
          
          return result;
        },
        { maxRetries: 2, timeoutMs: 60000 } // Reduced timeout since Prodia is fast
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
        style.promptScaffolding,
        style.tokens
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

  // Fast image generation with Prodia (Flux Schnell - ~200ms)
  app.post("/api/generate/prodia", async (req, res) => {
    try {
      const { prompt, seed, styleId } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const { isProdiaEnabled, generateWithFluxSchnell } = await import("./prodia-service");

      if (!isProdiaEnabled()) {
        return res.status(503).json({
          error: "Prodia is not configured",
          message: "PRODIA_TOKEN environment variable is not set",
        });
      }

      // If styleId provided, enhance prompt with style tokens
      let enhancedPrompt = prompt;
      if (styleId) {
        const style = await storage.getStyleById(styleId);
        if (style && style.promptScaffolding) {
          enhancedPrompt = `${style.promptScaffolding}\n\n${prompt}`;
        }
      }

      const result = await generateWithFluxSchnell({
        prompt: enhancedPrompt,
        seed: seed ? parseInt(seed, 10) : undefined,
      });

      if (!result.success) {
        return res.status(500).json({
          error: "Generation failed",
          message: result.error,
        });
      }

      res.json({
        imageBase64: result.imageBase64,
        processingTimeMs: result.processingTimeMs,
        seed: result.seed,
        model: "flux-schnell",
      });
    } catch (error) {
      console.error("Error in Prodia generation:", error);
      res.status(500).json({
        error: "Failed to generate image",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Check Prodia status
  app.get("/api/prodia-status", async (req, res) => {
    const { isProdiaEnabled } = await import("./prodia-service");
    res.json({
      enabled: isProdiaEnabled(),
      message: isProdiaEnabled()
        ? "Prodia is configured and ready"
        : "Prodia is not configured. Set PRODIA_TOKEN to enable fast generation.",
    });
  });

  // Generate canonical previews with Prodia (fast mode)
  app.post("/api/generate/prodia/previews", async (req, res) => {
    try {
      const { styleName, styleDescription, tokens } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const { generateCanonicalPreviewsWithProdia } = await import("./prodia-generation");

      const result = await generateCanonicalPreviewsWithProdia({
        styleName,
        styleDescription,
        tokens,
      });

      res.json({
        previews: {
          portrait: result.portrait,
          landscape: result.landscape,
          stillLife: result.stillLife,
        },
        allFailed: result.allFailed,
        processingTimeMs: result.processingTimeMs,
        model: "flux-schnell",
      });
    } catch (error) {
      console.error("Error in Prodia preview generation:", error);
      res.status(500).json({
        error: "Failed to generate previews",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate mood board with Prodia (fast mode)
  app.post("/api/generate/prodia/mood-board", async (req, res) => {
    try {
      const { styleName, styleDescription, tokens, metadataTags } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const { generateMoodBoardWithProdia } = await import("./prodia-generation");

      const result = await generateMoodBoardWithProdia({
        styleName,
        styleDescription,
        tokens: tokens || {},
        metadataTags,
      });

      res.json({
        collage: result.collage,
        processingTimeMs: result.processingTimeMs,
        model: "flux-schnell",
      });
    } catch (error) {
      console.error("Error in Prodia mood board generation:", error);
      res.status(500).json({
        error: "Failed to generate mood board",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate UI concepts with Prodia (fast mode)
  app.post("/api/generate/prodia/ui-concepts", async (req, res) => {
    try {
      const { styleName, styleDescription, tokens, metadataTags } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const { generateUiConceptsWithProdia } = await import("./prodia-generation");

      const result = await generateUiConceptsWithProdia({
        styleName,
        styleDescription,
        tokens: tokens || {},
        metadataTags,
      });

      res.json({
        softwareApp: result.softwareApp,
        audioPlugin: result.audioPlugin,
        dashboard: result.dashboard,
        processingTimeMs: result.processingTimeMs,
        model: "flux-schnell",
      });
    } catch (error) {
      console.error("Error in Prodia UI concepts generation:", error);
      res.status(500).json({
        error: "Failed to generate UI concepts",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate all assets with Prodia (fast mode - previews, mood board, UI concepts)
  app.post("/api/generate/prodia/all-assets", async (req, res) => {
    try {
      const { styleName, styleDescription, tokens, metadataTags } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const { generateAllAssetsWithProdia } = await import("./prodia-generation");

      const result = await generateAllAssetsWithProdia({
        styleName,
        styleDescription,
        tokens: tokens || {},
        metadataTags,
      });

      res.json({
        previews: {
          portrait: result.previews.portrait,
          landscape: result.previews.landscape,
          stillLife: result.previews.stillLife,
        },
        moodBoard: result.moodBoard,
        uiConcepts: {
          softwareApp: result.uiConcepts.softwareApp,
          audioPlugin: result.uiConcepts.audioPlugin,
          dashboard: result.uiConcepts.dashboard,
        },
        processingTimeMs: result.totalProcessingTimeMs,
        model: "flux-schnell",
      });
    } catch (error) {
      console.error("Error in Prodia all assets generation:", error);
      res.status(500).json({
        error: "Failed to generate assets",
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
      
      if (existingUiConcepts.status === "complete" && (existingUiConcepts.softwareApp || existingUiConcepts.audioPlugin || existingUiConcepts.dashboard)) {
        uiConceptsHistory.unshift({
          softwareApp: existingUiConcepts.softwareApp,
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

  // Create a batch of styles from multiple images
  app.post("/api/batch/create", async (req, res) => {
    try {
      const { images } = req.body;
      
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "No images provided" });
      }
      
      if (images.length > 10) {
        return res.status(400).json({ error: "Maximum 10 images per batch" });
      }

      // Create batch record
      const batch = await storage.createBatch({
        status: "running",
        totalItems: images.length,
        completedItems: 0,
        failedItems: 0,
      });

      // Create individual jobs for each image
      const jobPromises = images.map(async (img: { id: string; name: string; imageBase64: string }) => {
        return storage.createJob({
          type: "batch_style_creation",
          status: "queued",
          input: {
            imageId: img.id,
            name: img.name,
            imageBase64: img.imageBase64,
          },
          styleId: null,
          batchId: batch.id,
          progress: 0,
        });
      });

      await Promise.all(jobPromises);

      // Start processing in background
      processBatchInBackground(batch.id);

      res.json({ batchId: batch.id });
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({
        error: "Failed to create batch",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get batch status
  app.get("/api/batch/:id", async (req, res) => {
    try {
      const batch = await storage.getBatchById(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }

      const jobs = await storage.getJobsByBatchId(batch.id);

      res.json({
        ...batch,
        jobs: jobs.map(j => ({
          id: j.id,
          status: j.status,
          progress: j.progress,
          progressMessage: j.progressMessage,
          error: j.error,
          input: { imageId: (j.input as any)?.imageId, name: (j.input as any)?.name },
          styleId: (j.output as any)?.styleId || null,
        })),
      });
    } catch (error) {
      console.error("Error fetching batch:", error);
      res.status(500).json({
        error: "Failed to fetch batch",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Analytics endpoint - aggregates design token insights for authenticated user
  app.get("/api/analytics", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user's styles
      const userStyles = await storage.getStylesByCreator(userId);
      
      // Also get all public styles for comparison
      const allPublicStyles = await storage.getPublicStyleSummaries();
      
      // Aggregate analytics from user's styles
      const analytics = computeStyleAnalytics(userStyles, allPublicStyles);
      
      res.json(analytics);
    } catch (error) {
      console.error("Error computing analytics:", error);
      res.status(500).json({
        error: "Failed to compute analytics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Public analytics endpoint - overall platform insights (no auth required)
  app.get("/api/analytics/public", async (req, res) => {
    try {
      const allStyles = await storage.getStyleSummaries();
      const analytics = computePlatformAnalytics(allStyles);
      
      res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
      res.json(analytics);
    } catch (error) {
      console.error("Error computing public analytics:", error);
      res.status(500).json({
        error: "Failed to compute analytics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================== Component + Material Intelligence Pipeline ====================

  // Detect UI components in an image
  app.post("/api/pipeline/components", async (req, res) => {
    try {
      const { image, maxSize, minArea, enableClassification } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: "Image data required (base64)" });
      }
      
      const imageBase64 = image.replace(/^data:[^;]+;base64,/, "");
      
      const result = await pipelineBridge.detectComponents(imageBase64, {
        maxSize: maxSize || 1024,
        minArea: minArea || 400,
        enableClassification: enableClassification !== false,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Component detection error:", error);
      res.status(500).json({
        error: "Component detection failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Extract material signature from an image
  app.post("/api/pipeline/material-signature", async (req, res) => {
    try {
      const { image, components } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: "Image data required (base64)" });
      }
      
      const imageBase64 = image.replace(/^data:[^;]+;base64,/, "");
      
      const result = await pipelineBridge.extractMaterialSignature(
        imageBase64,
        components || []
      );
      
      res.json(result);
    } catch (error) {
      console.error("Material signature error:", error);
      res.status(500).json({
        error: "Material signature extraction failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Full style enrichment pipeline: components + materials + recipe matching
  app.post("/api/pipeline/enrich-style", async (req, res) => {
    try {
      const { image, styleId } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: "Image data required (base64)" });
      }
      
      const imageBase64 = image.replace(/^data:[^;]+;base64,/, "");
      
      const result = await pipelineBridge.enrichStyle(imageBase64, styleId);
      
      res.json(result);
    } catch (error) {
      console.error("Style enrichment error:", error);
      res.status(500).json({
        error: "Style enrichment failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // List available material recipes
  app.get("/api/pipeline/recipes", async (req, res) => {
    try {
      const result = await pipelineBridge.listRecipes();
      res.json(result);
    } catch (error) {
      console.error("Recipe list error:", error);
      res.status(500).json({
        error: "Failed to list recipes",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get a specific material recipe by ID
  app.get("/api/pipeline/recipes/:id", async (req, res) => {
    try {
      const recipe = await pipelineBridge.getRecipe(req.params.id);
      
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      
      res.json(recipe);
    } catch (error) {
      console.error("Recipe fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch recipe",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Pipeline status check
  app.get("/api/pipeline/status", async (req, res) => {
    try {
      const health = await pipelineBridge.checkHealth();
      res.json({
        available: pipelineBridge.isServerAvailable(),
        ...health,
      });
    } catch (error) {
      res.json({
        available: false,
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // AI-enhanced component and material classification
  app.post("/api/pipeline/classify-ai", async (req, res) => {
    try {
      const { image, components, materialSignals, textureSignals } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: "Image data required (base64)" });
      }
      
      const { classifyComponentsWithAI } = await import("./component-ai-classification");
      
      const imageBase64 = image.replace(/^data:[^;]+;base64,/, "");
      
      const result = await classifyComponentsWithAI(
        imageBase64,
        components || [],
        materialSignals || {
          translucency_score: 0.3,
          specular_density: 0.4,
          emission_score: 0.2,
          depth_shadow_complexity: 0.3,
        },
        textureSignals || {
          texture_grain: 0.2,
          microcontrast: 0.3,
          anisotropy: 0.15,
          noise_type_hint: "none",
        }
      );
      
      res.json(result);
    } catch (error) {
      console.error("AI classification error:", error);
      res.status(500).json({
        error: "AI classification failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Generate AI-enhanced material tokens
  app.post("/api/pipeline/material-tokens-ai", async (req, res) => {
    try {
      const { image, recipeMatch, materialSignals, textureSignals } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: "Image data required (base64)" });
      }
      
      const { generateMaterialTokensWithAI } = await import("./component-ai-classification");
      
      const imageBase64 = image.replace(/^data:[^;]+;base64,/, "");
      
      const tokens = await generateMaterialTokensWithAI(
        imageBase64,
        recipeMatch || { recipe_id: "unknown", label: "Unknown", confidence: 0.5 },
        materialSignals || {
          translucency_score: 0.3,
          specular_density: 0.4,
          emission_score: 0.2,
          depth_shadow_complexity: 0.3,
        },
        textureSignals || {
          texture_grain: 0.2,
          microcontrast: 0.3,
          anisotropy: 0.15,
          noise_type_hint: "none",
        }
      );
      
      res.json({ tokens });
    } catch (error) {
      console.error("Material token generation error:", error);
      res.status(500).json({
        error: "Material token generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return httpServer;
}

// Compute analytics for a user's styles
function computeStyleAnalytics(userStyles: any[], allPublicStyles: any[]) {
  const moodFrequency: Record<string, number> = {};
  const colorFamilyFrequency: Record<string, number> = {};
  const textureFrequency: Record<string, number> = {};
  const lightingFrequency: Record<string, number> = {};

  for (const style of userStyles) {
    const tags = style.metadataTags || {};
    
    for (const mood of (tags.mood || [])) {
      moodFrequency[mood] = (moodFrequency[mood] || 0) + 1;
    }
    
    for (const colorFamily of (tags.colorFamily || [])) {
      colorFamilyFrequency[colorFamily] = (colorFamilyFrequency[colorFamily] || 0) + 1;
    }
    
    for (const texture of (tags.texture || [])) {
      textureFrequency[texture] = (textureFrequency[texture] || 0) + 1;
    }
    
    for (const lighting of (tags.lighting || [])) {
      lightingFrequency[lighting] = (lightingFrequency[lighting] || 0) + 1;
    }
  }

  const styleCount = userStyles.length;
  
  const topMoods = Object.entries(moodFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topColorFamilies = Object.entries(colorFamilyFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Build creator counts from public styles and include current user
  const creatorCounts: Record<string, number> = {};
  for (const style of allPublicStyles) {
    if (style.creatorId) {
      creatorCounts[style.creatorId] = (creatorCounts[style.creatorId] || 0) + 1;
    }
  }
  
  // Calculate platform average properly
  const uniqueCreatorCount = Object.keys(creatorCounts).length;
  const platformAverage = uniqueCreatorCount > 0 
    ? Math.round(allPublicStyles.length / uniqueCreatorCount)
    : styleCount > 0 ? styleCount : 1;

  // Calculate percentile (what percentage of creators have fewer styles)
  const percentileRank = calculatePercentile(styleCount, creatorCounts);

  // Token category distribution (based on metadata tag categories)
  const tokenDistribution = {
    colors: Object.keys(colorFamilyFrequency).length,
    textures: Object.keys(textureFrequency).length,
    moods: Object.keys(moodFrequency).length,
    total: styleCount,
  };

  return {
    userStats: {
      totalStyles: styleCount,
      platformAverageStyles: platformAverage,
      percentileRank,
    },
    tokenDistribution,
    topMoods,
    topColorFamilies,
    insights: generateInsights(userStyles, topMoods, topColorFamilies),
  };
}

// Compute platform-wide analytics
function computePlatformAnalytics(allStyles: any[]) {
  const moodFrequency: Record<string, number> = {};
  const colorFamilyFrequency: Record<string, number> = {};
  const eraFrequency: Record<string, number> = {};
  
  for (const style of allStyles) {
    const tags = style.metadataTags || {};
    
    for (const mood of (tags.mood || [])) {
      moodFrequency[mood] = (moodFrequency[mood] || 0) + 1;
    }
    
    for (const colorFamily of (tags.colorFamily || [])) {
      colorFamilyFrequency[colorFamily] = (colorFamilyFrequency[colorFamily] || 0) + 1;
    }
    
    for (const era of (tags.era || [])) {
      eraFrequency[era] = (eraFrequency[era] || 0) + 1;
    }
  }

  const topMoods = Object.entries(moodFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / allStyles.length) * 100) }));

  const topColorFamilies = Object.entries(colorFamilyFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / allStyles.length) * 100) }));

  const topEras = Object.entries(eraFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Unique creators
  const uniqueCreators = new Set(allStyles.map(s => s.creatorId).filter(Boolean)).size;

  return {
    platformStats: {
      totalStyles: allStyles.length,
      uniqueCreators,
      averageStylesPerCreator: uniqueCreators > 0 ? Math.round(allStyles.length / uniqueCreators * 10) / 10 : 0,
    },
    topMoods,
    topColorFamilies,
    topEras,
    trends: identifyTrends(allStyles),
  };
}

function calculatePercentile(userCount: number, creatorCounts: Record<string, number>): number {
  const counts = Object.values(creatorCounts);
  
  // Edge cases: no other creators or user has no styles
  if (counts.length === 0 || userCount === 0) return 0;
  
  // Count how many creators have fewer styles than the user
  const belowCount = counts.filter(c => c < userCount).length;
  
  // Return percentile (0-99 range, clamped)
  return Math.min(99, Math.round((belowCount / counts.length) * 100));
}

function generateInsights(styles: any[], topMoods: any[], topColorFamilies: any[]): string[] {
  const insights: string[] = [];
  
  if (styles.length === 0) {
    insights.push("Create your first style to start seeing insights!");
    return insights;
  }
  
  if (styles.length === 1) {
    insights.push("You've created your first style! Create more to see patterns emerge.");
  } else if (styles.length >= 5) {
    insights.push(`You're building a solid collection with ${styles.length} styles.`);
  }
  
  if (topMoods.length > 0) {
    const dominantMood = topMoods[0].name.replace(/-/g, ' ');
    insights.push(`Your styles tend toward "${dominantMood}" moods.`);
  }
  
  if (topColorFamilies.length > 0) {
    const dominantColor = topColorFamilies[0].name.replace(/-/g, ' ');
    insights.push(`You gravitate toward "${dominantColor}" color palettes.`);
  }
  
  if (topMoods.length >= 3) {
    insights.push("Your style range is diverse - you explore multiple visual moods.");
  }
  
  return insights;
}

function identifyTrends(allStyles: any[]): { trending: string[]; emerging: string[] } {
  // Simple trend identification based on recent styles
  const recentStyles = allStyles
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);
  
  const recentMoods: Record<string, number> = {};
  for (const style of recentStyles) {
    for (const mood of (style.metadataTags?.mood || [])) {
      recentMoods[mood] = (recentMoods[mood] || 0) + 1;
    }
  }
  
  const trending = Object.entries(recentMoods)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name.replace(/-/g, ' '));
  
  return {
    trending: trending.length > 0 ? trending : ["No clear trends yet"],
    emerging: [],
  };
}

// Default tokens for batch-created styles (same structure as frontend SAMPLE_TOKENS)
const DEFAULT_TOKENS = {
  "color": {
    "primary": { "$type": "color", "$value": "#2A2A2A", "$description": "Primary color" },
    "secondary": { "$type": "color", "$value": "#6B5B4D", "$description": "Secondary color" },
    "accent": { "$type": "color", "$value": "#FF4D4D", "$description": "Accent color" },
    "background": { "$type": "color", "$value": "#F5F5F5", "$description": "Background color" },
    "surface": { "$type": "color", "$value": "#FFFFFF", "$description": "Surface color" },
  },
  "typography": {
    "fontFamily": {
      "serif": { "$type": "fontFamily", "$value": "Lora, Georgia, serif", "$description": "Serif font" },
      "sans": { "$type": "fontFamily", "$value": "Inter, sans-serif", "$description": "Sans font" },
    },
  },
  "spacing": {
    "base": { "$type": "dimension", "$value": "16px", "$description": "Base spacing unit" },
  },
};

// Background batch processing with throttled concurrency
async function processBatchInBackground(batchId: string) {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(3); // Max 3 concurrent Gemini calls
  
  try {
    const jobs = await storage.getJobsByBatchId(batchId);
    
    const processJob = async (job: any) => {
      try {
        await storage.updateJobStatus(job.id, "running", {
          progress: 10,
          progressMessage: "Analyzing image...",
        });

        const input = job.input as { imageId: string; name: string; imageBase64: string };
        
        // Analyze image - gets styleName, description, and metadataTags
        const analysis = await analyzeImageForStyle(input.imageBase64);
        
        await storage.updateJobStatus(job.id, "running", {
          progress: 40,
          progressMessage: "Generating previews...",
        });

        // Generate previews using analysis results (note: tokens not yet available for batch uploads)
        const previews = await generateCanonicalPreviews({
          styleName: analysis.styleName,
          styleDescription: analysis.description,
          referenceImageBase64: input.imageBase64,
          tokens: DEFAULT_TOKENS, // Use default tokens - CV extraction will update later
        });

        await storage.updateJobStatus(job.id, "running", {
          progress: 70,
          progressMessage: "Creating style...",
        });

        // Create style with default tokens (similar to Author page approach)
        // Use AI-generated styleName for unique, contextual naming
        const style = await storage.createStyle({
          name: analysis.styleName || input.name || `Style from ${input.imageId.substring(0, 8)}`,
          description: analysis.description,
          referenceImages: [input.imageBase64],
          previews: {
            portrait: previews.portrait || "",
            landscape: previews.landscape || "",
            stillLife: previews.stillLife || "",
          },
          tokens: DEFAULT_TOKENS,
          promptScaffolding: {
            base: analysis.description,
            modifiers: ["auto-generated", "batch-upload"],
            negative: "blurry, low quality, distorted",
          },
          metadataTags: getDefaultMetadataTags(),
          metadataEnrichmentStatus: "pending",
          moodBoard: { status: "pending", history: [] },
          uiConcepts: { status: "pending", history: [] },
        });

        // Queue for enrichment
        queueStyleForEnrichment(style.id);

        await storage.updateJobStatus(job.id, "succeeded", {
          progress: 100,
          progressMessage: "Complete",
          output: { styleId: style.id },
        });

        // Invalidate cache immediately so new style appears in vault
        cache.delete(CACHE_KEYS.STYLE_SUMMARIES);

        return { success: true, styleId: style.id };
      } catch (error) {
        console.error(`Batch job ${job.id} failed:`, error);
        await storage.updateJobStatus(job.id, "failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return { success: false };
      }
    };

    // Process all jobs with concurrency limit
    const results = await Promise.all(
      jobs.map(job => limit(() => processJob(job)))
    );

    // Update batch status
    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    await storage.updateBatchProgress(batchId, completed, failed);
    
    // Invalidate cache
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    
  } catch (error) {
    console.error("Batch processing failed:", error);
    await storage.updateBatchStatus(batchId, "failed");
  }
}
