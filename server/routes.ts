import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeImageForStyle } from "./analysis";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  return httpServer;
}
