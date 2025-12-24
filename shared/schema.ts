import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Metadata tags for visual descriptors
export interface MetadataTags {
  mood: string[];
  colorFamily: string[];
  era: string[];
  medium: string[];
  subjects: string[];
  lighting: string[];
  texture: string[];
}

// Mood board collage structure
export interface MoodBoardAssets {
  collage: string;
  status: "pending" | "generating" | "complete" | "failed";
}

// UI concept mockup structure
export interface UiConceptAssets {
  audioPlugin?: string;
  dashboard?: string;
  componentLibrary?: string;
  status: "pending" | "generating" | "complete" | "failed";
}

// Styles table for persisting visual styles
export const styles = pgTable("styles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
    era: [],
    medium: [],
    subjects: [],
    lighting: [],
    texture: [],
  }),
  moodBoard: jsonb("mood_board").$type<MoodBoardAssets>().default({
    collage: "",
    status: "pending",
  }),
  uiConcepts: jsonb("ui_concepts").$type<UiConceptAssets>().default({
    status: "pending",
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
