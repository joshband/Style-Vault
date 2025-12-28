import { Router } from "express";
import { visionService } from "../vision-service";
import { analyzeImageCombined } from "../combined-analysis";
import { generateComprehensiveDTCG } from "../comprehensive-dtcg";

const router = Router();

router.get("/api/vision/status", async (req, res) => {
  const status = visionService.getStatus();
  res.json({
    available: status.available || visionService.isAvailable(),
    error: status.error,
    timestamp: new Date().toISOString(),
  });
});

router.post("/api/vision/analyze", async (req, res) => {
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

router.post("/api/vision/labels", async (req, res) => {
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

router.post("/api/vision/colors", async (req, res) => {
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

router.post("/api/analyze/comprehensive", async (req, res) => {
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

export default router;
