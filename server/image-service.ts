import sharp from "sharp";
import { db } from "./db";
import { imageAssets, type ImageAssetType, type InsertImageAsset } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const THUMB_WIDTH = 300;
const MEDIUM_WIDTH = 800;

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

export async function getImagesByStyle(
  styleId: string
): Promise<Record<ImageAssetType, string>> {
  const assets = await db
    .select({ id: imageAssets.id, type: imageAssets.type })
    .from(imageAssets)
    .where(eq(imageAssets.styleId, styleId));

  const result: Record<string, string> = {};
  for (const asset of assets) {
    result[asset.type] = asset.id;
  }
  return result as Record<ImageAssetType, string>;
}

export async function migrateStyleImages(styleId: string, styleData: {
  referenceImages?: string[];
  previews?: { portrait?: string; landscape?: string; stillLife?: string };
  moodBoard?: { collage?: string };
  uiConcepts?: { softwareApp?: string; audioPlugin?: string; dashboard?: string; componentLibrary?: string };
}): Promise<Record<string, string>> {
  const imageIds: Record<string, string> = {};

  try {
    if (styleData.referenceImages && styleData.referenceImages[0]) {
      const id = await storeImage(styleData.referenceImages[0], "reference", styleId);
      imageIds.reference = id;
    }

    if (styleData.previews?.portrait) {
      const id = await storeImage(styleData.previews.portrait, "preview_portrait", styleId);
      imageIds.preview_portrait = id;
    }
    if (styleData.previews?.landscape) {
      const id = await storeImage(styleData.previews.landscape, "preview_landscape", styleId);
      imageIds.preview_landscape = id;
    }
    if (styleData.previews?.stillLife) {
      const id = await storeImage(styleData.previews.stillLife, "preview_still_life", styleId);
      imageIds.preview_still_life = id;
    }

    if (styleData.moodBoard?.collage) {
      const id = await storeImage(styleData.moodBoard.collage, "mood_board", styleId);
      imageIds.mood_board = id;
    }

    if (styleData.uiConcepts?.softwareApp) {
      const id = await storeImage(styleData.uiConcepts.softwareApp, "ui_software_app", styleId);
      imageIds.ui_software_app = id;
    }
    if (styleData.uiConcepts?.audioPlugin) {
      const id = await storeImage(styleData.uiConcepts.audioPlugin, "ui_audio_plugin", styleId);
      imageIds.ui_audio_plugin = id;
    }
    if (styleData.uiConcepts?.dashboard) {
      const id = await storeImage(styleData.uiConcepts.dashboard, "ui_dashboard", styleId);
      imageIds.ui_dashboard = id;
    }
    if (styleData.uiConcepts?.componentLibrary) {
      const id = await storeImage(styleData.uiConcepts.componentLibrary, "ui_component_library", styleId);
      imageIds.ui_component_library = id;
    }
  } catch (error) {
    console.error(`Error migrating images for style ${styleId}:`, error);
    throw error;
  }

  return imageIds;
}

export async function deleteStyleImages(styleId: string): Promise<void> {
  await db.delete(imageAssets).where(eq(imageAssets.styleId, styleId));
}
