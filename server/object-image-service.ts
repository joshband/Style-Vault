import sharp from "sharp";
import crypto from "crypto";
import { db } from "./db";
import { objectAssets, type ImageAssetType, type InsertObjectAsset } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage";

const THUMB_WIDTH = 300;
const MEDIUM_WIDTH = 800;

const objectStorageService = new ObjectStorageService();

interface ImageDimensions {
  width: number;
  height: number;
}

async function base64ToBuffer(base64: string): Promise<Buffer> {
  const matches = base64.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (matches) {
    return Buffer.from(matches[1], "base64");
  }
  return Buffer.from(base64, "base64");
}

async function getDimensions(buffer: Buffer): Promise<ImageDimensions> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

async function generateResizedBuffer(buffer: Buffer, maxWidth: number, quality: number): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;
  
  return sharp(buffer)
    .resize(Math.min(maxWidth, originalWidth), null, { withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

function getObjectPath(prefix: string, id: string, variant: "original" | "thumb" | "medium"): string {
  const privateDir = objectStorageService.getPrivateObjectDir();
  return `${privateDir}/images/${prefix}/${id}-${variant}.webp`;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return { bucketName, objectName };
}

async function uploadBuffer(objectPath: string, buffer: Buffer, mimeType: string = "image/webp"): Promise<void> {
  const { bucketName, objectName } = parseObjectPath(objectPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  
  await file.save(buffer, {
    contentType: mimeType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });
}

async function downloadBuffer(objectPath: string): Promise<Buffer> {
  const { bucketName, objectName } = parseObjectPath(objectPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  
  const [buffer] = await file.download();
  return buffer;
}

async function deleteObject(objectPath: string): Promise<void> {
  try {
    const { bucketName, objectName } = parseObjectPath(objectPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.delete();
  } catch (error) {
    console.error(`Failed to delete object ${objectPath}:`, error);
  }
}

export async function storeImageToObjectStorage(
  base64Data: string,
  type: ImageAssetType,
  styleId?: string
): Promise<string> {
  const buffer = await base64ToBuffer(base64Data);
  const dimensions = await getDimensions(buffer);
  
  const id = crypto.randomUUID();
  const prefix = styleId || "orphan";
  
  const originalPath = getObjectPath(prefix, id, "original");
  const thumbPath = getObjectPath(prefix, id, "thumb");
  const mediumPath = getObjectPath(prefix, id, "medium");
  
  const originalWebp = await sharp(buffer).webp({ quality: 90 }).toBuffer();
  const thumbBuffer = await generateResizedBuffer(buffer, THUMB_WIDTH, 75);
  const mediumBuffer = await generateResizedBuffer(buffer, MEDIUM_WIDTH, 80);
  
  await Promise.all([
    uploadBuffer(originalPath, originalWebp),
    uploadBuffer(thumbPath, thumbBuffer),
    uploadBuffer(mediumPath, mediumBuffer),
  ]);
  
  const [asset] = await db.insert(objectAssets).values({
    styleId: styleId || null,
    type,
    objectKey: originalPath,
    thumbKey: thumbPath,
    mediumKey: mediumPath,
    originalWidth: dimensions.width,
    originalHeight: dimensions.height,
    mimeType: "image/webp",
    size: originalWebp.length,
  }).returning();
  
  return asset.id;
}

export async function getImageFromObjectStorage(
  id: string,
  size: "thumb" | "medium" | "full" = "medium"
): Promise<{ data: string; width?: number; height?: number } | null> {
  const [asset] = await db
    .select()
    .from(objectAssets)
    .where(eq(objectAssets.id, id));

  if (!asset) return null;

  let objectKey: string;
  switch (size) {
    case "thumb":
      objectKey = asset.thumbKey || asset.mediumKey || asset.objectKey;
      break;
    case "medium":
      objectKey = asset.mediumKey || asset.objectKey;
      break;
    case "full":
    default:
      objectKey = asset.objectKey;
  }

  try {
    const buffer = await downloadBuffer(objectKey);
    const base64 = `data:${asset.mimeType || "image/webp"};base64,${buffer.toString("base64")}`;
    
    return {
      data: base64,
      width: asset.originalWidth || undefined,
      height: asset.originalHeight || undefined,
    };
  } catch (error) {
    console.error(`Failed to download image ${id}:`, error);
    return null;
  }
}

export async function getImageUrlFromObjectStorage(
  id: string,
  size: "thumb" | "medium" | "full" = "medium"
): Promise<string | null> {
  const [asset] = await db
    .select()
    .from(objectAssets)
    .where(eq(objectAssets.id, id));

  if (!asset) return null;

  let objectKey: string;
  switch (size) {
    case "thumb":
      objectKey = asset.thumbKey || asset.mediumKey || asset.objectKey;
      break;
    case "medium":
      objectKey = asset.mediumKey || asset.objectKey;
      break;
    case "full":
    default:
      objectKey = asset.objectKey;
  }

  return `/objects/${objectKey.split("/").slice(2).join("/")}`;
}

export async function getObjectAssetsByStyle(
  styleId: string
): Promise<Record<ImageAssetType, string>> {
  const assets = await db
    .select({ id: objectAssets.id, type: objectAssets.type })
    .from(objectAssets)
    .where(eq(objectAssets.styleId, styleId));

  const result: Record<string, string> = {};
  for (const asset of assets) {
    result[asset.type] = asset.id;
  }
  return result as Record<ImageAssetType, string>;
}

export async function deleteObjectAssetsByStyle(styleId: string): Promise<void> {
  const assets = await db
    .select()
    .from(objectAssets)
    .where(eq(objectAssets.styleId, styleId));

  const deletePromises: Promise<void>[] = [];
  for (const asset of assets) {
    if (asset.objectKey) deletePromises.push(deleteObject(asset.objectKey));
    if (asset.thumbKey) deletePromises.push(deleteObject(asset.thumbKey));
    if (asset.mediumKey) deletePromises.push(deleteObject(asset.mediumKey));
  }
  
  await Promise.all(deletePromises);
  await db.delete(objectAssets).where(eq(objectAssets.styleId, styleId));
}

export function computeImageHash(base64Data: string): string {
  const data = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
}
