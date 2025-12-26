import crypto from "crypto";
import { db } from "./db";
import { tokenCache, type InsertTokenCache } from "@shared/schema";
import { eq } from "drizzle-orm";

const CACHE_EXPIRY_DAYS = 30;

/**
 * Cache types for granular CV extraction step caching.
 * Each step can be cached independently to avoid redundant computations.
 */
export type CVCacheType = 'color' | 'layout' | 'ocr' | 'elevation' | 'combined';

/**
 * Analysis settings that affect extraction results.
 * Including these in the cache key ensures different settings produce separate cache entries.
 */
export interface AnalysisSettings {
  deepAnalysis?: boolean;
  colorSpace?: string;
  maxColors?: number;
}

/**
 * Cache statistics for monitoring hit rates.
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  stepHits: Record<CVCacheType, number>;
  stepMisses: Record<CVCacheType, number>;
}

const cacheMetrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  stepHits: { color: 0, layout: 0, ocr: 0, elevation: 0, combined: 0 },
  stepMisses: { color: 0, layout: 0, ocr: 0, elevation: 0, combined: 0 },
};

export function getCacheMetrics(): CacheMetrics {
  return {
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    stepHits: { ...cacheMetrics.stepHits },
    stepMisses: { ...cacheMetrics.stepMisses },
  };
}

export function resetCacheMetrics(): void {
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  cacheMetrics.stepHits = { color: 0, layout: 0, ocr: 0, elevation: 0, combined: 0 };
  cacheMetrics.stepMisses = { color: 0, layout: 0, ocr: 0, elevation: 0, combined: 0 };
}

export function computeImageHash(base64Data: string): string {
  const data = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
}

/**
 * Compute a cache key that includes step type and analysis settings.
 * This allows granular caching of individual extraction steps.
 */
export function computeStepCacheKey(
  imageHash: string,
  stepType: CVCacheType,
  settings?: AnalysisSettings
): string {
  const settingsHash = settings 
    ? crypto.createHash("md5").update(JSON.stringify(settings)).digest("hex").substring(0, 8)
    : "default";
  return `${stepType}:${imageHash}:${settingsHash}`;
}

export async function getCachedTokens(imageHash: string): Promise<Record<string, any> | null> {
  try {
    const [cached] = await db
      .select()
      .from(tokenCache)
      .where(eq(tokenCache.imageHash, imageHash));
    
    if (!cached) {
      cacheMetrics.misses++;
      console.log(`[Token Cache] MISS for hash ${imageHash.substring(0, 8)}...`);
      return null;
    }
    
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      await db.delete(tokenCache).where(eq(tokenCache.imageHash, imageHash));
      cacheMetrics.misses++;
      console.log(`[Token Cache] EXPIRED for hash ${imageHash.substring(0, 8)}...`);
      return null;
    }
    
    cacheMetrics.hits++;
    console.log(`[Token Cache] HIT for hash ${imageHash.substring(0, 8)}... (total hits: ${cacheMetrics.hits})`);
    return cached.tokens;
  } catch (error) {
    console.error("[Token Cache] Error reading cache:", error);
    return null;
  }
}

/**
 * Get cached results for a specific extraction step.
 * Uses composite key: stepType:imageHash:settingsHash
 */
export async function getCachedStep(
  imageHash: string,
  stepType: CVCacheType,
  settings?: AnalysisSettings
): Promise<Record<string, any> | null> {
  const cacheKey = computeStepCacheKey(imageHash, stepType, settings);
  
  try {
    const [cached] = await db
      .select()
      .from(tokenCache)
      .where(eq(tokenCache.imageHash, cacheKey));
    
    if (!cached) {
      cacheMetrics.stepMisses[stepType]++;
      console.log(`[CV Cache] MISS ${stepType} for ${imageHash.substring(0, 8)}...`);
      return null;
    }
    
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      await db.delete(tokenCache).where(eq(tokenCache.imageHash, cacheKey));
      cacheMetrics.stepMisses[stepType]++;
      console.log(`[CV Cache] EXPIRED ${stepType} for ${imageHash.substring(0, 8)}...`);
      return null;
    }
    
    cacheMetrics.stepHits[stepType]++;
    console.log(`[CV Cache] HIT ${stepType} for ${imageHash.substring(0, 8)}... (${stepType} hits: ${cacheMetrics.stepHits[stepType]})`);
    return cached.tokens;
  } catch (error) {
    console.error(`[CV Cache] Error reading ${stepType} cache:`, error);
    return null;
  }
}

/**
 * Cache results for a specific extraction step.
 */
export async function setCachedStep(
  imageHash: string,
  stepType: CVCacheType,
  data: Record<string, any>,
  processingTimeMs?: number,
  settings?: AnalysisSettings
): Promise<void> {
  const cacheKey = computeStepCacheKey(imageHash, stepType, settings);
  
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_EXPIRY_DAYS);
    
    await db
      .insert(tokenCache)
      .values({
        imageHash: cacheKey,
        tokens: data,
        extractionMethod: `cv-${stepType}`,
        processingTimeMs,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: tokenCache.imageHash,
        set: {
          tokens: data,
          processingTimeMs,
          expiresAt,
        },
      });
    
    console.log(`[CV Cache] STORED ${stepType} for ${imageHash.substring(0, 8)}... (${processingTimeMs}ms)`);
  } catch (error) {
    console.error(`[CV Cache] Error storing ${stepType} cache:`, error);
  }
}

export async function setCachedTokens(
  imageHash: string,
  tokens: Record<string, any>,
  processingTimeMs?: number
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_EXPIRY_DAYS);
    
    await db
      .insert(tokenCache)
      .values({
        imageHash,
        tokens,
        extractionMethod: "cv",
        processingTimeMs,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: tokenCache.imageHash,
        set: {
          tokens,
          processingTimeMs,
          expiresAt,
        },
      });
    
    console.log(`[Token Cache] Stored tokens for hash ${imageHash.substring(0, 8)}...`);
  } catch (error) {
    console.error("[Token Cache] Error storing cache:", error);
  }
}

export async function invalidateCache(imageHash: string): Promise<void> {
  try {
    await db.delete(tokenCache).where(eq(tokenCache.imageHash, imageHash));
    console.log(`[Token Cache] Invalidated cache for hash ${imageHash.substring(0, 8)}...`);
  } catch (error) {
    console.error("[Token Cache] Error invalidating cache:", error);
  }
}

export async function clearExpiredCache(): Promise<number> {
  try {
    const result = await db
      .delete(tokenCache)
      .where(eq(tokenCache.expiresAt, new Date()));
    
    return 0;
  } catch (error) {
    console.error("[Token Cache] Error clearing expired cache:", error);
    return 0;
  }
}

export async function getCacheStats(): Promise<{ total: number; hitRate?: number }> {
  try {
    const result = await db.select().from(tokenCache);
    return { total: result.length };
  } catch (error) {
    console.error("[Token Cache] Error getting stats:", error);
    return { total: 0 };
  }
}
