import sharp from "sharp";
import crypto from "crypto";
import { db } from "./db";
import { objectAssets, type ImageAssetType, type InsertObjectAsset } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage";
import { logger } from "./logger";

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
    logger.error(`Failed to delete object ${objectPath}`, error, { module: 'ObjectImageService' });
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
    logger.error(`Failed to download image ${id}`, error, { module: 'ObjectImageService' });
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
  styleId: string | null
): Promise<Record<ImageAssetType, string>> {
  const whereClause = styleId === null 
    ? sql`${objectAssets.styleId} IS NULL`
    : eq(objectAssets.styleId, styleId);
    
  const assets = await db
    .select({ id: objectAssets.id, type: objectAssets.type })
    .from(objectAssets)
    .where(whereClause);

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

export async function getReferenceImageBase64(styleId: string): Promise<string | null> {
  const assets = await getObjectAssetsByStyle(styleId);
  const referenceId = assets["reference"];
  
  if (!referenceId) {
    return null;
  }
  
  const imageData = await getImageFromObjectStorage(referenceId, "full");
  return imageData?.data || null;
}

function isValidBase64Image(data: string | undefined | null): boolean {
  if (!data || typeof data !== 'string') return false;
  return data.startsWith('data:image/') || (data.length > 100 && !data.startsWith('http'));
}

export async function migrateStyleToObjectStorage(styleId: string, styleData: {
  referenceImages?: string[];
  previews?: { portrait?: string; landscape?: string; stillLife?: string };
  moodBoard?: { collage?: string };
  uiConcepts?: { softwareApp?: string; audioPlugin?: string; dashboard?: string };
}): Promise<Record<string, string>> {
  const imageIds: Record<string, string> = {};
  
  const tryStoreImage = async (data: string | undefined, type: ImageAssetType): Promise<string | null> => {
    if (!isValidBase64Image(data)) {
      return null;
    }
    try {
      const id = await storeImageToObjectStorage(data!, type, styleId);
      return id;
    } catch (error) {
      logger.error(`Error storing ${type} for style ${styleId}`, error, { module: 'ObjectImageService' });
      return null;
    }
  };
  
  const refId = await tryStoreImage(styleData.referenceImages?.[0], "reference");
  if (refId) imageIds.reference = refId;
  
  const portraitId = await tryStoreImage(styleData.previews?.portrait, "preview_portrait");
  if (portraitId) imageIds.preview_portrait = portraitId;
  
  const landscapeId = await tryStoreImage(styleData.previews?.landscape, "preview_landscape");
  if (landscapeId) imageIds.preview_landscape = landscapeId;
  
  const stillLifeId = await tryStoreImage(styleData.previews?.stillLife, "preview_still_life");
  if (stillLifeId) imageIds.preview_still_life = stillLifeId;
  
  const moodBoardId = await tryStoreImage(styleData.moodBoard?.collage, "mood_board");
  if (moodBoardId) imageIds.mood_board = moodBoardId;
  
  const softwareAppId = await tryStoreImage(styleData.uiConcepts?.softwareApp, "ui_software_app");
  if (softwareAppId) imageIds.ui_software_app = softwareAppId;
  
  const audioPluginId = await tryStoreImage(styleData.uiConcepts?.audioPlugin, "ui_audio_plugin");
  if (audioPluginId) imageIds.ui_audio_plugin = audioPluginId;
  
  const dashboardId = await tryStoreImage(styleData.uiConcepts?.dashboard, "ui_dashboard");
  if (dashboardId) imageIds.ui_dashboard = dashboardId;
  
  logger.info(`Migrated ${Object.keys(imageIds).length} images for style ${styleId} to Object Storage`, { 
    module: 'ObjectImageService', 
    styleId, 
    types: Object.keys(imageIds) 
  });
  
  return imageIds;
}
