import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || "";
const PUBLIC_PATHS = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";

export interface PipelineBlobConfig {
  bucket: string;
  privateDir: string;
  publicPaths: string[];
}

export interface PipelineStorageConfig {
  blob: PipelineBlobConfig;
  database: {
    connectionString: string;
  };
  vector: {
    enabled: boolean;
    tableName: string;
  };
}

export function getPipelineStorageConfig(): PipelineStorageConfig {
  return {
    blob: {
      bucket: BUCKET_ID,
      privateDir: PRIVATE_DIR,
      publicPaths: PUBLIC_PATHS.split(",").filter(Boolean),
    },
    database: {
      connectionString: process.env.DATABASE_URL || "",
    },
    vector: {
      enabled: false,
      tableName: "style_embeddings",
    },
  };
}

export class PipelineBlobStorage {
  private bucket: ReturnType<typeof objectStorageClient.bucket>;
  private baseDir: string;

  constructor(bucketId: string, baseDir: string = ".private/pipeline") {
    const bucketName = bucketId.replace(/^\//, "");
    this.bucket = objectStorageClient.bucket(bucketName);
    this.baseDir = baseDir;
  }

  async upload(
    key: string,
    data: Buffer,
    contentType: string = "application/octet-stream",
    metadata?: Record<string, string>
  ): Promise<string> {
    const fullPath = `${this.baseDir}/${key}`;
    const file = this.bucket.file(fullPath);
    
    await file.save(data, {
      contentType,
      metadata: metadata ? { metadata } : undefined,
    });

    return fullPath;
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      const fullPath = `${this.baseDir}/${key}`;
      const file = this.bucket.file(fullPath);
      const [exists] = await file.exists();
      
      if (!exists) {
        return null;
      }

      const [contents] = await file.download();
      return contents;
    } catch (error) {
      console.error(`Failed to download ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const fullPath = `${this.baseDir}/${key}`;
      const file = this.bucket.file(fullPath);
      await file.delete();
      return true;
    } catch (error) {
      console.error(`Failed to delete ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullPath = `${this.baseDir}/${key}`;
      const file = this.bucket.file(fullPath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string | null> {
    try {
      const fullPath = `${this.baseDir}/${key}`;
      const file = this.bucket.file(fullPath);
      const [exists] = await file.exists();
      
      if (!exists) {
        return null;
      }

      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + expiresInSeconds * 1000,
      });

      return url;
    } catch (error) {
      console.error(`Failed to get signed URL for ${key}:`, error);
      return null;
    }
  }

  async list(prefix: string = ""): Promise<string[]> {
    try {
      const fullPrefix = `${this.baseDir}/${prefix}`;
      const [files] = await this.bucket.getFiles({ prefix: fullPrefix });
      return files.map(f => f.name.replace(`${this.baseDir}/`, ""));
    } catch (error) {
      console.error(`Failed to list files with prefix ${prefix}:`, error);
      return [];
    }
  }
}

export class PipelineStructuredStorage {
  async saveStyleArtifact(
    styleId: string,
    artifact: Record<string, any>
  ): Promise<boolean> {
    try {
      const existingStyle = await storage.getStyleById(styleId);
      
      if (existingStyle) {
        await storage.updateStyleFull(styleId, {
          tokens: artifact.tokens || existingStyle.tokens,
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to save style artifact ${styleId}:`, error);
      return false;
    }
  }

  async getStyleArtifact(styleId: string): Promise<Record<string, any> | null> {
    try {
      const style = await storage.getStyleById(styleId);
      
      if (!style) {
        return null;
      }

      return {
        styleId: style.id,
        name: style.name,
        tokens: style.tokens,
        promptScaffolding: style.promptScaffolding,
        metadataTags: style.metadataTags,
        createdAt: style.createdAt,
      };
    } catch (error) {
      console.error(`Failed to get style artifact ${styleId}:`, error);
      return null;
    }
  }

  async listStyles(
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<{ id: string; name: string }>> {
    try {
      const styles = await storage.getStyleSummaries();
      return styles.slice(offset, offset + limit).map(s => ({
        id: s.id,
        name: s.name,
      }));
    } catch (error) {
      console.error("Failed to list styles:", error);
      return [];
    }
  }
}

export class PipelineVectorStorage {
  private tableName: string;
  private initialized: boolean = false;

  constructor(tableName: string = "style_embeddings") {
    this.tableName = tableName;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.raw(this.tableName)} (
          id TEXT PRIMARY KEY,
          embedding vector(768),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ${sql.raw(this.tableName + "_embedding_idx")}
        ON ${sql.raw(this.tableName)}
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);
      
      this.initialized = true;
      console.log("[PipelineVectorStorage] Initialized with pgvector");
    } catch (error) {
      console.warn("[PipelineVectorStorage] pgvector not available, using fallback");
    }
  }

  async upsert(
    id: string,
    embedding: number[],
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      await this.initialize();
      
      if (!this.initialized) {
        return false;
      }

      const embeddingStr = `[${embedding.join(",")}]`;
      
      await db.execute(sql`
        INSERT INTO ${sql.raw(this.tableName)} (id, embedding, metadata)
        VALUES (${id}, ${embeddingStr}::vector, ${JSON.stringify(metadata)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata
      `);
      
      return true;
    } catch (error) {
      console.error(`Failed to upsert embedding for ${id}:`, error);
      return false;
    }
  }

  async search(
    queryEmbedding: number[],
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
    try {
      await this.initialize();
      
      if (!this.initialized) {
        return [];
      }

      const embeddingStr = `[${queryEmbedding.join(",")}]`;
      
      const results = await db.execute(sql`
        SELECT id, metadata, 1 - (embedding <=> ${embeddingStr}::vector) as score
        FROM ${sql.raw(this.tableName)}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `);
      
      return (results.rows as any[]).map(row => ({
        id: row.id,
        score: row.score,
        metadata: row.metadata,
      }));
    } catch (error) {
      console.error("Vector search failed:", error);
      return [];
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await db.execute(sql`
        DELETE FROM ${sql.raw(this.tableName)} WHERE id = ${id}
      `);
      return true;
    } catch (error) {
      console.error(`Failed to delete embedding ${id}:`, error);
      return false;
    }
  }
}

export const pipelineBlobStorage = new PipelineBlobStorage(BUCKET_ID);
export const pipelineStructuredStorage = new PipelineStructuredStorage();
export const pipelineVectorStorage = new PipelineVectorStorage();

export async function initializePipelineStorage(): Promise<{
  blob: boolean;
  structured: boolean;
  vector: boolean;
}> {
  const results = {
    blob: false,
    structured: false,
    vector: false,
  };

  try {
    results.blob = Boolean(BUCKET_ID);
    console.log(`[Pipeline Storage] Blob storage: ${results.blob ? "ready" : "not configured"}`);
  } catch (error) {
    console.error("[Pipeline Storage] Blob storage initialization failed:", error);
  }

  try {
    await db.execute(sql`SELECT 1`);
    results.structured = true;
    console.log("[Pipeline Storage] Structured storage: ready");
  } catch (error) {
    console.error("[Pipeline Storage] Structured storage initialization failed:", error);
  }

  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.execute(sql`SELECT 'test'::vector(3)`);
    results.vector = true;
    console.log("[Pipeline Storage] Vector storage: ready (pgvector enabled)");
  } catch (error: any) {
    results.vector = false;
    const message = error?.message || String(error);
    if (message.includes("type \"vector\" does not exist")) {
      console.warn("[Pipeline Storage] Vector storage not available (pgvector extension not installed)");
    } else {
      console.warn(`[Pipeline Storage] Vector storage initialization failed: ${message}`);
    }
  }

  return results;
}
