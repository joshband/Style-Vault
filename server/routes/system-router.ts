import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";
import { isCVExtractionEnabled } from "../cv-bridge";
import { getCacheStats, getCacheMetrics, resetCacheMetrics } from "../token-cache";
import { logger } from "../logger";

const router = Router();

router.get("/api/health", async (req, res) => {
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
    logger.error("Health check failed", error, { module: 'System' });
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown",
    });
  }
});

router.get("/api/diagnostics", async (req, res) => {
  try {
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

    const cvEnabled = isCVExtractionEnabled();

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
    logger.error("Diagnostics error", error, { module: 'System' });
    res.status(500).json({
      error: "Failed to gather diagnostics",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/api/ready", async (req, res) => {
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

router.get("/api/live", (req, res) => {
  res.status(200).json({
    live: true,
    timestamp: new Date().toISOString(),
  });
});

router.get("/api/cv-status", (req, res) => {
  res.json({
    enabled: isCVExtractionEnabled(),
    message: isCVExtractionEnabled() 
      ? "CV extraction is enabled" 
      : "CV extraction is disabled. Set CV_EXTRACTION_ENABLED=true to enable.",
  });
});

router.get("/api/cache/metrics", async (req, res) => {
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
    logger.error("Cache metrics error", error, { module: 'System' });
    res.status(500).json({ error: "Failed to get cache metrics" });
  }
});

router.post("/api/cache/metrics/reset", (req, res) => {
  resetCacheMetrics();
  logger.info("Cache metrics reset", { module: 'System' });
  res.json({ message: "Cache metrics reset successfully" });
});

router.get("/api/prodia-status", async (req, res) => {
  const { isProdiaEnabled } = await import("../prodia-service");
  res.json({
    enabled: isProdiaEnabled(),
    message: isProdiaEnabled()
      ? "Prodia is configured and ready"
      : "Prodia is not configured. Set PRODIA_TOKEN to enable fast generation.",
  });
});

export default router;
