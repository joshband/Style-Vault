import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeImageForStyle } from "./analysis";
import { generateCanonicalPreviews } from "./preview-generation";
import { storage } from "./storage";
import { insertStyleSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all styles
  app.get("/api/styles", async (req, res) => {
    try {
      const styles = await storage.getStyles();
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
      const style = await storage.getStyleById(req.params.id);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
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
      await storage.deleteStyle(req.params.id);
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

  return httpServer;
}
