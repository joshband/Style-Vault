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
      
      if (limit) {
        const result = await storage.getStyleSummariesPaginated(limit, cursor);
        
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
        return res.json({ ...result, items: visibleItems });
      }
      
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
      const summary = await storage.getStyleCoreSummary(styleId);
      if (!summary) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      const imageIds = await storage.getImageIdsByStyleId(styleId);
      
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ ...summary, imageIds });
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

  // Image assets API - serve optimized images by ID
  app.get("/api/images/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const size = (req.query.size as string) || "medium";
      
      if (!["thumb", "medium", "full"].includes(size)) {
        return res.status(400).json({ error: "Invalid size. Use: thumb, medium, or full" });
      }
      
      const { getImage } = await import("./image-service");
      const image = await getImage(id, size as "thumb" | "medium" | "full");
      
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      // Parse base64 and serve as binary with appropriate cache headers
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
      
      // Fallback: return as JSON if not valid base64
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

  // Generate canonical preview images for a style
  app.post("/api/generate-previews", async (req, res) => {
    try {
      const { styleName, styleDescription, referenceImageBase64 } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const result = await generateCanonicalPreviews({
        styleName,
        styleDescription,
        referenceImageBase64,
      });

      // Return with status info so frontend knows if generation partially failed
      res.json({ 
        previews: {
          portrait: result.portrait,
          landscape: result.landscape,
          stillLife: result.stillLife,
        },
        successCount: result.successCount,
        allFailed: result.allFailed,
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

  // Job-based preview generation with progress tracking
  app.post("/api/jobs/generate-previews", async (req, res) => {
    try {
      const { styleName, styleDescription, referenceImageBase64 } = req.body;

      if (!styleName || !styleDescription) {
        return res.status(400).json({ error: "Style name and description required" });
      }

      const job = await startJobInBackground(
        "preview_generation",
        { styleName, styleDescription, referenceImageBase64 },
        async (input, onProgress) => {
          const result = await generateCanonicalPreviews({
            styleName: input.styleName,
            styleDescription: input.styleDescription,
            referenceImageBase64: input.referenceImageBase64,
            onProgress,
          });
          
          // Throw error if all previews failed - this marks the job as failed
          if (result.allFailed) {
            throw new Error("All preview generations failed. Please try again.");
          }
          
          return result;
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

  return httpServer;
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

        // Generate previews using analysis results
        const previews = await generateCanonicalPreviews({
          styleName: analysis.styleName,
          styleDescription: analysis.description,
          referenceImageBase64: input.imageBase64,
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
