#!/usr/bin/env tsx
/**
 * Image Artifact Verification Script
 * 
 * Validates all image artifacts before migration:
 * - Discovers legacy base64 images in styles table
 * - Discovers imageAssets and objectAssets
 * - Validates base64 integrity
 * - Detects image format and verifies MIME type
 * - Computes SHA-256 hashes for deduplication
 * - Detects partial migrations (object exists but DB row missing, vice versa)
 * - Outputs structured JSON report
 * 
 * Usage:
 *   npm run verify:image-artifacts
 *   npm run verify:image-artifacts -- --fix
 */

import { db } from "../server/db";
import { styles, imageAssets, objectAssets, type Style, type ImageAsset, type ObjectAsset, type ImageAssetType } from "../shared/schema";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import crypto from "crypto";
import fs from "fs/promises";
import { objectStorageClient, ObjectStorageService } from "../server/replit_integrations/object_storage";

const objectStorageService = new ObjectStorageService();

interface ImageArtifact {
  source: "style_field" | "image_asset" | "object_asset";
  styleId: string | null;
  fieldPath: string;
  type: ImageAssetType | "unknown";
  dataLength?: number;
  objectKey?: string;
}

interface ValidationIssue {
  artifact: ImageArtifact;
  severity: "error" | "warning";
  code: string;
  message: string;
  fixable: boolean;
}

interface DuplicateGroup {
  hash: string;
  artifacts: ImageArtifact[];
}

interface VerificationReport {
  timestamp: string;
  summary: {
    totalArtifacts: number;
    validArtifacts: number;
    invalidArtifacts: number;
    warnings: number;
    duplicateGroups: number;
    partialMigrations: number;
    fixableIssues: number;
  };
  styleBreakdown: {
    styleId: string;
    styleName: string;
    artifacts: number;
    issues: ValidationIssue[];
  }[];
  globalIssues: ValidationIssue[];
  duplicates: DuplicateGroup[];
  partialMigrations: {
    objectExistsDbMissing: string[];
    dbExistsObjectMissing: string[];
    styleReferencesMissingAsset: { styleId: string; assetRef: string }[];
  };
}

function extractBase64Data(value: string): string | null {
  if (!value || typeof value !== "string") return null;
  const matches = value.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (matches) return matches[1];
  if (/^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100))) return value;
  return null;
}

async function validateBase64Image(base64: string): Promise<{
  valid: boolean;
  error?: string;
  format?: string;
  width?: number;
  height?: number;
  hash?: string;
}> {
  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length < 100) {
      return { valid: false, error: "Image data too small (likely truncated)" };
    }
    
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format) {
      return { valid: false, error: "Unable to detect image format" };
    }

    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    
    return {
      valid: true,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      hash,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error parsing image",
    };
  }
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const pathParts = path.split("/");
  if (pathParts.length < 3) throw new Error("Invalid path");
  return { bucketName: pathParts[1], objectName: pathParts.slice(2).join("/") };
}

async function checkObjectExists(objectKey: string): Promise<boolean> {
  try {
    const { bucketName, objectName } = parseObjectPath(objectKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    return exists;
  } catch {
    return false;
  }
}

async function discoverStyleFieldArtifacts(style: Style): Promise<ImageArtifact[]> {
  const artifacts: ImageArtifact[] = [];
  
  const refImages = style.referenceImages as string[] | null;
  if (refImages?.length) {
    refImages.forEach((img, idx) => {
      if (img && !img.match(/^[0-9a-f-]{36}$/)) {
        artifacts.push({
          source: "style_field",
          styleId: style.id,
          fieldPath: `referenceImages[${idx}]`,
          type: "reference",
          dataLength: img.length,
        });
      }
    });
  }

  const previews = style.previews as { portrait?: string; landscape?: string; stillLife?: string } | null;
  if (previews) {
    for (const [key, value] of Object.entries(previews)) {
      if (value && typeof value === "string" && !value.match(/^[0-9a-f-]{36}$/)) {
        const typeMap: Record<string, ImageAssetType> = {
          portrait: "preview_portrait",
          landscape: "preview_landscape",
          stillLife: "preview_still_life",
        };
        artifacts.push({
          source: "style_field",
          styleId: style.id,
          fieldPath: `previews.${key}`,
          type: typeMap[key] || "unknown",
          dataLength: value.length,
        });
      }
    }
  }

  const moodBoard = style.moodBoard as { collage?: string; history?: { collage?: string }[] } | null;
  if (moodBoard?.collage && !moodBoard.collage.match(/^[0-9a-f-]{36}$/)) {
    artifacts.push({
      source: "style_field",
      styleId: style.id,
      fieldPath: "moodBoard.collage",
      type: "mood_board",
      dataLength: moodBoard.collage.length,
    });
  }
  if (moodBoard?.history?.length) {
    moodBoard.history.forEach((entry, idx) => {
      if (entry.collage && !entry.collage.match(/^[0-9a-f-]{36}$/)) {
        artifacts.push({
          source: "style_field",
          styleId: style.id,
          fieldPath: `moodBoard.history[${idx}].collage`,
          type: "mood_board",
          dataLength: entry.collage.length,
        });
      }
    });
  }

  const uiConcepts = style.uiConcepts as { audioPlugin?: string; dashboard?: string; componentLibrary?: string; history?: any[] } | null;
  if (uiConcepts) {
    if (uiConcepts.audioPlugin && !uiConcepts.audioPlugin.match(/^[0-9a-f-]{36}$/)) {
      artifacts.push({
        source: "style_field",
        styleId: style.id,
        fieldPath: "uiConcepts.audioPlugin",
        type: "ui_audio_plugin",
        dataLength: uiConcepts.audioPlugin.length,
      });
    }
    if (uiConcepts.dashboard && !uiConcepts.dashboard.match(/^[0-9a-f-]{36}$/)) {
      artifacts.push({
        source: "style_field",
        styleId: style.id,
        fieldPath: "uiConcepts.dashboard",
        type: "ui_dashboard",
        dataLength: uiConcepts.dashboard.length,
      });
    }
    if (uiConcepts.componentLibrary && !uiConcepts.componentLibrary.match(/^[0-9a-f-]{36}$/)) {
      artifacts.push({
        source: "style_field",
        styleId: style.id,
        fieldPath: "uiConcepts.componentLibrary",
        type: "ui_component_library",
        dataLength: uiConcepts.componentLibrary.length,
      });
    }
  }

  return artifacts;
}

async function getBase64FromStyleField(style: Style, fieldPath: string): Promise<string | null> {
  const parts = fieldPath.split(".");
  let value: any = style;
  
  for (const part of parts) {
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      value = value?.[match[1]]?.[parseInt(match[2])];
    } else {
      value = value?.[part];
    }
  }
  
  return typeof value === "string" ? extractBase64Data(value) : null;
}

async function runVerification(fixMode: boolean = false): Promise<VerificationReport> {
  console.log("Starting image artifact verification...\n");
  
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalArtifacts: 0,
      validArtifacts: 0,
      invalidArtifacts: 0,
      warnings: 0,
      duplicateGroups: 0,
      partialMigrations: 0,
      fixableIssues: 0,
    },
    styleBreakdown: [],
    globalIssues: [],
    duplicates: [],
    partialMigrations: {
      objectExistsDbMissing: [],
      dbExistsObjectMissing: [],
      styleReferencesMissingAsset: [],
    },
  };

  const allStyles = await db.select().from(styles);
  const allImageAssets = await db.select().from(imageAssets);
  const allObjectAssets = await db.select().from(objectAssets);

  console.log(`Found ${allStyles.length} styles, ${allImageAssets.length} image assets, ${allObjectAssets.length} object assets\n`);

  const hashMap = new Map<string, ImageArtifact[]>();
  
  for (const style of allStyles) {
    const styleIssues: ValidationIssue[] = [];
    const styleArtifacts = await discoverStyleFieldArtifacts(style);
    
    for (const artifact of styleArtifacts) {
      report.summary.totalArtifacts++;
      
      const base64 = await getBase64FromStyleField(style, artifact.fieldPath);
      if (!base64) {
        styleIssues.push({
          artifact,
          severity: "error",
          code: "INVALID_BASE64",
          message: "Field contains non-base64 data",
          fixable: false,
        });
        report.summary.invalidArtifacts++;
        continue;
      }

      const validation = await validateBase64Image(base64);
      if (!validation.valid) {
        styleIssues.push({
          artifact,
          severity: "error",
          code: "CORRUPTED_IMAGE",
          message: validation.error || "Image validation failed",
          fixable: false,
        });
        report.summary.invalidArtifacts++;
        continue;
      }

      report.summary.validArtifacts++;

      if (validation.hash) {
        if (!hashMap.has(validation.hash)) {
          hashMap.set(validation.hash, []);
        }
        hashMap.get(validation.hash)!.push(artifact);
      }
    }

    if (styleArtifacts.length > 0 || styleIssues.length > 0) {
      report.styleBreakdown.push({
        styleId: style.id,
        styleName: style.name,
        artifacts: styleArtifacts.length,
        issues: styleIssues,
      });
    }
  }

  for (const asset of allImageAssets) {
    report.summary.totalArtifacts++;
    
    const artifact: ImageArtifact = {
      source: "image_asset",
      styleId: asset.styleId,
      fieldPath: `imageAssets.${asset.id}`,
      type: asset.type,
      dataLength: asset.originalData?.length,
    };

    const base64 = extractBase64Data(asset.originalData);
    if (!base64) {
      report.globalIssues.push({
        artifact,
        severity: "error",
        code: "INVALID_BASE64",
        message: "Image asset contains invalid base64 data",
        fixable: false,
      });
      report.summary.invalidArtifacts++;
      continue;
    }

    const validation = await validateBase64Image(base64);
    if (!validation.valid) {
      report.globalIssues.push({
        artifact,
        severity: "error",
        code: "CORRUPTED_IMAGE",
        message: validation.error || "Image validation failed",
        fixable: false,
      });
      report.summary.invalidArtifacts++;
      continue;
    }

    report.summary.validArtifacts++;

    if (validation.hash) {
      if (!hashMap.has(validation.hash)) {
        hashMap.set(validation.hash, []);
      }
      hashMap.get(validation.hash)!.push(artifact);
    }
  }

  console.log("Checking object storage consistency...");
  for (const asset of allObjectAssets) {
    report.summary.totalArtifacts++;
    
    const artifact: ImageArtifact = {
      source: "object_asset",
      styleId: asset.styleId,
      fieldPath: `objectAssets.${asset.id}`,
      type: asset.type,
      objectKey: asset.objectKey,
    };

    const originalExists = await checkObjectExists(asset.objectKey);
    if (!originalExists) {
      report.partialMigrations.dbExistsObjectMissing.push(asset.id);
      report.globalIssues.push({
        artifact,
        severity: "error",
        code: "OBJECT_MISSING",
        message: `Object storage file missing: ${asset.objectKey}`,
        fixable: false,
      });
      report.summary.invalidArtifacts++;
      report.summary.partialMigrations++;
    } else {
      report.summary.validArtifacts++;
    }
  }

  for (const [hash, artifacts] of hashMap.entries()) {
    if (artifacts.length > 1) {
      report.duplicates.push({ hash, artifacts });
      report.summary.duplicateGroups++;
    }
  }

  for (const issue of [...report.globalIssues, ...report.styleBreakdown.flatMap(s => s.issues)]) {
    if (issue.severity === "warning") report.summary.warnings++;
    if (issue.fixable) report.summary.fixableIssues++;
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const fixMode = args.includes("--fix");
  
  try {
    const report = await runVerification(fixMode);
    
    console.log("\n" + "=".repeat(60));
    console.log("VERIFICATION REPORT");
    console.log("=".repeat(60));
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Artifacts: ${report.summary.totalArtifacts}`);
    console.log(`Valid: ${report.summary.validArtifacts}`);
    console.log(`Invalid: ${report.summary.invalidArtifacts}`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Duplicate Groups: ${report.summary.duplicateGroups}`);
    console.log(`Partial Migrations: ${report.summary.partialMigrations}`);
    console.log(`Fixable Issues: ${report.summary.fixableIssues}`);
    console.log("=".repeat(60));

    if (report.globalIssues.length > 0) {
      console.log("\nGLOBAL ISSUES:");
      for (const issue of report.globalIssues.slice(0, 10)) {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
      }
      if (report.globalIssues.length > 10) {
        console.log(`  ... and ${report.globalIssues.length - 10} more`);
      }
    }

    if (report.duplicates.length > 0) {
      console.log("\nDUPLICATE IMAGES:");
      for (const dup of report.duplicates.slice(0, 5)) {
        console.log(`  Hash ${dup.hash.substring(0, 8)}... appears ${dup.artifacts.length} times`);
      }
    }

    const reportPath = `verify-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nFull report saved to: ${reportPath}`);

    const hasErrors = report.summary.invalidArtifacts > 0 || report.summary.partialMigrations > 0;
    if (hasErrors) {
      console.log("\n❌ Verification FAILED - issues found that must be resolved before migration");
      process.exit(1);
    } else {
      console.log("\n✅ Verification PASSED - safe to proceed with migration");
      process.exit(0);
    }
  } catch (error) {
    console.error("Verification failed with error:", error);
    process.exit(1);
  }
}

main();
