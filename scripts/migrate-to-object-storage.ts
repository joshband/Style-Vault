#!/usr/bin/env tsx
/**
 * Migration Script: imageAssets -> objectAssets
 * 
 * Migrates images from imageAssets (base64 in Postgres) to objectAssets (App Storage).
 * 
 * Features:
 *   - Preflight deduplication by {styleId, type} - picks newest, logs duplicates
 *   - Verifies existing objectAssets and regenerates if hash mismatches
 *   - Full rollback capability including object storage deletion
 * 
 * Prerequisites:
 *   - Run verify:image-artifacts first and ensure it passes
 *   - Backup your database before running
 * 
 * Usage:
 *   npm run migrate:object-storage              # Dry run (shows what would be migrated)
 *   npm run migrate:object-storage -- --execute # Actually perform migration
 *   npm run migrate:object-storage -- --rollback # Delete objectAssets and corresponding objects
 */

import { db } from "../server/db";
import { imageAssets, objectAssets, type ImageAsset, type ImageAssetType, type ObjectAsset } from "../shared/schema";
import { eq } from "drizzle-orm";
import { storeImageToObjectStorage, computeImageHash } from "../server/object-image-service";
import { objectStorageClient, ObjectStorageService } from "../server/replit_integrations/object_storage";
import fs from "fs/promises";
import crypto from "crypto";

const objectStorageService = new ObjectStorageService();

interface MigrationResult {
  styleId: string | null;
  type: ImageAssetType;
  imageAssetIds: string[];
  objectAssetId?: string;
  status: "success" | "error" | "skipped" | "verified" | "regenerated";
  duplicatesFound: number;
  message?: string;
}

interface MigrationReport {
  timestamp: string;
  mode: "dry_run" | "execute" | "rollback";
  summary: {
    totalUniqueTargets: number;
    totalImageAssets: number;
    migrated: number;
    verified: number;
    regenerated: number;
    skipped: number;
    duplicatesFound: number;
    errors: number;
  };
  results: MigrationResult[];
  duplicateDetails: { styleId: string | null; type: string; imageAssetIds: string[]; keptId: string }[];
}

interface GroupedAsset {
  styleId: string | null;
  type: ImageAssetType;
  assets: ImageAsset[];
  newestAsset: ImageAsset;
}

function groupAssetsByTarget(allAssets: ImageAsset[]): GroupedAsset[] {
  const groups = new Map<string, ImageAsset[]>();
  
  for (const asset of allAssets) {
    const key = `${asset.styleId || "null"}-${asset.type}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(asset);
  }
  
  const result: GroupedAsset[] = [];
  for (const [key, assets] of groups.entries()) {
    assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const newest = assets[0];
    result.push({
      styleId: newest.styleId,
      type: newest.type,
      assets,
      newestAsset: newest,
    });
  }
  
  return result;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const pathParts = path.split("/");
  if (pathParts.length < 3) throw new Error("Invalid path");
  return { bucketName: pathParts[1], objectName: pathParts.slice(2).join("/") };
}

async function downloadObjectBuffer(objectKey: string): Promise<Buffer | null> {
  try {
    const { bucketName, objectName } = parseObjectPath(objectKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [buffer] = await file.download();
    return buffer;
  } catch {
    return null;
  }
}

async function deleteObjectFromStorage(objectKey: string): Promise<void> {
  try {
    const { bucketName, objectName } = parseObjectPath(objectKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.delete();
  } catch (error) {
    console.log(`  [WARN] Could not delete object ${objectKey}: ${error}`);
  }
}

async function verifyObjectAssetIntegrity(
  objectAsset: ObjectAsset, 
  sourceBase64: string
): Promise<{ matches: boolean; error?: string }> {
  try {
    const buffer = await downloadObjectBuffer(objectAsset.objectKey);
    if (!buffer) {
      return { matches: false, error: "Object not found in storage" };
    }
    
    const sourceHash = computeImageHash(sourceBase64);
    const objectHash = crypto.createHash("sha256").update(buffer).digest("hex").substring(0, 32);
    
    return { matches: sourceHash === objectHash };
  } catch (error) {
    return { matches: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function runMigration(execute: boolean): Promise<MigrationReport> {
  console.log(`Starting migration (mode: ${execute ? "execute" : "dry_run"})...\n`);
  
  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    mode: execute ? "execute" : "dry_run",
    summary: {
      totalUniqueTargets: 0,
      totalImageAssets: 0,
      migrated: 0,
      verified: 0,
      regenerated: 0,
      skipped: 0,
      duplicatesFound: 0,
      errors: 0,
    },
    results: [],
    duplicateDetails: [],
  };

  const allImageAssets = await db.select().from(imageAssets);
  report.summary.totalImageAssets = allImageAssets.length;
  
  console.log(`Found ${allImageAssets.length} image assets\n`);

  const groupedAssets = groupAssetsByTarget(allImageAssets);
  report.summary.totalUniqueTargets = groupedAssets.length;
  
  console.log(`Grouped into ${groupedAssets.length} unique {styleId, type} targets\n`);

  for (const group of groupedAssets) {
    if (group.assets.length > 1) {
      report.summary.duplicatesFound += group.assets.length - 1;
      report.duplicateDetails.push({
        styleId: group.styleId,
        type: group.type,
        imageAssetIds: group.assets.map(a => a.id),
        keptId: group.newestAsset.id,
      });
      console.log(`  [DUP] ${group.type} for style ${group.styleId || "orphan"}: ${group.assets.length} duplicates, keeping newest ${group.newestAsset.id}`);
    }
  }

  const existingObjectAssets = await db.select().from(objectAssets);
  const existingByStyleAndType = new Map<string, ObjectAsset>();
  for (const obj of existingObjectAssets) {
    const key = `${obj.styleId || "null"}-${obj.type}`;
    existingByStyleAndType.set(key, obj);
  }

  console.log(`\nProcessing ${groupedAssets.length} migration targets...\n`);

  for (const group of groupedAssets) {
    const lookupKey = `${group.styleId || "null"}-${group.type}`;
    const existingObj = existingByStyleAndType.get(lookupKey);
    
    if (existingObj) {
      if (!execute) {
        report.results.push({
          styleId: group.styleId,
          type: group.type,
          imageAssetIds: group.assets.map(a => a.id),
          objectAssetId: existingObj.id,
          status: "verified",
          duplicatesFound: group.assets.length - 1,
          message: "Would verify existing objectAsset integrity",
        });
        report.summary.verified++;
        console.log(`  [DRY] Would verify ${group.type} for style ${group.styleId || "orphan"}`);
        continue;
      }

      const verification = await verifyObjectAssetIntegrity(existingObj, group.newestAsset.originalData);
      
      if (verification.matches) {
        report.results.push({
          styleId: group.styleId,
          type: group.type,
          imageAssetIds: group.assets.map(a => a.id),
          objectAssetId: existingObj.id,
          status: "verified",
          duplicatesFound: group.assets.length - 1,
          message: "Object matches source hash",
        });
        report.summary.verified++;
        console.log(`  [VERIFIED] ${group.type} for style ${group.styleId || "orphan"} - hash matches`);
      } else {
        console.log(`  [MISMATCH] ${group.type} for style ${group.styleId || "orphan"}: ${verification.error || "hash mismatch"}, regenerating...`);
        
        try {
          if (existingObj.objectKey) await deleteObjectFromStorage(existingObj.objectKey);
          if (existingObj.thumbKey) await deleteObjectFromStorage(existingObj.thumbKey);
          if (existingObj.mediumKey) await deleteObjectFromStorage(existingObj.mediumKey);
          await db.delete(objectAssets).where(eq(objectAssets.id, existingObj.id));
          
          const objectAssetId = await storeImageToObjectStorage(
            group.newestAsset.originalData,
            group.type,
            group.styleId || undefined
          );
          
          report.results.push({
            styleId: group.styleId,
            type: group.type,
            imageAssetIds: group.assets.map(a => a.id),
            objectAssetId: objectAssetId,
            status: "regenerated",
            duplicatesFound: group.assets.length - 1,
            message: `Regenerated due to: ${verification.error || "hash mismatch"}`,
          });
          report.summary.regenerated++;
          console.log(`  [REGENERATED] ${group.type} for style ${group.styleId || "orphan"} -> ${objectAssetId}`);
        } catch (error) {
          report.results.push({
            styleId: group.styleId,
            type: group.type,
            imageAssetIds: group.assets.map(a => a.id),
            status: "error",
            duplicatesFound: group.assets.length - 1,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          report.summary.errors++;
          console.log(`  [ERR] Failed to regenerate ${group.type} for style ${group.styleId || "orphan"}: ${error}`);
        }
      }
      continue;
    }

    if (!execute) {
      report.results.push({
        styleId: group.styleId,
        type: group.type,
        imageAssetIds: group.assets.map(a => a.id),
        status: "success",
        duplicatesFound: group.assets.length - 1,
        message: "Would migrate to object storage",
      });
      report.summary.migrated++;
      console.log(`  [DRY] Would migrate ${group.type} for style ${group.styleId || "orphan"}`);
      continue;
    }

    try {
      const objectAssetId = await storeImageToObjectStorage(
        group.newestAsset.originalData,
        group.type,
        group.styleId || undefined
      );
      
      report.results.push({
        styleId: group.styleId,
        type: group.type,
        imageAssetIds: group.assets.map(a => a.id),
        objectAssetId: objectAssetId,
        status: "success",
        duplicatesFound: group.assets.length - 1,
      });
      report.summary.migrated++;
      console.log(`  [OK] Migrated ${group.type} for style ${group.styleId || "orphan"} -> ${objectAssetId}`);
    } catch (error) {
      report.results.push({
        styleId: group.styleId,
        type: group.type,
        imageAssetIds: group.assets.map(a => a.id),
        status: "error",
        duplicatesFound: group.assets.length - 1,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      report.summary.errors++;
      console.log(`  [ERR] Failed to migrate ${group.type} for style ${group.styleId || "orphan"}: ${error}`);
    }
  }

  return report;
}

async function runRollback(): Promise<MigrationReport> {
  console.log("Starting rollback (deleting all objectAssets and their storage objects)...\n");
  
  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    mode: "rollback",
    summary: {
      totalUniqueTargets: 0,
      totalImageAssets: 0,
      migrated: 0,
      verified: 0,
      regenerated: 0,
      skipped: 0,
      duplicatesFound: 0,
      errors: 0,
    },
    results: [],
    duplicateDetails: [],
  };

  const allObjectAssets = await db.select().from(objectAssets);
  report.summary.totalUniqueTargets = allObjectAssets.length;
  
  console.log(`Found ${allObjectAssets.length} object assets to delete\n`);

  for (const asset of allObjectAssets) {
    try {
      if (asset.objectKey) await deleteObjectFromStorage(asset.objectKey);
      if (asset.thumbKey) await deleteObjectFromStorage(asset.thumbKey);
      if (asset.mediumKey) await deleteObjectFromStorage(asset.mediumKey);
      
      await db.delete(objectAssets).where(eq(objectAssets.id, asset.id));
      
      console.log(`  [OK] Deleted ${asset.type} for style ${asset.styleId || "orphan"}`);
      report.summary.migrated++;
    } catch (error) {
      console.log(`  [ERR] Failed to delete ${asset.type} for style ${asset.styleId || "orphan"}: ${error}`);
      report.summary.errors++;
    }
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const executeMode = args.includes("--execute");
  const rollbackMode = args.includes("--rollback");
  
  if (rollbackMode && executeMode) {
    console.error("Cannot use both --execute and --rollback");
    process.exit(1);
  }
  
  try {
    let report: MigrationReport;
    
    if (rollbackMode) {
      report = await runRollback();
    } else {
      report = await runMigration(executeMode);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("MIGRATION REPORT");
    console.log("=".repeat(60));
    console.log(`Mode: ${report.mode}`);
    console.log(`Total Image Assets: ${report.summary.totalImageAssets}`);
    console.log(`Unique Targets: ${report.summary.totalUniqueTargets}`);
    console.log(`Duplicates Found: ${report.summary.duplicatesFound}`);
    console.log(`Migrated: ${report.summary.migrated}`);
    console.log(`Verified: ${report.summary.verified}`);
    console.log(`Regenerated: ${report.summary.regenerated}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log("=".repeat(60));

    if (report.duplicateDetails.length > 0) {
      console.log("\nDUPLICATE DETAILS:");
      for (const dup of report.duplicateDetails.slice(0, 10)) {
        console.log(`  ${dup.type} (${dup.styleId || "orphan"}): ${dup.imageAssetIds.length} copies, kept ${dup.keptId}`);
      }
      if (report.duplicateDetails.length > 10) {
        console.log(`  ... and ${report.duplicateDetails.length - 10} more`);
      }
    }

    const reportPath = `migration-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nFull report saved to: ${reportPath}`);

    if (report.summary.errors > 0) {
      console.log("\n❌ Migration completed with errors");
      process.exit(1);
    } else if (!executeMode && !rollbackMode) {
      console.log("\n📋 Dry run complete. Use --execute to perform migration.");
      process.exit(0);
    } else {
      console.log("\n✅ Migration completed successfully");
      process.exit(0);
    }
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  }
}

main();
