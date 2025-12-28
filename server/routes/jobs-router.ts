import { Router } from "express";
import { storage } from "../storage";
import { getJobProgress, startJobInBackground, cancelJob, retryJob } from "../job-runner";
import { analyzeImageForStyle } from "../analysis";
import { generateCanonicalPreviews } from "../preview-generation";

const router = Router();

router.get("/api/jobs", async (req, res) => {
  try {
    const { styleId } = req.query;
    
    if (styleId && typeof styleId === "string") {
      const jobs = await storage.getJobsByStyleId(styleId);
      return res.json(jobs.map(job => ({
        ...getJobProgress(job),
        id: job.id,
        type: job.type,
        styleId: job.styleId,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })));
    }
    
    const jobs = await storage.getActiveJobs();
    res.json(jobs.map(job => ({
      ...getJobProgress(job),
      id: job.id,
      type: job.type,
      styleId: job.styleId,
      createdAt: job.createdAt,
    })));
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/api/jobs/:id", async (req, res) => {
  try {
    const job = await storage.getJobById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    res.json({
      ...getJobProgress(job),
      id: job.id,
      type: job.type,
      output: job.output,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

router.post("/api/jobs/:id/cancel", async (req, res) => {
  try {
    const job = await cancelJob(req.params.id);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    res.json({
      ...getJobProgress(job),
      id: job.id,
    });
  } catch (error) {
    console.error("Error canceling job:", error);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

router.get("/api/jobs/active", async (req, res) => {
  try {
    const jobs = await storage.getActiveJobs();
    res.json(jobs.map(job => ({
      ...getJobProgress(job),
      id: job.id,
      type: job.type,
      styleId: job.styleId,
      createdAt: job.createdAt,
    })));
  } catch (error) {
    console.error("Error fetching active jobs:", error);
    res.status(500).json({ error: "Failed to fetch active jobs" });
  }
});

router.post("/api/jobs/analyze-image", async (req, res) => {
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

router.post("/api/jobs/generate-previews", async (req, res) => {
  try {
    const { styleName, styleDescription, referenceImageBase64, tokens, useProdia = true } = req.body;

    if (!styleName || !styleDescription) {
      return res.status(400).json({ error: "Style name and description required" });
    }

    const job = await startJobInBackground(
      "preview_generation",
      { styleName, styleDescription, referenceImageBase64, tokens, useProdia },
      async (input, onProgress) => {
        const { isProdiaEnabled } = await import("../prodia-service");
        if (input.useProdia && isProdiaEnabled()) {
          const { generateCanonicalPreviewsWithProdia } = await import("../prodia-generation");
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
      { maxRetries: 2, timeoutMs: 60000 }
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

router.get("/api/styles/:id/jobs", async (req, res) => {
  try {
    const jobs = await storage.getJobsByStyleId(req.params.id);
    res.json(jobs.map(job => ({
      ...getJobProgress(job),
      id: job.id,
      type: job.type,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })));
  } catch (error) {
    console.error("Error fetching style jobs:", error);
    res.status(500).json({ error: "Failed to fetch style jobs" });
  }
});

router.post("/api/jobs/:id/retry", async (req, res) => {
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

router.post("/api/batch/create", async (req, res) => {
  try {
    const { images } = req.body;
    
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }
    
    if (images.length > 10) {
      return res.status(400).json({ error: "Maximum 10 images per batch" });
    }

    const batch = await storage.createBatch({
      status: "running",
      totalItems: images.length,
      completedItems: 0,
      failedItems: 0,
    });

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

    const { processBatchInBackground } = await import("./batch-processing");
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

router.get("/api/batch/:id", async (req, res) => {
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

export default router;
