import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
