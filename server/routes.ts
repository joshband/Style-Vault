import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeImageForStyle } from "./analysis";
import { generateCanonicalPreviews } from "./preview-generation";
import { generateStyledImage } from "./image-generation";
import { generateAllMoodBoardAssets } from "./mood-board-generation";
import { queueStyleForEnrichment, enrichPendingStyles, getTagsSummary } from "./metadata-enrichment";
import { storage } from "./storage";
import { insertStyleSchema, insertGeneratedImageSchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { cache, CACHE_KEYS } from "./cache";

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
            metadataTags: style.metadataTags || {
              mood: [],
              colorFamily: [],
              era: [],
              medium: [],
              subjects: [],
              lighting: [],
              texture: [],
            },
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
        metadataTags: style.metadataTags || {
          mood: [],
          colorFamily: [],
          era: [],
          medium: [],
          subjects: [],
          lighting: [],
          texture: [],
        },
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

  return httpServer;
}
