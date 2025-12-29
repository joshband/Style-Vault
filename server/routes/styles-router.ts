import { Router } from "express";
import { storage } from "../storage";
import { cache, CACHE_KEYS } from "../cache";
import { insertStyleSchema } from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { analyzeImageForStyle } from "../analysis";
import { generateAllMoodBoardAssets } from "../mood-board-generation";
import { queueStyleForEnrichment, enrichStyleMetadata, enrichStyleSpec } from "../metadata-enrichment";
import { extractTokensWithCV, extractTokensWithWalkthrough, convertToDTCG, isCVExtractionEnabled } from "../cv-bridge";
import { getDefaultMetadataTags } from "./utils";
import type { UiConceptAssets } from "@shared/schema";
import { logger } from "../logger";
import { storeImageToObjectStorage, getImageFromObjectStorage } from "../object-image-service";
import { isValidImageDataUri } from "../preview-generation";

const router = Router();

router.get("/api/styles/summaries", async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    let styles = cache.get<any[]>(CACHE_KEYS.STYLE_SUMMARIES);
    
    if (!styles) {
      styles = await storage.getStyleSummaries();
      cache.set(CACHE_KEYS.STYLE_SUMMARIES, styles, 30 * 1000);
    }
    
    const visibleStyles = styles.filter((s: any) => 
      s.isPublic !== false || s.creatorId === userId
    );
    
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json(visibleStyles);
  } catch (error) {
    logger.error("Error fetching style summaries", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to fetch styles",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/styles", async (req, res) => {
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
    
    const styleIds = styles.map(s => s.id);
    const imageIdsMap = await storage.getImageIdsByStyleIds(styleIds);
    
    const stylesWithImageIds = styles.map(style => ({
      ...style,
      thumbnailPreview: null,
      imageIds: imageIdsMap.get(style.id) || {},
    }));
    
    const visibleStyles = stylesWithImageIds.filter((s: any) => 
      s.isPublic !== false || s.creatorId === userId
    );
    
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json(visibleStyles);
  } catch (error) {
    logger.error("Error fetching styles", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to fetch styles",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/styles/:id", async (req, res) => {
  try {
    const styleId = req.params.id;
    
    let style = cache.get<any>(CACHE_KEYS.STYLE_DETAIL(styleId));
    
    if (!style) {
      style = await storage.getStyleById(styleId);
      if (style) {
        cache.set(CACHE_KEYS.STYLE_DETAIL(styleId), style, 5 * 60 * 1000);
      }
    }
    
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(style);
  } catch (error) {
    logger.error("Error fetching style", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to fetch style",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/styles/:id/summary", async (req, res) => {
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
    logger.error("Error fetching style summary", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch style summary" });
  }
});

router.get("/api/styles/:id/tokens", async (req, res) => {
  try {
    const styleId = req.params.id;
    const style = await storage.getStyleById(styleId);
    
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ tokens: style.tokens });
  } catch (error) {
    logger.error("Error fetching style tokens", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch style tokens" });
  }
});

router.get("/api/styles/:id/metadata", async (req, res) => {
  try {
    const styleId = req.params.id;
    const style = await storage.getStyleById(styleId);
    
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      metadataTags: style.metadataTags,
      promptScaffolding: style.promptScaffolding,
      spec: style.styleSpec,
    });
  } catch (error) {
    logger.error("Error fetching style metadata", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch style metadata" });
  }
});

router.get("/api/styles/:id/assets", async (req, res) => {
  try {
    const styleId = req.params.id;
    const style = await storage.getStyleById(styleId);
    
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      moodBoard: style.moodBoard,
      uiConcepts: style.uiConcepts,
      previews: style.previews,
    });
  } catch (error) {
    logger.error("Error fetching style assets", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch style assets" });
  }
});

router.post("/api/styles/:id/enrich", async (req, res) => {
  try {
    const styleId = req.params.id;
    const style = await storage.getStyleById(styleId);
    
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    logger.info("Starting synchronous metadata enrichment", { module: 'Styles', styleId });
    
    const metadataSuccess = await enrichStyleMetadata(styleId);
    let specSuccess = false;
    
    if (metadataSuccess) {
      specSuccess = await enrichStyleSpec(styleId);
    }
    
    cache.delete(CACHE_KEYS.STYLE_DETAIL(styleId));
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    
    const updatedStyle = await storage.getStyleById(styleId);
    
    res.json({
      success: metadataSuccess && specSuccess,
      metadataSuccess,
      specSuccess,
      metadataTags: updatedStyle?.metadataTags,
      styleSpec: updatedStyle?.styleSpec,
      enrichmentStatus: updatedStyle?.metadataEnrichmentStatus,
    });
  } catch (error) {
    logger.error("Error enriching style", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to enrich style",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/styles", async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    const validatedData = insertStyleSchema.parse({
      ...req.body,
      creatorId: userId || null,
    });

    const style = await storage.createStyle(validatedData);
    
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    
    (async () => {
      try {
        const refImages = style.referenceImages as string[] | null;
        if (refImages && refImages.length > 0 && isValidImageDataUri(refImages[0])) {
          try {
            await storeImageToObjectStorage(refImages[0], "reference", style.id);
            await storage.updateStyleFull(style.id, { referenceImages: [] as any });
            logger.info(`Migrated reference image to Object Storage for style: ${style.id}`, { module: 'Styles', styleId: style.id });
          } catch (storageErr) {
            logger.error(`Failed to migrate reference image to Object Storage for ${style.id}`, storageErr, { module: 'Styles', styleId: style.id });
          }
        }

        logger.info(`Starting parallel asset generation for style: ${style.id}`, { module: 'Styles', styleId: style.id });
        
        let moodBoard: any;
        let uiConcepts: any;
        let previews: any;
        
        const { isProdiaEnabled } = await import("../prodia-service");
        if (isProdiaEnabled()) {
          // Use generateAllAssetsWithProdia for maximum parallelization:
          // Generates canonical previews + mood board + UI concepts ALL in parallel
          const { generateAllAssetsWithProdia } = await import("../prodia-generation");
          
          const allAssets = await generateAllAssetsWithProdia({
            styleName: style.name,
            styleDescription: style.description,
            tokens: style.tokens || {},
            metadataTags: (style.metadataTags || getDefaultMetadataTags()) as unknown as Record<string, string[]>,
          });
          
          previews = allAssets.previews;
          
          moodBoard = {
            collage: allAssets.moodBoard.collage,
            status: "complete" as const,
            history: [],
          };
          
          uiConcepts = {
            softwareApp: allAssets.uiConcepts.softwareApp,
            audioPlugin: allAssets.uiConcepts.audioPlugin,
            dashboard: allAssets.uiConcepts.dashboard,
            status: "complete" as const,
            history: [],
          };
          
          logger.info(`Generated all assets in parallel`, { module: 'Styles', duration: allAssets.totalProcessingTimeMs });
        } else {
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
        logger.info(`Asset generation complete for style: ${style.id}`, { module: 'Styles', styleId: style.id });
        
        try {
          const { storeImageToObjectStorage } = await import("../object-image-service");
          const storePromises: Promise<string>[] = [];
          
          // Store canonical previews
          if (previews?.portrait) {
            storePromises.push(storeImageToObjectStorage(previews.portrait, "preview_portrait", style.id));
          }
          if (previews?.landscape) {
            storePromises.push(storeImageToObjectStorage(previews.landscape, "preview_landscape", style.id));
          }
          if (previews?.stillLife) {
            storePromises.push(storeImageToObjectStorage(previews.stillLife, "preview_still_life", style.id));
          }
          
          // Store mood board and UI concepts
          if (moodBoard?.collage) {
            storePromises.push(storeImageToObjectStorage(moodBoard.collage, "mood_board", style.id));
          }
          if (uiConcepts?.softwareApp) {
            storePromises.push(storeImageToObjectStorage(uiConcepts.softwareApp, "ui_software_app", style.id));
          }
          if (uiConcepts?.audioPlugin) {
            storePromises.push(storeImageToObjectStorage(uiConcepts.audioPlugin, "ui_audio_plugin", style.id));
          }
          if (uiConcepts?.dashboard) {
            storePromises.push(storeImageToObjectStorage(uiConcepts.dashboard, "ui_dashboard", style.id));
          }
          
          await Promise.all(storePromises);
          logger.info(`Stored ${storePromises.length} images to object storage for style: ${style.id}`, { module: 'Styles', styleId: style.id });
        } catch (storageError) {
          logger.error(`Failed to store images for ${style.id}`, storageError, { module: 'Styles', styleId: style.id });
        }
        
        queueStyleForEnrichment(style.id);
      } catch (error) {
        logger.error(`Background mood board generation failed for ${style.id}`, error, { module: 'Styles', styleId: style.id });
        await storage.updateStyleMoodBoard(
          style.id,
          { collage: "", status: "failed", history: [] },
          { status: "failed", history: [] }
        );
        cache.delete(CACHE_KEYS.STYLE_DETAIL(style.id));
        cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      }
    })();
    
    res.status(201).json(style);
  } catch (error) {
    logger.error("Error creating style", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to create style",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.delete("/api/styles/:id", async (req, res) => {
  try {
    const styleId = req.params.id;
    
    const { deleteStyleImages } = await import("../image-service");
    const { deleteObjectAssetsByStyle } = await import("../object-image-service");
    
    await Promise.all([
      deleteStyleImages(styleId),
      deleteObjectAssetsByStyle(styleId),
    ]);
    
    await storage.deleteStyle(styleId);
    
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    cache.delete(CACHE_KEYS.STYLE_DETAIL(styleId));
    
    res.status(204).send();
  } catch (error) {
    logger.error("Error deleting style", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to delete style",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.patch("/api/styles/:id/spec", async (req, res) => {
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
    
    cache.delete(CACHE_KEYS.STYLE_DETAIL(styleId));
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating style spec", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to update style spec",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/styles/:id/share", async (req, res) => {
  try {
    const styleId = req.params.id;
    const style = await storage.getStyleById(styleId);
    
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    if (style.shareCode) {
      return res.json({ shareCode: style.shareCode });
    }
    
    const generateShareCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };
    
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
    
    cache.delete(CACHE_KEYS.STYLE_DETAIL(styleId));
    
    res.json({ shareCode });
  } catch (error) {
    logger.error("Error generating share code", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to generate share code",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/shared/:code", async (req, res) => {
  try {
    const shareCode = req.params.code.toUpperCase();
    const style = await storage.getStyleByShareCode(shareCode);
    
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    res.json(style);
  } catch (error) {
    logger.error("Error fetching shared style", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to fetch style",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image data required" });
    }

    const analysis = await analyzeImageForStyle(imageBase64);
    res.json(analysis);
  } catch (error) {
    logger.error("Error analyzing image", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to analyze image",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/analyze-image-cv", async (req, res) => {
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
    logger.error("Error in CV analysis", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to analyze image with CV",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/style/typography", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image data required" });
    }

    const { extractStyleSignals, extractStyleSignalsFallback } = await import("../typography/styleSignals");
    const { inferTypographyIntent } = await import("../typography/typographyIntent");
    const { recommendFonts, recommendFontPairing } = await import("../typography/recommendFonts");

    let signalResult = await extractStyleSignals(imageBase64);
    
    if (!signalResult.success || !signalResult.signals) {
      logger.warn("CV extraction failed, using fallback", { module: 'Styles' });
      signalResult = await extractStyleSignalsFallback(imageBase64);
    }

    if (!signalResult.signals) {
      return res.status(500).json({
        error: "Failed to extract visual signals",
        message: signalResult.error || "Unknown error",
      });
    }

    const intentResult = inferTypographyIntent(signalResult.signals);
    const recommendations = recommendFonts(intentResult.intent, { maxResults: 3 });
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
    logger.error("Error in typography recommendation", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to generate typography recommendations",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/styles/:id/image-ids", async (req, res) => {
  try {
    const { getImagesByStyle } = await import("../image-service");
    const imageIds = await getImagesByStyle(req.params.id);
    res.json(imageIds);
  } catch (error) {
    logger.error("Error getting image IDs", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to get image IDs" });
  }
});

router.post("/api/styles/remix", async (req, res) => {
  try {
    const { remixStyles } = await import("../remix");
    const { styleIds, weights, name } = req.body;
    
    if (!styleIds || !Array.isArray(styleIds) || styleIds.length < 2) {
      return res.status(400).json({ error: "Please select at least 2 styles to remix" });
    }
    
    const result = await remixStyles({ styleIds, weights, name });
    res.json(result);
  } catch (error) {
    logger.error("Remix error", error, { module: 'Styles' });
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to remix styles" 
    });
  }
});

router.post("/api/styles/remix/save", isAuthenticated, async (req, res) => {
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
        depth: [],
        shadow: [],
        material: [],
        atmosphere: [],
        environment: [],
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
        keywords: sourceStyles?.map((s: any) => s.name) || [],
      },
      metadataEnrichmentStatus: "pending",
      moodBoard: { status: "pending", history: [] },
      uiConcepts: { status: "pending", history: [] },
    });
    
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    queueStyleForEnrichment(newStyle.id);
    
    res.status(201).json(newStyle);
  } catch (error) {
    logger.error("Error saving remix", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to save remixed style" });
  }
});

router.get("/api/styles/:id/visibility", async (req, res) => {
  try {
    const style = await storage.getStyleById(req.params.id);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    res.json({ isPublic: style.isPublic });
  } catch (error) {
    logger.error("Error fetching style visibility", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch visibility" });
  }
});

router.patch("/api/styles/:id/visibility", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { isPublic } = req.body;
    
    const style = await storage.getStyleById(req.params.id);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }
    
    if (style.creatorId && style.creatorId !== userId) {
      return res.status(403).json({ error: "Only the creator can change visibility" });
    }
    
    const updated = await storage.updateStyleVisibility(req.params.id, isPublic);
    if (!updated) {
      return res.status(500).json({ error: "Failed to update visibility" });
    }
    
    cache.delete(CACHE_KEYS.STYLE_DETAIL(req.params.id));
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    
    res.json({ isPublic: updated.isPublic });
  } catch (error) {
    logger.error("Error updating style visibility", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to update visibility" });
  }
});

router.get("/api/creators/:userId", async (req, res) => {
  try {
    const creatorInfo = await storage.getCreatorInfo(req.params.userId);
    if (!creatorInfo) {
      return res.status(404).json({ error: "Creator not found" });
    }
    
    res.json(creatorInfo);
  } catch (error) {
    logger.error("Error fetching creator info", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch creator info" });
  }
});

router.get("/api/creators/:userId/styles", async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const creatorId = req.params.userId;
    
    const styles = await storage.getStylesByCreator(creatorId);
    
    const visibleStyles = styles.filter((s: any) => 
      s.isPublic !== false || s.creatorId === userId
    );
    
    res.json(visibleStyles);
  } catch (error) {
    logger.error("Error fetching creator styles", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch creator styles" });
  }
});

router.patch("/api/user/profile", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { displayName } = req.body;
    
    const updated = await storage.updateUserProfile(userId, { displayName });
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(updated);
  } catch (error) {
    logger.error("Error updating user profile", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/api/bookmarks", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const bookmarkedStyles = await storage.getBookmarkedStyleSummaries(userId);
    res.json(bookmarkedStyles);
  } catch (error) {
    logger.error("Error fetching bookmarks", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

router.get("/api/styles/:id/bookmark", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const isBookmarked = await storage.isStyleBookmarked(userId, req.params.id);
    res.json({ bookmarked: isBookmarked });
  } catch (error) {
    logger.error("Error checking bookmark", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to check bookmark status" });
  }
});

router.post("/api/styles/:id/bookmark", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const existing = await storage.getBookmark(userId, req.params.id);
    
    if (existing) {
      return res.json({ bookmarked: true, message: "Already bookmarked" });
    }
    
    await storage.createBookmark({ userId, styleId: req.params.id });
    res.json({ bookmarked: true });
  } catch (error) {
    logger.error("Error creating bookmark", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to create bookmark" });
  }
});

router.delete("/api/styles/:id/bookmark", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    await storage.deleteBookmark(userId, req.params.id);
    res.json({ bookmarked: false });
  } catch (error) {
    logger.error("Error deleting bookmark", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to delete bookmark" });
  }
});

router.get("/api/styles/:id/ratings", async (req, res) => {
  try {
    const avgRating = await storage.getStyleAverageRating(req.params.id);
    res.json({
      average: avgRating.average,
      count: avgRating.count,
    });
  } catch (error) {
    logger.error("Error fetching public ratings", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch ratings" });
  }
});

router.get("/api/styles/:id/rating", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const [userRating, avgRating] = await Promise.all([
      storage.getRating(userId, req.params.id),
      storage.getStyleAverageRating(req.params.id),
    ]);
    
    res.json({
      userRating: userRating?.rating || null,
      averageRating: avgRating.average,
      totalRatings: avgRating.count,
    });
  } catch (error) {
    logger.error("Error fetching rating", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch rating" });
  }
});

router.post("/api/styles/:id/rating", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { rating } = req.body;
    
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    
    await storage.createOrUpdateRating({ userId, styleId: req.params.id, rating });
    const avgRating = await storage.getStyleAverageRating(req.params.id);
    
    res.json({
      userRating: rating,
      averageRating: avgRating.average,
      totalRatings: avgRating.count,
    });
  } catch (error) {
    logger.error("Error updating rating", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to update rating" });
  }
});

router.delete("/api/styles/:id/rating", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    await storage.deleteRating(userId, req.params.id);
    const avgRating = await storage.getStyleAverageRating(req.params.id);
    
    res.json({
      userRating: null,
      averageRating: avgRating.average,
      totalRatings: avgRating.count,
    });
  } catch (error) {
    logger.error("Error deleting rating", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to delete rating" });
  }
});

router.get("/api/collections", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const collections = await storage.getCollectionsByUser(userId);
    res.json(collections);
  } catch (error) {
    logger.error("Error fetching collections", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch collections" });
  }
});

router.post("/api/collections", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { name, description } = req.body;
    
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Collection name is required" });
    }
    
    const collection = await storage.createCollection({
      userId,
      name: name.trim(),
      description: description || null,
    });
    
    res.status(201).json(collection);
  } catch (error) {
    logger.error("Error creating collection", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to create collection" });
  }
});

router.get("/api/collections/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const collection = await storage.getCollectionById(req.params.id);
    
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    if (collection.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(collection);
  } catch (error) {
    logger.error("Error fetching collection", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch collection" });
  }
});

router.patch("/api/collections/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { name, description } = req.body;
    
    const collection = await storage.getCollectionById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    if (collection.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const updated = await storage.updateCollection(req.params.id, { name, description });
    res.json(updated);
  } catch (error) {
    logger.error("Error updating collection", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to update collection" });
  }
});

router.delete("/api/collections/:id", isAuthenticated, async (req, res) => {
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
    logger.error("Error deleting collection", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to delete collection" });
  }
});

router.get("/api/collections/:id/styles", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const collection = await storage.getCollectionById(req.params.id);
    
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    if (collection.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const styles = await storage.getCollectionStyleSummaries(req.params.id);
    res.json(styles);
  } catch (error) {
    logger.error("Error fetching collection styles", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch collection styles" });
  }
});

router.post("/api/collections/:id/styles", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { styleId } = req.body;
    
    const collection = await storage.getCollectionById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    if (collection.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const exists = await storage.isStyleInCollection(req.params.id, styleId);
    if (exists) {
      return res.status(400).json({ error: "Style already in collection" });
    }
    
    const item = await storage.addStyleToCollection(req.params.id, styleId);
    res.status(201).json(item);
  } catch (error) {
    logger.error("Error adding style to collection", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to add style to collection" });
  }
});

router.delete("/api/collections/:id/styles/:styleId", isAuthenticated, async (req, res) => {
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
    logger.error("Error removing style from collection", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to remove style from collection" });
  }
});

router.get("/api/styles/:id/collections", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const containingCollections = await storage.getCollectionsContainingStyle(userId, req.params.id);
    res.json(containingCollections);
  } catch (error) {
    logger.error("Error fetching style collections", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch collections" });
  }
});

router.get("/api/styles/:id/versions", async (req, res) => {
  try {
    const versions = await storage.getStyleVersions(req.params.id);
    res.json(versions);
  } catch (error) {
    logger.error("Error fetching style versions", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

router.get("/api/styles/:id/versions/:versionId", async (req, res) => {
  try {
    const version = await storage.getStyleVersionById(req.params.versionId);
    if (!version || version.styleId !== req.params.id) {
      return res.status(404).json({ error: "Version not found" });
    }
    res.json(version);
  } catch (error) {
    logger.error("Error fetching style version", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to fetch version" });
  }
});

router.post("/api/styles/:id/versions", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const styleId = req.params.id;
    const { description } = req.body;

    const style = await storage.getStyleById(styleId);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }

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
    logger.error("Error creating style version", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to create version" });
  }
});

router.post("/api/styles/:id/versions/:versionId/revert", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { id: styleId, versionId } = req.params;

    const style = await storage.getStyleById(styleId);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }

    if (!style.creatorId) {
      return res.status(403).json({ error: "Cannot revert style with unknown creator" });
    }
    if (style.creatorId !== userId) {
      return res.status(403).json({ error: "Only the creator can revert versions" });
    }

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
    logger.error("Error reverting style version", error, { module: 'Styles' });
    res.status(500).json({ error: "Failed to revert version" });
  }
});

router.post("/api/styles/:id/generate-mood-board", async (req, res) => {
  try {
    const style = await storage.getStyleById(req.params.id);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }

    const existingMoodBoard = style.moodBoard as any || { status: "pending", history: [] };
    const existingUiConcepts = style.uiConcepts as UiConceptAssets | null || { status: "pending", history: [] };
    
    const moodBoardHistory = [...(existingMoodBoard.history || [])];
    const uiConceptsHistory = [...(existingUiConcepts.history || [])];
    
    if (existingMoodBoard.status === "complete" && existingMoodBoard.collage) {
      moodBoardHistory.unshift({
        collage: existingMoodBoard.collage,
        generatedAt: new Date().toISOString(),
      });
    }
    
    if (existingUiConcepts.status === "complete" && (existingUiConcepts.softwareApp || existingUiConcepts.audioPlugin || existingUiConcepts.dashboard)) {
      uiConceptsHistory.unshift({
        audioPlugin: existingUiConcepts.audioPlugin,
        dashboard: existingUiConcepts.dashboard,
        componentLibrary: existingUiConcepts.componentLibrary,
        generatedAt: new Date().toISOString(),
      });
    }

    const { moodBoard: newMoodBoard, uiConcepts: newUiConcepts } = await generateAllMoodBoardAssets({
      styleName: style.name,
      styleDescription: style.description,
      tokens: style.tokens,
      metadataTags: style.metadataTags || getDefaultMetadataTags(),
    });

    const moodBoardWithHistory = {
      ...newMoodBoard,
      history: moodBoardHistory,
    };
    
    const uiConceptsWithHistory = {
      ...newUiConcepts,
      history: uiConceptsHistory,
    };

    const updated = await storage.updateStyleMoodBoard(
      req.params.id,
      moodBoardWithHistory,
      uiConceptsWithHistory
    );
    
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
    logger.error("Error generating mood board", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to generate mood board",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/styles/:id/mood-board-status", async (req, res) => {
  try {
    const style = await storage.getStyleById(req.params.id);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }

    const moodBoard = style.moodBoard as any || { status: "pending" };
    const uiConcepts = style.uiConcepts as UiConceptAssets | null || { status: "pending" };

    res.json({
      moodBoard: {
        status: moodBoard.status,
        hasCollage: !!moodBoard.collage,
        historyCount: moodBoard.history?.length || 0,
      },
      uiConcepts: {
        status: uiConcepts.status,
        hasSoftwareApp: !!(uiConcepts as any).softwareApp,
        hasAudioPlugin: !!(uiConcepts as any).audioPlugin,
        hasDashboard: !!(uiConcepts as any).dashboard,
        hasComponentLibrary: !!(uiConcepts as any).componentLibrary,
        historyCount: (uiConcepts as any).history?.length || 0,
      },
    });
  } catch (error) {
    logger.error("Error getting mood board status", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to get mood board status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/styles/generate-random", async (req, res) => {
  try {
    const { generateRandomStyle } = await import("../random-style-generator");
    const style = await generateRandomStyle();
    res.json(style);
  } catch (error) {
    logger.error("Error generating random style", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to generate random style",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/styles/:id/generate-previews", async (req, res) => {
  try {
    const style = await storage.getStyleById(req.params.id);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }

    const { isProdiaEnabled } = await import("../prodia-service");
    const { generateCanonicalPreviewsWithProdia } = await import("../prodia-generation");
    
    if (!isProdiaEnabled()) {
      return res.status(503).json({
        error: "Preview generation unavailable",
        message: "Prodia service not configured",
      });
    }

    res.json({ message: "Preview generation started", styleId: style.id });

    (async () => {
      try {
        logger.info(`Generating previews for "${style.name}"`, { module: 'Styles', styleId: style.id });
        
        // Fetch reference image for style transfer
        let referenceImageBase64: string | undefined;
        if (style.referenceImages?.length) {
          const refImageId = style.referenceImages[0];
          const refImage = await getImageFromObjectStorage(refImageId, "full");
          if (refImage?.data) {
            referenceImageBase64 = refImage.data;
          }
        }
        
        const result = await generateCanonicalPreviewsWithProdia({
          styleName: style.name,
          styleDescription: style.description,
          tokens: style.tokens,
          metadataTags: style.metadataTags as Record<string, string[]> | undefined,
          referenceImageBase64,
        });

        if (!result.allFailed) {
          if (result.landscape) {
            await storeImageToObjectStorage(result.landscape, "preview_landscape", style.id);
          }
          if (result.portrait) {
            await storeImageToObjectStorage(result.portrait, "preview_portrait", style.id);
          }
          if (result.stillLife) {
            await storeImageToObjectStorage(result.stillLife, "preview_still_life", style.id);
          }
          
          await storage.updateStyleFull(style.id, {
            previews: {
              landscape: result.landscape || undefined,
              portrait: result.portrait || undefined,
              stillLife: result.stillLife || undefined,
            } as any,
          });
          
          cache.delete(CACHE_KEYS.STYLE_DETAIL(style.id));
          cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
          
          logger.info(`Previews generated for "${style.name}"`, { module: 'Styles', styleId: style.id });
        } else {
          logger.error(`All preview generation failed for "${style.name}"`, null, { module: 'Styles', styleId: style.id });
        }
      } catch (error) {
        logger.error(`Preview generation error for "${style.name}"`, error, { module: 'Styles', styleId: style.id });
      }
    })();
  } catch (error) {
    logger.error("Error starting preview generation", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to start preview generation",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/styles/:id/cv-tokens", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image data required" });
    }

    const style = await storage.getStyleById(req.params.id);
    if (!style) {
      return res.status(404).json({ error: "Style not found" });
    }

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
  } catch (error) {
    logger.error("Error extracting CV tokens for style", error, { module: 'Styles' });
    res.status(500).json({
      error: "Failed to extract CV tokens",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
