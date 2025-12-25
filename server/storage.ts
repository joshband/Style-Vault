import { type User, type InsertUser, type Style, type InsertStyle, type GeneratedImage, type InsertGeneratedImage, type MoodBoardAssets, type UiConceptAssets, type MetadataTags, type MetadataEnrichmentStatus, type Job, type InsertJob, type JobStatus, type JobType, type Batch, type InsertBatch, type StyleSpec, type ImageAssetType, users, styles, generatedImages, jobs, batches, imageAssets } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, inArray, sql } from "drizzle-orm";

export interface StyleSummary {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  metadataTags: any;
  moodBoardStatus: string;
  uiConceptsStatus: string;
  thumbnailPreview: string | null;
  imageIds?: Record<string, string>;
}

export interface PaginatedStyleSummaries {
  items: StyleSummary[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Style operations
  getStyles(): Promise<Style[]>;
  getStyleSummaries(): Promise<StyleSummary[]>;
  getStyleSummariesPaginated(limit: number, cursor?: string): Promise<PaginatedStyleSummaries>;
  getStyleCount(): Promise<number>;
  getStyleById(id: string): Promise<Style | undefined>;
  getStyleByShareCode(shareCode: string): Promise<Style | undefined>;
  createStyle(style: InsertStyle): Promise<Style>;
  deleteStyle(id: string): Promise<void>;
  updateStyleMoodBoard(id: string, moodBoard: MoodBoardAssets, uiConcepts: UiConceptAssets): Promise<Style | undefined>;
  updateStyleShareCode(id: string, shareCode: string): Promise<Style | undefined>;
  
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

  // Background processing helpers
  getStylesWithUuidNames(): Promise<Style[]>;
  getStylesNeedingAssets(): Promise<Style[]>;
  updateStyleName(id: string, name: string): Promise<Style | undefined>;
  hasActiveJobForStyle(styleId: string, jobTypes: JobType[]): Promise<boolean>;

  // Style spec operations
  updateStyleSpec(id: string, spec: StyleSpec): Promise<Style | undefined>;
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

  async getStyleSummariesPaginated(limit: number, cursor?: string): Promise<PaginatedStyleSummaries> {
    const queryLimit = Math.min(limit, 50);
    
    const selectFields = {
      id: styles.id,
      name: styles.name,
      description: styles.description,
      createdAt: styles.createdAt,
      referenceImages: styles.referenceImages,
    };
    
    let results;
    if (cursor) {
      const cursorDate = new Date(cursor);
      results = await db
        .select(selectFields)
        .from(styles)
        .where(sql`${styles.createdAt} < ${cursorDate}`)
        .orderBy(desc(styles.createdAt))
        .limit(queryLimit + 1);
    } else {
      results = await db
        .select(selectFields)
        .from(styles)
        .orderBy(desc(styles.createdAt))
        .limit(queryLimit + 1);
    }
    
    const hasMore = results.length > queryLimit;
    const items = hasMore ? results.slice(0, queryLimit) : results;
    
    const total = await this.getStyleCount();
    const nextCursor = hasMore && items.length > 0 
      ? items[items.length - 1].createdAt.toISOString() 
      : null;
    
    return {
      items: items.map(s => {
        const refImages = s.referenceImages as string[] | null;
        const thumbnail = refImages && refImages.length > 0 ? refImages[0] : null;
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          createdAt: s.createdAt,
          metadataTags: null,
          moodBoardStatus: "complete",
          uiConceptsStatus: "complete",
          thumbnailPreview: thumbnail,
        };
      }),
      total,
      hasMore,
      nextCursor,
    };
  }

  async getStyleCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(styles);
    return result[0]?.count ?? 0;
  }

  async getStyleById(id: string): Promise<Style | undefined> {
    const [style] = await db.select().from(styles).where(eq(styles.id, id));
    return style;
  }

  async getStyleCoreSummary(id: string): Promise<{
    id: string;
    name: string;
    description: string;
    createdAt: Date;
    tokens: any;
    referenceImages: string[];
    metadataTags: any;
    promptScaffolding: any;
    shareCode: string | null;
    moodBoardStatus: string;
    uiConceptsStatus: string;
    styleSpec: any;
    updatedAt: Date | null;
  } | undefined> {
    const [result] = await db
      .select({
        id: styles.id,
        name: styles.name,
        description: styles.description,
        createdAt: styles.createdAt,
        tokens: styles.tokens,
        referenceImages: styles.referenceImages,
        metadataTags: styles.metadataTags,
        promptScaffolding: styles.promptScaffolding,
        shareCode: styles.shareCode,
        moodBoard: styles.moodBoard,
        uiConcepts: styles.uiConcepts,
        styleSpec: styles.styleSpec,
        updatedAt: styles.updatedAt,
      })
      .from(styles)
      .where(eq(styles.id, id));
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      createdAt: result.createdAt,
      tokens: result.tokens,
      referenceImages: result.referenceImages as string[],
      metadataTags: result.metadataTags,
      promptScaffolding: result.promptScaffolding,
      shareCode: result.shareCode,
      moodBoardStatus: (result.moodBoard as any)?.status || "pending",
      uiConceptsStatus: (result.uiConcepts as any)?.status || "pending",
      styleSpec: result.styleSpec,
      updatedAt: result.updatedAt,
    };
  }

  async getStyleAssets(id: string): Promise<{
    previews: any;
    moodBoard: any;
    uiConcepts: any;
  } | undefined> {
    const [result] = await db
      .select({
        previews: styles.previews,
        moodBoard: styles.moodBoard,
        uiConcepts: styles.uiConcepts,
      })
      .from(styles)
      .where(eq(styles.id, id));
    
    return result;
  }

  async getStyleByShareCode(shareCode: string): Promise<Style | undefined> {
    const [style] = await db.select().from(styles).where(eq(styles.shareCode, shareCode));
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

  async updateStyleShareCode(id: string, shareCode: string): Promise<Style | undefined> {
    const [updated] = await db
      .update(styles)
      .set({ shareCode })
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

  async getImageIdsByStyleId(styleId: string): Promise<Record<string, string>> {
    const assets = await db
      .select({ id: imageAssets.id, type: imageAssets.type })
      .from(imageAssets)
      .where(eq(imageAssets.styleId, styleId));
    
    const result: Record<string, string> = {};
    for (const asset of assets) {
      result[asset.type] = asset.id;
    }
    return result;
  }

  async getImageIdsByStyleIds(styleIds: string[]): Promise<Map<string, Record<string, string>>> {
    if (styleIds.length === 0) return new Map();
    
    const assets = await db
      .select({ id: imageAssets.id, type: imageAssets.type, styleId: imageAssets.styleId })
      .from(imageAssets)
      .where(inArray(imageAssets.styleId, styleIds));
    
    const result = new Map<string, Record<string, string>>();
    for (const asset of assets) {
      if (!asset.styleId) continue;
      if (!result.has(asset.styleId)) {
        result.set(asset.styleId, {});
      }
      result.get(asset.styleId)![asset.type] = asset.id;
    }
    return result;
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

  // Background processing helpers
  async getStylesWithUuidNames(): Promise<Style[]> {
    // Find styles where name matches UUID pattern (8-4-4-4-12 hex format)
    // or starts with common UUID prefixes like the style ID
    const allStyles = await db.select().from(styles);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    return allStyles.filter(style => {
      // Check if name matches UUID pattern
      if (uuidPattern.test(style.name)) return true;
      // Check if name equals the ID (common fallback case)
      if (style.name === style.id) return true;
      // Check if name starts with "Style from " followed by hex (truncated ID)
      if (/^Style from [0-9a-f]{8}$/i.test(style.name)) return true;
      return false;
    });
  }

  async getStylesNeedingAssets(): Promise<Style[]> {
    const allStyles = await db.select().from(styles);
    
    return allStyles.filter(style => {
      const moodBoard = style.moodBoard as MoodBoardAssets | null;
      const uiConcepts = style.uiConcepts as UiConceptAssets | null;
      
      // Needs mood board if no moodBoard, or status is not complete, or no collage
      const needsMoodBoard = !moodBoard || 
        moodBoard.status !== "complete" || 
        !moodBoard.collage;
      
      // Count UI concepts
      let uiConceptCount = 0;
      if (uiConcepts?.audioPlugin) uiConceptCount++;
      if (uiConcepts?.dashboard) uiConceptCount++;
      if (uiConcepts?.componentLibrary) uiConceptCount++;
      
      // Needs UI concepts if status is not complete or has fewer than 2 concepts
      const needsUiConcepts = !uiConcepts || 
        uiConcepts.status !== "complete" || 
        uiConceptCount < 2;
      
      return needsMoodBoard || needsUiConcepts;
    });
  }

  async updateStyleName(id: string, name: string): Promise<Style | undefined> {
    const [updated] = await db
      .update(styles)
      .set({ name })
      .where(eq(styles.id, id))
      .returning();
    return updated;
  }

  async hasActiveJobForStyle(styleId: string, jobTypes: JobType[]): Promise<boolean> {
    const activeJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.styleId, styleId),
          inArray(jobs.type, jobTypes),
          inArray(jobs.status, ["queued", "running"])
        )
      );
    return activeJobs.length > 0;
  }

  async updateStyleSpec(id: string, spec: StyleSpec): Promise<Style | undefined> {
    const [updated] = await db
      .update(styles)
      .set({ 
        styleSpec: spec,
        updatedAt: new Date(),
      })
      .where(eq(styles.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
