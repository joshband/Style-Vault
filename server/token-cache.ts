import crypto from "crypto";
import { db } from "./db";
import { tokenCache, type InsertTokenCache } from "@shared/schema";
import { eq } from "drizzle-orm";

const CACHE_EXPIRY_DAYS = 30;

export function computeImageHash(base64Data: string): string {
  const data = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
}

export async function getCachedTokens(imageHash: string): Promise<Record<string, any> | null> {
  try {
    const [cached] = await db
      .select()
      .from(tokenCache)
      .where(eq(tokenCache.imageHash, imageHash));
    
    if (!cached) return null;
    
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      await db.delete(tokenCache).where(eq(tokenCache.imageHash, imageHash));
      return null;
    }
    
    console.log(`[Token Cache] Hit for hash ${imageHash.substring(0, 8)}...`);
    return cached.tokens;
  } catch (error) {
    console.error("[Token Cache] Error reading cache:", error);
    return null;
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
