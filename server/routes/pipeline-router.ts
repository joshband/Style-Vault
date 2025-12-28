import { Router } from "express";
import { pipelineBridge } from "../pipeline-bridge";
import { initializePipelineStorage, getPipelineStorageConfig } from "../pipeline-storage";

const router = Router();

router.get("/api/pipeline/storage", async (req, res) => {
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

router.get("/api/pipeline/health", async (req, res) => {
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

router.post("/api/pipeline/validate-tokens", async (req, res) => {
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

router.post("/api/pipeline/assemble", async (req, res) => {
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

router.get("/api/pipeline/search", async (req, res) => {
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

router.post("/api/pipeline/detect-components", async (req, res) => {
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

router.post("/api/pipeline/material-signature", async (req, res) => {
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

router.post("/api/pipeline/enrich-style", async (req, res) => {
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

router.get("/api/pipeline/recipes", async (req, res) => {
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

router.get("/api/pipeline/recipes/:id", async (req, res) => {
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

router.get("/api/pipeline/status", async (req, res) => {
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

router.post("/api/pipeline/classify-ai", async (req, res) => {
  try {
    const { image, components, materialSignals, textureSignals } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: "Image data required (base64)" });
    }
    
    const { classifyComponentsWithAI } = await import("../component-ai-classification");
    
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

router.post("/api/pipeline/material-tokens-ai", async (req, res) => {
  try {
    const { image, recipeMatch, materialSignals, textureSignals } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: "Image data required (base64)" });
    }
    
    const { generateMaterialTokensWithAI } = await import("../component-ai-classification");
    
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

export default router;
