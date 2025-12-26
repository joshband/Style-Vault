#!/usr/bin/env tsx
/**
 * Migration Script: imageAssets -> objectAssets
 * 
 * Migrates images from imageAssets (base64 in Postgres) to objectAssets (App Storage).
 * 
 * Prerequisites:
 *   - Run verify:image-artifacts first and ensure it passes
 *   - Backup your database before running
 * 
 * Usage:
 *   npm run migrate:object-storage              # Dry run (shows what would be migrated)
 *   npm run migrate:object-storage -- --execute # Actually perform migration
 *   npm run migrate:object-storage -- --rollback # Delete objectAssets and restore to imageAssets only
 */

import { db } from "../server/db";
import { imageAssets, objectAssets, type ImageAsset, type ImageAssetType } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { storeImageToObjectStorage } from "../server/object-image-service";
import fs from "fs/promises";

interface MigrationResult {
  styleId: string | null;
  type: ImageAssetType;
  imageAssetId: string;
  objectAssetId?: string;
  status: "success" | "error" | "skipped";
  error?: string;
}

interface MigrationReport {
  timestamp: string;
  mode: "dry_run" | "execute" | "rollback";
  summary: {
    total: number;
    migrated: number;
    skipped: number;
    errors: number;
  };
  results: MigrationResult[];
}

async function checkAlreadyMigrated(imageAssetId: string): Promise<string | null> {
  return null;
}

async function runMigration(execute: boolean): Promise<MigrationReport> {
  console.log(`Starting migration (mode: ${execute ? "execute" : "dry_run"})...\n`);
  
  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    mode: execute ? "execute" : "dry_run",
    summary: {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
    },
    results: [],
  };

  const allImageAssets = await db.select().from(imageAssets);
  report.summary.total = allImageAssets.length;
  
  console.log(`Found ${allImageAssets.length} image assets to migrate\n`);

  const existingObjectAssets = await db.select().from(objectAssets);
  const existingByStyleAndType = new Map<string, string>();
  for (const obj of existingObjectAssets) {
    const key = `${obj.styleId || "null"}-${obj.type}`;
    existingByStyleAndType.set(key, obj.id);
  }

  for (const asset of allImageAssets) {
    const lookupKey = `${asset.styleId || "null"}-${asset.type}`;
    
    if (existingByStyleAndType.has(lookupKey)) {
      report.results.push({
        styleId: asset.styleId,
        type: asset.type,
        imageAssetId: asset.id,
        objectAssetId: existingByStyleAndType.get(lookupKey),
        status: "skipped",
      });
      report.summary.skipped++;
      console.log(`  [SKIP] ${asset.type} for style ${asset.styleId || "orphan"} - already migrated`);
      continue;
    }

    if (!execute) {
      report.results.push({
        styleId: asset.styleId,
        type: asset.type,
        imageAssetId: asset.id,
        status: "success",
      });
      report.summary.migrated++;
      console.log(`  [DRY] Would migrate ${asset.type} for style ${asset.styleId || "orphan"}`);
      continue;
    }

    try {
      const objectAssetId = await storeImageToObjectStorage(
        asset.originalData,
        asset.type,
        asset.styleId || undefined
      );
      
      report.results.push({
        styleId: asset.styleId,
        type: asset.type,
        imageAssetId: asset.id,
        objectAssetId: objectAssetId,
        status: "success",
      });
      report.summary.migrated++;
      console.log(`  [OK] Migrated ${asset.type} for style ${asset.styleId || "orphan"} -> ${objectAssetId}`);
    } catch (error) {
      report.results.push({
        styleId: asset.styleId,
        type: asset.type,
        imageAssetId: asset.id,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      report.summary.errors++;
      console.log(`  [ERR] Failed to migrate ${asset.type} for style ${asset.styleId || "orphan"}: ${error}`);
    }
  }

  return report;
}

async function runRollback(): Promise<MigrationReport> {
  console.log("Starting rollback (deleting all objectAssets)...\n");
  
  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    mode: "rollback",
    summary: {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
    },
    results: [],
  };

  const allObjectAssets = await db.select().from(objectAssets);
  report.summary.total = allObjectAssets.length;
  
  console.log(`Found ${allObjectAssets.length} object assets to delete\n`);

  const { deleteObjectAssetsByStyle } = await import("../server/object-image-service");
  
  const styleIds = new Set(allObjectAssets.map(a => a.styleId).filter(Boolean));
  
  for (const styleId of styleIds) {
    try {
      await deleteObjectAssetsByStyle(styleId as string);
      console.log(`  [OK] Deleted object assets for style ${styleId}`);
      report.summary.migrated++;
    } catch (error) {
      console.log(`  [ERR] Failed to delete object assets for style ${styleId}: ${error}`);
      report.summary.errors++;
    }
  }

  const orphanAssets = allObjectAssets.filter(a => !a.styleId);
  if (orphanAssets.length > 0) {
    console.log(`  [WARN] ${orphanAssets.length} orphan object assets not deleted`);
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
    console.log(`Total: ${report.summary.total}`);
    console.log(`Migrated: ${report.summary.migrated}`);
    console.log(`Skipped: ${report.summary.skipped}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log("=".repeat(60));

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
