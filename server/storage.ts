import { type User, type InsertUser, type Style, type InsertStyle, users, styles } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Style operations
  getStyles(): Promise<Style[]>;
  getStyleById(id: string): Promise<Style | undefined>;
  createStyle(style: InsertStyle): Promise<Style>;
  deleteStyle(id: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();
