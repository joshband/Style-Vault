import sharp from "sharp";
import { db } from "./db";
import { imageAssets, type ImageAssetType, type InsertImageAsset } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const THUMB_WIDTH = 300;
const MEDIUM_WIDTH = 800;

interface ImageDimensions {
  width: number;
  height: number;
}

async function base64ToBuffer(base64: string): Promise<Buffer> {
  let data = base64;
  
  // Handle double prefix case (e.g., data:image/png;base64,data:image/jpeg;base64,...)
  // Keep extracting until we get to the actual base64 data
  while (data.includes(";base64,data:")) {
    const parts = data.split(";base64,");
    if (parts.length > 1) {
      data = parts.slice(1).join(";base64,");
    } else {
      break;
    }
  }
  
  // Handle data URI format
  const matches = data.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (matches) {
    return Buffer.from(matches[1], "base64");
  }
  
  // Handle data URI with other mime types
  const genericMatches = data.match(/^data:[^;]+;base64,(.+)$/);
  if (genericMatches) {
    return Buffer.from(genericMatches[1], "base64");
  }
  
  // Raw base64
  return Buffer.from(data, "base64");
}

function isValidBase64Image(data: string): boolean {
  if (!data || data.length < 100) return false;
  
  // Check for common data URI prefixes
  if (data.startsWith("data:image/")) return true;
  
  // Check if it's raw base64 that decodes to something image-like
  try {
    const buffer = Buffer.from(data.substring(0, 100), "base64");
    // PNG signature
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // JPEG signature
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // WebP signature
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
    // GIF signature
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
  } catch {
    return false;
  }
  
  return false;
}

function bufferToBase64(buffer: Buffer, mimeType: string = "image/webp"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function getDimensions(buffer: Buffer): Promise<ImageDimensions> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

async function generateResizedVariants(buffer: Buffer): Promise<{
  thumb: string;
  medium: string;
}> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;

  const thumbBuffer = await sharp(buffer)
    .resize(Math.min(THUMB_WIDTH, originalWidth), null, { withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  const mediumBuffer = await sharp(buffer)
    .resize(Math.min(MEDIUM_WIDTH, originalWidth), null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return {
    thumb: bufferToBase64(thumbBuffer),
    medium: bufferToBase64(mediumBuffer),
  };
}

/**
 * @deprecated Use storeImageToObjectStorage from object-image-service.ts instead.
 * This function stores base64 data directly in the database which causes performance issues.
 * Will be removed after migration to object storage is complete.
 */
export async function storeImage(
  base64Data: string,
  type: ImageAssetType,
  styleId?: string
): Promise<string> {
  const buffer = await base64ToBuffer(base64Data);
  const dimensions = await getDimensions(buffer);
  const variants = await generateResizedVariants(buffer);

  const [asset] = await db.insert(imageAssets).values({
    styleId: styleId || null,
    type,
    originalWidth: dimensions.width,
    originalHeight: dimensions.height,
    originalData: base64Data,
    thumbData: variants.thumb,
    mediumData: variants.medium,
  }).returning();
  return asset.id;
}

/**
 * @deprecated Use getObjectAsset from object-image-service.ts instead.
 * This function retrieves base64 data from the database which is inefficient.
 * Will be removed after migration to object storage is complete.
 */
export async function getImage(
  id: string,
  size: "thumb" | "medium" | "full" = "medium"
): Promise<{ data: string; width?: number; height?: number } | null> {
  const [asset] = await db
    .select()
    .from(imageAssets)
    .where(eq(imageAssets.id, id));

  if (!asset) return null;

  let data: string;
  switch (size) {
    case "thumb":
      data = asset.thumbData || asset.mediumData || asset.originalData;
      break;
    case "medium":
      data = asset.mediumData || asset.originalData;
      break;
    case "full":
    default:
      data = asset.originalData;
  }

  return {
    data,
    width: asset.originalWidth || undefined,
    height: asset.originalHeight || undefined,
  };
}

/**
 * @deprecated Use getObjectAssetsByStyleId from object-image-service.ts instead.
 * This function queries the old imageAssets table.
 * Will be removed after migration to object storage is complete.
 */
export async function getImagesByStyle(
  styleId: string
): Promise<Record<ImageAssetType, string>> {
  // Order by createdAt ASC so newer images overwrite older ones in the result map
  const assets = await db
    .select({ id: imageAssets.id, type: imageAssets.type, createdAt: imageAssets.createdAt })
    .from(imageAssets)
    .where(eq(imageAssets.styleId, styleId))
    .orderBy(imageAssets.createdAt);

  const result: Record<string, string> = {};
  for (const asset of assets) {
    // Later (newer) images overwrite earlier ones for the same type
    result[asset.type] = asset.id;
  }
  return result as Record<ImageAssetType, string>;
}

/**
 * @deprecated Migration utility for moving base64 images to imageAssets table.
 * Use migrateToObjectStorage admin endpoint to migrate to object storage instead.
 * Will be removed after all styles are migrated to object storage.
 */
export async function migrateStyleImages(styleId: string, styleData: {
  referenceImages?: string[];
  previews?: { portrait?: string; landscape?: string; stillLife?: string };
  moodBoard?: { collage?: string };
  uiConcepts?: { softwareApp?: string; audioPlugin?: string; dashboard?: string; componentLibrary?: string };
}): Promise<Record<string, string>> {
  const imageIds: Record<string, string> = {};

  const tryStoreImage = async (data: string | undefined, type: ImageAssetType): Promise<string | null> => {
    if (!data || !isValidBase64Image(data)) {
      logger.debug(`Skipping ${type} - invalid or missing base64 data`, { module: 'ImageService', styleId });
      return null;
    }
    try {
      const id = await storeImage(data, type, styleId);
      return id;
    } catch (error) {
      logger.error(`Error storing ${type} for style ${styleId}`, error, { module: 'ImageService', styleId });
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

  const componentLibraryId = await tryStoreImage(styleData.uiConcepts?.componentLibrary, "ui_component_library");
  if (componentLibraryId) imageIds.ui_component_library = componentLibraryId;

  return imageIds;
}

/**
 * @deprecated Use deleteObjectAssetsByStyle from object-image-service.ts instead.
 * This function deletes from the old imageAssets table.
 * Will be removed after migration to object storage is complete.
 */
export async function deleteStyleImages(styleId: string): Promise<void> {
  await db.delete(imageAssets).where(eq(imageAssets.styleId, styleId));
}
