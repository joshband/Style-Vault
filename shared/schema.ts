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
});

export const insertStyleSchema = createInsertSchema(styles).omit({
  id: true,
  createdAt: true,
});

export type InsertStyle = z.infer<typeof insertStyleSchema>;
export type Style = typeof styles.$inferSelect;
