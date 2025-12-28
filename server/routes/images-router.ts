import { Router } from "express";
import { storage } from "../storage";
import { cache, CACHE_KEYS } from "../cache";
import { generateCanonicalPreviews } from "../preview-generation";
import { generateStyledImage } from "../image-generation";
import { getDefaultMetadataTags } from "./utils";
import { logger } from "../logger";

const router = Router();

router.get("/api/images/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const size = (req.query.size as string) || "medium";
    
    if (!["thumb", "medium", "full"].includes(size)) {
      return res.status(400).json({ error: "Invalid size. Use: thumb, medium, or full" });
    }
    
    const { getImageFromObjectStorage } = await import("../object-image-service");
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
    
    const { getImage } = await import("../image-service");
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
    logger.error("Error serving image", error, { module: 'Images' });
    res.status(500).json({ error: "Failed to serve image" });
  }
});

router.post("/api/admin/migrate-images", async (req, res) => {
  try {
    const { migrateStyleImages } = await import("../image-service");
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
    logger.error("Migration error", error, { module: 'Images' });
    res.status(500).json({ error: "Migration failed" });
  }
});

router.post("/api/admin/enrich-style-specs", async (req, res) => {
  try {
    const { enrichAllStyleSpecs } = await import("../metadata-enrichment");
    const result = await enrichAllStyleSpecs();
    res.json({
      message: `Processed ${result.processed} styles, ${result.success} succeeded`,
      ...result,
    });
  } catch (error) {
    logger.error("Style spec enrichment error", error, { module: 'Images' });
    res.status(500).json({ error: "Style spec enrichment failed" });
  }
});

router.post("/api/admin/regenerate-software-app", async (req, res) => {
  try {
    const allStyles = await storage.getStyles();
    
    (async () => {
      const { generateSingleUiConcept } = await import("../mood-board-generation");
      const { storeImageToObjectStorage } = await import("../object-image-service");
      
      logger.info(`Starting softwareApp regeneration for ${allStyles.length} styles`, { module: 'Images' });
      let successCount = 0;
      let errorCount = 0;
      
      for (const style of allStyles) {
        try {
          logger.info(`Generating softwareApp for "${style.name}"`, { module: 'Images', styleId: style.id });
          const softwareApp = await generateSingleUiConcept({
            styleName: style.name,
            styleDescription: style.description,
            tokens: style.tokens,
            metadataTags: style.metadataTags || getDefaultMetadataTags(),
          }, "softwareApp");
          
          if (softwareApp) {
            await storeImageToObjectStorage(softwareApp, "ui_software_app", style.id);
            
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
            logger.info(`Completed "${style.name}" (${successCount}/${allStyles.length})`, { module: 'Images', styleId: style.id });
          } else {
            errorCount++;
            logger.warn(`Failed "${style.name}" - null result`, { module: 'Images', styleId: style.id });
          }
        } catch (err) {
          errorCount++;
          logger.error(`Error for "${style.name}"`, err, { module: 'Images', styleId: style.id });
        }
      }
      
      cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
      logger.info(`Regeneration complete: ${successCount} succeeded, ${errorCount} failed`, { module: 'Images' });
    })();
    
    res.json({
      message: `Started regeneration for ${allStyles.length} styles in background. Check server logs for progress.`,
      styleCount: allStyles.length,
    });
  } catch (error) {
    logger.error("Software app regeneration error", error, { module: 'Images' });
    res.status(500).json({ error: "Software app regeneration failed" });
  }
});

router.post("/api/generate-previews", async (req, res) => {
  try {
    const { styleName, styleDescription, referenceImageBase64, tokens, useProdia = true } = req.body;

    if (!styleName || !styleDescription) {
      return res.status(400).json({ error: "Style name and description required" });
    }

    const { isProdiaEnabled } = await import("../prodia-service");
    if (useProdia && isProdiaEnabled()) {
      const { generateCanonicalPreviewsWithProdia } = await import("../prodia-generation");
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
    logger.error("Error generating previews", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to generate preview images",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/generate-image", async (req, res) => {
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
    logger.error("Error generating image", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to generate image",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/generate/prodia", async (req, res) => {
  try {
    const { prompt, seed, styleId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const { isProdiaEnabled, generateWithFluxSchnell } = await import("../prodia-service");

    if (!isProdiaEnabled()) {
      return res.status(503).json({
        error: "Prodia is not configured",
        message: "PRODIA_TOKEN environment variable is not set",
      });
    }

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
    logger.error("Error in Prodia generation", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to generate image",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/generate/prodia/previews", async (req, res) => {
  try {
    const { styleName, styleDescription, tokens } = req.body;

    if (!styleName || !styleDescription) {
      return res.status(400).json({ error: "Style name and description required" });
    }

    const { generateCanonicalPreviewsWithProdia } = await import("../prodia-generation");

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
    logger.error("Error in Prodia preview generation", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to generate previews",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/generate/prodia/mood-board", async (req, res) => {
  try {
    const { styleName, styleDescription, tokens, metadataTags } = req.body;

    if (!styleName || !styleDescription) {
      return res.status(400).json({ error: "Style name and description required" });
    }

    const { generateMoodBoardWithProdia } = await import("../prodia-generation");

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
    logger.error("Error in Prodia mood board generation", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to generate mood board",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/generate/prodia/ui-concepts", async (req, res) => {
  try {
    const { styleName, styleDescription, tokens, metadataTags } = req.body;

    if (!styleName || !styleDescription) {
      return res.status(400).json({ error: "Style name and description required" });
    }

    const { generateUiConceptsWithProdia } = await import("../prodia-generation");

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
    logger.error("Error in Prodia UI concepts generation", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to generate UI concepts",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/api/generate/prodia/all-assets", async (req, res) => {
  try {
    const { styleName, styleDescription, tokens, metadataTags } = req.body;

    if (!styleName || !styleDescription) {
      return res.status(400).json({ error: "Style name and description required" });
    }

    const { generateAllAssetsWithProdia } = await import("../prodia-generation");

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
    logger.error("Error in Prodia all assets generation", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to generate assets",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/generated-images", async (req, res) => {
  try {
    const images = await storage.getGeneratedImages();
    res.json(images);
  } catch (error) {
    logger.error("Error fetching generated images", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to fetch generated images",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/generated-images/style/:styleId", async (req, res) => {
  try {
    const images = await storage.getGeneratedImagesByStyle(req.params.styleId);
    res.json(images);
  } catch (error) {
    logger.error("Error fetching generated images by style", error, { module: 'Images' });
    res.status(500).json({
      error: "Failed to fetch generated images",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
