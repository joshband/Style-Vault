import { type User, type InsertUser, type Style, type InsertStyle, type GeneratedImage, type InsertGeneratedImage, type MoodBoardAssets, type UiConceptAssets, users, styles, generatedImages } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface StyleSummary {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  metadataTags: any;
  moodBoardStatus: string;
  uiConceptsStatus: string;
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
}

export const storage = new DatabaseStorage();
