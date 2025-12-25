import { type User, type InsertUser, type Style, type InsertStyle, type GeneratedImage, type InsertGeneratedImage, type MoodBoardAssets, type UiConceptAssets, type MetadataTags, type MetadataEnrichmentStatus, type Job, type InsertJob, type JobStatus, type JobType, type Batch, type InsertBatch, users, styles, generatedImages, jobs, batches } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, inArray } from "drizzle-orm";

export interface StyleSummary {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  metadataTags: any;
  moodBoardStatus: string;
  uiConceptsStatus: string;
  thumbnailPreview: string | null;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Style operations
  getStyles(): Promise<Style[]>;
  getStyleSummaries(): Promise<StyleSummary[]>;
  getStyleById(id: string): Promise<Style | undefined>;
  createStyle(style: InsertStyle): Promise<Style>;
  deleteStyle(id: string): Promise<void>;
  updateStyleMoodBoard(id: string, moodBoard: MoodBoardAssets, uiConcepts: UiConceptAssets): Promise<Style | undefined>;
  
  // Generated images operations (admin only)
  getGeneratedImages(): Promise<GeneratedImage[]>;
  getGeneratedImagesByStyle(styleId: string): Promise<GeneratedImage[]>;
  createGeneratedImage(image: InsertGeneratedImage): Promise<GeneratedImage>;

  // Job operations for async task tracking
  createJob(job: InsertJob): Promise<Job>;
  getJobById(id: string): Promise<Job | undefined>;
  getJobsByStyleId(styleId: string): Promise<Job[]>;
  getJobsByBatchId(batchId: string): Promise<Job[]>;
  getActiveJobs(): Promise<Job[]>;
  getRecentJobs(limit?: number): Promise<Job[]>;
  updateJobStatus(id: string, status: JobStatus, updates?: {
    progress?: number;
    progressMessage?: string;
    output?: Record<string, any>;
    error?: string;
  }): Promise<Job | undefined>;
  incrementJobRetry(id: string): Promise<Job | undefined>;
  cleanupOldJobs(olderThanDays?: number): Promise<number>;

  // Batch operations
  createBatch(batch: InsertBatch): Promise<Batch>;
  getBatchById(id: string): Promise<Batch | undefined>;
  updateBatchProgress(id: string, completedItems: number, failedItems: number): Promise<Batch | undefined>;
  updateBatchStatus(id: string, status: JobStatus): Promise<Batch | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Style operations
  async getStyles(): Promise<Style[]> {
    return db.select().from(styles).orderBy(desc(styles.createdAt));
  }

  async getStyleSummaries(): Promise<StyleSummary[]> {
    const allStyles = await db
      .select({
        id: styles.id,
        name: styles.name,
        description: styles.description,
        createdAt: styles.createdAt,
        metadataTags: styles.metadataTags,
        moodBoard: styles.moodBoard,
        uiConcepts: styles.uiConcepts,
        previews: styles.previews,
      })
      .from(styles)
      .orderBy(desc(styles.createdAt));
    
    return allStyles.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      createdAt: s.createdAt,
      metadataTags: s.metadataTags,
      moodBoardStatus: (s.moodBoard as any)?.status || "pending",
      uiConceptsStatus: (s.uiConcepts as any)?.status || "pending",
      thumbnailPreview: (s.previews as any)?.landscape || (s.previews as any)?.portrait || null,
    }));
  }

  async getStyleById(id: string): Promise<Style | undefined> {
    const [style] = await db.select().from(styles).where(eq(styles.id, id));
    return style;
  }

  async createStyle(insertStyle: InsertStyle): Promise<Style> {
    const [style] = await db.insert(styles).values(insertStyle).returning();
    return style;
  }

  async deleteStyle(id: string): Promise<void> {
    await db.delete(styles).where(eq(styles.id, id));
  }

  async updateStyleMoodBoard(id: string, moodBoard: MoodBoardAssets, uiConcepts: UiConceptAssets): Promise<Style | undefined> {
    const [updated] = await db
      .update(styles)
      .set({ moodBoard, uiConcepts })
      .where(eq(styles.id, id))
      .returning();
    return updated;
  }

  // Generated images operations
  async getGeneratedImages(): Promise<GeneratedImage[]> {
    return db.select().from(generatedImages).orderBy(desc(generatedImages.createdAt));
  }

  async getGeneratedImagesByStyle(styleId: string): Promise<GeneratedImage[]> {
    return db.select().from(generatedImages).where(eq(generatedImages.styleId, styleId)).orderBy(desc(generatedImages.createdAt));
  }

  async createGeneratedImage(insertImage: InsertGeneratedImage): Promise<GeneratedImage> {
    const [image] = await db.insert(generatedImages).values(insertImage).returning();
    return image;
  }

  // Metadata enrichment operations
  async updateStyleEnrichmentStatus(id: string, status: MetadataEnrichmentStatus): Promise<void> {
    await db
      .update(styles)
      .set({ metadataEnrichmentStatus: status })
      .where(eq(styles.id, id));
  }

  async updateStyleMetadata(id: string, metadataTags: MetadataTags, status: MetadataEnrichmentStatus): Promise<Style | undefined> {
    const normalizedTags: MetadataTags = {
      // Core visual characteristics
      mood: metadataTags.mood || [],
      colorFamily: metadataTags.colorFamily || [],
      lighting: metadataTags.lighting || [],
      texture: metadataTags.texture || [],
      // Art historical context
      era: metadataTags.era || [],
      artPeriod: metadataTags.artPeriod || [],
      historicalInfluences: metadataTags.historicalInfluences || [],
      similarArtists: metadataTags.similarArtists || [],
      // Technical aspects
      medium: metadataTags.medium || [],
      subjects: metadataTags.subjects || [],
      // Application guidance
      usageExamples: metadataTags.usageExamples || [],
      // Subjective Visual DNA - Emotional Resonance
      narrativeTone: metadataTags.narrativeTone || [],
      sensoryPalette: metadataTags.sensoryPalette || [],
      movementRhythm: metadataTags.movementRhythm || [],
      // Subjective Visual DNA - Design Voice
      stylisticPrinciples: metadataTags.stylisticPrinciples || [],
      signatureMotifs: metadataTags.signatureMotifs || [],
      contrastDynamics: metadataTags.contrastDynamics || [],
      // Subjective Visual DNA - Experiential Impact
      psychologicalEffect: metadataTags.psychologicalEffect || [],
      culturalResonance: metadataTags.culturalResonance || [],
      audiencePerception: metadataTags.audiencePerception || [],
      // Search keywords
      keywords: metadataTags.keywords || [],
      version: metadataTags.version,
      lastAnalyzedAt: metadataTags.lastAnalyzedAt,
    };
    
    const [updated] = await db
      .update(styles)
      .set({ metadataTags: normalizedTags, metadataEnrichmentStatus: status })
      .where(eq(styles.id, id))
      .returning();
    return updated;
  }

  async getStylesByEnrichmentStatus(status: MetadataEnrichmentStatus): Promise<Style[]> {
    return db
      .select()
      .from(styles)
      .where(eq(styles.metadataEnrichmentStatus, status))
      .orderBy(desc(styles.createdAt));
  }

  // Job operations for async task tracking
  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getJobsByStyleId(styleId: string): Promise<Job[]> {
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.styleId, styleId))
      .orderBy(desc(jobs.createdAt));
  }

  async getActiveJobs(): Promise<Job[]> {
    return db
      .select()
      .from(jobs)
      .where(inArray(jobs.status, ["queued", "running"]))
      .orderBy(desc(jobs.createdAt));
  }

  async getRecentJobs(limit: number = 50): Promise<Job[]> {
    return db
      .select()
      .from(jobs)
      .orderBy(desc(jobs.createdAt))
      .limit(limit);
  }

  async updateJobStatus(id: string, status: JobStatus, updates?: {
    progress?: number;
    progressMessage?: string;
    output?: Record<string, any>;
    error?: string;
  }): Promise<Job | undefined> {
    const now = new Date();
    const setValues: Partial<Job> = { status };
    
    if (status === "running" && updates?.progress === undefined) {
      setValues.startedAt = now;
    }
    if (status === "succeeded" || status === "failed" || status === "canceled") {
      setValues.completedAt = now;
    }
    if (updates?.progress !== undefined) {
      setValues.progress = updates.progress;
    }
    if (updates?.progressMessage !== undefined) {
      setValues.progressMessage = updates.progressMessage;
    }
    if (updates?.output !== undefined) {
      setValues.output = updates.output;
    }
    if (updates?.error !== undefined) {
      setValues.error = updates.error;
    }

    const [updated] = await db
      .update(jobs)
      .set(setValues)
      .where(eq(jobs.id, id))
      .returning();
    return updated;
  }

  async incrementJobRetry(id: string): Promise<Job | undefined> {
    const job = await this.getJobById(id);
    if (!job) return undefined;

    const [updated] = await db
      .update(jobs)
      .set({ 
        retryCount: job.retryCount + 1,
        status: "queued" as JobStatus,
        error: null,
        startedAt: null,
        completedAt: null,
      })
      .where(eq(jobs.id, id))
      .returning();
    return updated;
  }

  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    const result = await db
      .delete(jobs)
      .where(
        and(
          inArray(jobs.status, ["succeeded", "failed", "canceled"]),
          eq(jobs.completedAt, cutoff) // Note: This needs proper comparison
        )
      );
    return 0; // Drizzle doesn't easily return affected row count
  }

  async getJobsByBatchId(batchId: string): Promise<Job[]> {
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.batchId, batchId))
      .orderBy(desc(jobs.createdAt));
  }

  // Batch operations
  async createBatch(insertBatch: InsertBatch): Promise<Batch> {
    const [batch] = await db.insert(batches).values(insertBatch).returning();
    return batch;
  }

  async getBatchById(id: string): Promise<Batch | undefined> {
    const [batch] = await db.select().from(batches).where(eq(batches.id, id));
    return batch;
  }

  async updateBatchProgress(id: string, completedItems: number, failedItems: number): Promise<Batch | undefined> {
    const batch = await this.getBatchById(id);
    if (!batch) return undefined;

    const isComplete = (completedItems + failedItems) >= batch.totalItems;
    const status = isComplete 
      ? (failedItems === batch.totalItems ? "failed" : "succeeded")
      : "running";

    const [updated] = await db
      .update(batches)
      .set({ 
        completedItems, 
        failedItems,
        status,
        completedAt: isComplete ? new Date() : null,
      })
      .where(eq(batches.id, id))
      .returning();
    return updated;
  }

  async updateBatchStatus(id: string, status: JobStatus): Promise<Batch | undefined> {
    const [updated] = await db
      .update(batches)
      .set({ 
        status,
        completedAt: (status === "succeeded" || status === "failed" || status === "canceled") ? new Date() : null,
      })
      .where(eq(batches.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
