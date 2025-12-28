/**
 * Batch Style Regeneration Script
 * 
 * This script regenerates all styles in the development database:
 * 1. Extracts fresh tokens from reference images using CV pipeline
 * 2. Generates new previews, mood boards, and UI concepts
 * 3. Stores all images through the image service for WebP optimization
 * 4. Updates metadata and typography recommendations
 * 
 * Usage: npx tsx scripts/regenerate-all-styles.ts
 */

import { storage } from "../server/storage";
import { regenerateAllStyles, getRegenerationProgress } from "../server/style-regeneration";
import { logger } from "../server/logger";

async function main() {
  console.log("=".repeat(60));
  console.log("Visual DNA - Batch Style Regeneration");
  console.log("=".repeat(60));
  console.log("");
  
  // Get all styles
  const allStyleIds = await storage.getAllStyleIds();
  console.log(`Found ${allStyleIds.length} styles in database`);
  
  if (allStyleIds.length === 0) {
    console.log("No styles to regenerate. Exiting.");
    return;
  }
  
  // Get styles with reference images (required for regeneration)
  const allStyles = await storage.getStyles();
  const eligibleStyles = allStyles.filter(s => 
    s.referenceImages && (s.referenceImages as string[]).length > 0
  );
  
  console.log(`${eligibleStyles.length} styles have reference images and are eligible for regeneration`);
  console.log("");
  
  if (eligibleStyles.length === 0) {
    console.log("No eligible styles found. Exiting.");
    return;
  }
  
  // List styles to be regenerated
  console.log("Styles to regenerate:");
  eligibleStyles.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s.id})`);
  });
  console.log("");
  
  // Start regeneration
  console.log("Starting batch regeneration...");
  console.log("This may take several minutes depending on the number of styles.");
  console.log("");
  
  const startTime = Date.now();
  
  try {
    const result = await regenerateAllStyles({
      styleIds: eligibleStyles.map(s => s.id),
    });
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log("");
    console.log("=".repeat(60));
    console.log("REGENERATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`Total styles: ${result.totalStyles}`);
    console.log(`Successful: ${result.successfulStyles}`);
    console.log(`Failed: ${result.failedStyles}`);
    console.log(`Duration: ${duration} minutes`);
    console.log("");
    
    // Print summary of each style
    if (result.results && result.results.length > 0) {
      console.log("Results by style:");
      result.results.forEach((r) => {
        const status = r.success ? "✓" : "✗";
        const tokenChanges = r.diff?.tokensChanged ? "tokens updated" : "tokens unchanged";
        const previewCount = r.diff?.previewsRegenerated?.length || 0;
        console.log(`  ${status} ${r.styleName}: ${tokenChanges}, ${previewCount} previews regenerated`);
      });
    }
    
  } catch (error) {
    console.error("Regeneration failed:", error);
    logger.error("Batch regeneration script failed", error, { module: 'BatchRegen' });
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log("");
  console.log("Script completed. Exiting.");
  process.exit(0);
}).catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
