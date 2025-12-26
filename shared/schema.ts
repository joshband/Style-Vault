import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Job status types for async operations
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type JobType = 
  | "style_analysis" 
  | "preview_generation" 
  | "image_generation" 
  | "cv_extraction" 
  | "metadata_enrichment"
  | "mood_board_generation"
  | "ui_concepts_generation"
  | "batch_style_creation"
  | "style_name_repair"
  | "background_asset_generation";

// Jobs table for tracking async operations with progress
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").$type<JobType>().notNull(),
  status: text("status").$type<JobStatus>().default("queued").notNull(),
  progress: integer("progress").default(0).notNull(),
  progressMessage: text("progress_message"),
  input: jsonb("input").$type<Record<string, any>>().notNull(),
  output: jsonb("output").$type<Record<string, any>>(),
  error: text("error"),
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  styleId: varchar("style_id"),
  batchId: varchar("batch_id"),
});

// Batches table for tracking batch operations
export const batches = pgTable("batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").$type<JobStatus>().default("queued").notNull(),
  totalItems: integer("total_items").default(0).notNull(),
  completedItems: integer("completed_items").default(0).notNull(),
  failedItems: integer("failed_items").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
  createdAt: true,
});

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batches.$inferSelect;

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Auth tables are now exported from models/auth.ts
export * from "./models/auth";

// Metadata tags for visual descriptors and AI-generated keywords
export interface MetadataTags {
  // Core visual characteristics
  mood: string[];
  colorFamily: string[];
  lighting: string[];
  texture: string[];
  
  // Art historical context
  era: string[];
  artPeriod: string[];
  historicalInfluences: string[];
  similarArtists: string[];
  
  // Technical aspects
  medium: string[];
  subjects: string[];
  
  // Application guidance
  usageExamples: string[];
  
  // Subjective Visual DNA - Emotional Resonance
  narrativeTone: string[];
  sensoryPalette: string[];
  movementRhythm: string[];
  
  // Subjective Visual DNA - Design Voice
  stylisticPrinciples: string[];
  signatureMotifs: string[];
  contrastDynamics: string[];
  
  // Subjective Visual DNA - Experiential Impact
  psychologicalEffect: string[];
  culturalResonance: string[];
  audiencePerception: string[];
  
  // Search keywords
  keywords: string[];
  
  // Metadata versioning
  version?: number;
  lastAnalyzedAt?: string;
}

export type MetadataEnrichmentStatus = "pending" | "queued" | "processing" | "complete" | "failed";

// Single mood board generation entry
export interface MoodBoardEntry {
  collage: string;
  generatedAt: string;
}

// Single UI concepts generation entry
export interface UiConceptEntry {
  audioPlugin?: string;
  dashboard?: string;
  componentLibrary?: string;
  generatedAt: string;
}

// Mood board with history (current generation status + history of completed generations)
export interface MoodBoardAssets {
  status: "pending" | "generating" | "complete" | "failed";
  collage?: string;
  history: MoodBoardEntry[];
}

// UI concepts with history
export interface UiConceptAssets {
  status: "pending" | "generating" | "complete" | "failed";
  audioPlugin?: string;
  dashboard?: string;
  componentLibrary?: string;
  history: UiConceptEntry[];
}

// Style spec for usage guidelines and notes
export interface StyleSpec {
  usageGuidelines: string;
  designNotes: string;
  updatedAt: string;
}

// Styles table for persisting visual styles
export const styles = pgTable("styles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  creatorId: varchar("creator_id"),
  isPublic: boolean("is_public").default(true).notNull(),
  shareCode: varchar("share_code").unique(),
  styleSpec: jsonb("style_spec").$type<StyleSpec>(),
  referenceImages: jsonb("reference_images").$type<string[]>().default([]),
  previews: jsonb("previews").$type<{
    portrait: string;
    landscape: string;
    stillLife: string;
  }>().notNull(),
  tokens: jsonb("tokens").$type<Record<string, any>>().notNull(),
  promptScaffolding: jsonb("prompt_scaffolding").$type<{
    base: string;
    modifiers: string[];
    negative: string;
  }>().notNull(),
  metadataTags: jsonb("metadata_tags").$type<MetadataTags>().default({
    mood: [],
    colorFamily: [],
    lighting: [],
    texture: [],
    era: [],
    artPeriod: [],
    historicalInfluences: [],
    similarArtists: [],
    medium: [],
    subjects: [],
    usageExamples: [],
    narrativeTone: [],
    sensoryPalette: [],
    movementRhythm: [],
    stylisticPrinciples: [],
    signatureMotifs: [],
    contrastDynamics: [],
    psychologicalEffect: [],
    culturalResonance: [],
    audiencePerception: [],
    keywords: [],
  }),
  metadataEnrichmentStatus: text("metadata_enrichment_status").$type<MetadataEnrichmentStatus>().default("pending"),
  moodBoard: jsonb("mood_board").$type<MoodBoardAssets>().default({
    status: "pending",
    history: [],
  }),
  uiConcepts: jsonb("ui_concepts").$type<UiConceptAssets>().default({
    status: "pending",
    history: [],
  }),
});

export const insertStyleSchema = createInsertSchema(styles).omit({
  id: true,
  createdAt: true,
});

export type InsertStyle = z.infer<typeof insertStyleSchema>;
export type Style = typeof styles.$inferSelect;

// Image assets table - stores images with size variants for optimized loading
export type ImageAssetType = "reference" | "preview_portrait" | "preview_landscape" | "preview_still_life" | "mood_board" | "ui_audio_plugin" | "ui_dashboard" | "ui_component_library" | "generated";

export const imageAssets = pgTable("image_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  styleId: varchar("style_id"),
  type: text("type").$type<ImageAssetType>().notNull(),
  originalWidth: integer("original_width"),
  originalHeight: integer("original_height"),
  originalData: text("original_data").notNull(),
  thumbData: text("thumb_data"),
  mediumData: text("medium_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertImageAssetSchema = createInsertSchema(imageAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertImageAsset = z.infer<typeof insertImageAssetSchema>;
export type ImageAsset = typeof imageAssets.$inferSelect;

// Generated images table - stores images created using styles (admin only)
export const generatedImages = pgTable("generated_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  styleId: varchar("style_id").notNull(),
  prompt: text("prompt").notNull(),
  imageData: text("image_data").notNull(),
  thumbnailData: text("thumbnail_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGeneratedImageSchema = createInsertSchema(generatedImages).omit({
  id: true,
  createdAt: true,
});

export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type GeneratedImage = typeof generatedImages.$inferSelect;

// Bookmarks table - tracks user bookmarks/favorites
export const bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  styleId: varchar("style_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
});

export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;

// Ratings table - tracks user ratings and reviews
export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  styleId: varchar("style_id").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
});

export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;

// Collections table - user-created folders for organizing styles
export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  coverImageId: varchar("cover_image_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
});

export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

// Collection items - many-to-many relationship between collections and styles
export const collectionItems = pgTable("collection_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull(),
  styleId: varchar("style_id").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertCollectionItemSchema = createInsertSchema(collectionItems).omit({
  id: true,
  addedAt: true,
});

export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;
export type CollectionItem = typeof collectionItems.$inferSelect;

// Style versions table - tracks history of style changes for versioning
export type VersionChangeType = "created" | "tokens_updated" | "previews_updated" | "metadata_updated" | "manual_save" | "reverted";

export const styleVersions = pgTable("style_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  styleId: varchar("style_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  changeType: text("change_type").$type<VersionChangeType>().notNull(),
  changeDescription: text("change_description"),
  createdBy: varchar("created_by"),
  tokens: jsonb("tokens").$type<Record<string, any>>().notNull(),
  promptScaffolding: jsonb("prompt_scaffolding").$type<{
    base: string;
    modifiers: string[];
    negative: string;
  }>(),
  metadataTags: jsonb("metadata_tags").$type<MetadataTags>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStyleVersionSchema = createInsertSchema(styleVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertStyleVersion = z.infer<typeof insertStyleVersionSchema>;
export type StyleVersion = typeof styleVersions.$inferSelect;

// Token cache table - caches CV extraction results keyed by image hash
export const tokenCache = pgTable("token_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageHash: varchar("image_hash").notNull().unique(),
  tokens: jsonb("tokens").$type<Record<string, any>>().notNull(),
  extractionMethod: text("extraction_method").default("cv").notNull(),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const insertTokenCacheSchema = createInsertSchema(tokenCache).omit({
  id: true,
  createdAt: true,
});

export type InsertTokenCache = z.infer<typeof insertTokenCacheSchema>;
export type TokenCache = typeof tokenCache.$inferSelect;

// Object storage assets - stores references to images in App Storage
export const objectAssets = pgTable("object_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  styleId: varchar("style_id"),
  type: text("type").$type<ImageAssetType>().notNull(),
  objectKey: text("object_key").notNull(),
  thumbKey: text("thumb_key"),
  mediumKey: text("medium_key"),
  originalWidth: integer("original_width"),
  originalHeight: integer("original_height"),
  mimeType: text("mime_type").default("image/webp"),
  size: integer("size"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertObjectAssetSchema = createInsertSchema(objectAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertObjectAsset = z.infer<typeof insertObjectAssetSchema>;
export type ObjectAsset = typeof objectAssets.$inferSelect;
