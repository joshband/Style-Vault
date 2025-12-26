import { db } from "../server/db";
import { styles, imageAssets } from "../shared/schema";
import { eq } from "drizzle-orm";
import { extractTokensWithCV, convertToDTCG } from "../server/cv-bridge";

async function extractAndUpdateStyle(styleId: string, styleName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [referenceAsset] = await db
      .select({ id: imageAssets.id, originalData: imageAssets.originalData, type: imageAssets.type })
      .from(imageAssets)
      .where(eq(imageAssets.styleId, styleId))
      .then(assets => assets.filter(a => a.type === 'reference'));

    if (!referenceAsset?.originalData) {
      return { success: false, error: "No reference image found" };
    }

    const imageBase64 = referenceAsset.originalData.replace(/^data:image\/\w+;base64,/, "");

    console.log(`  Extracting tokens for ${styleName}...`);
    const cvResult = await extractTokensWithCV(imageBase64);

    if (!cvResult.success || !cvResult.tokens) {
      return { success: false, error: cvResult.error || "CV extraction failed" };
    }

    const cvTokens = cvResult.tokens;
    if (!cvTokens.color || cvTokens.color.length === 0) {
      return { success: false, error: "CV extraction returned no colors" };
    }

    const dtcgTokens = convertToDTCG(cvTokens);

    const [currentStyle] = await db.select({ tokens: styles.tokens }).from(styles).where(eq(styles.id, styleId));
    
    const existingTokens = currentStyle?.tokens as Record<string, any> || {};
    const mergedTokens = {
      ...existingTokens,
      color: dtcgTokens.color,
      borderRadius: dtcgTokens.borderRadius || existingTokens.borderRadius,
      spacing: dtcgTokens.spacing || existingTokens.spacing,
      shadow: dtcgTokens.shadow || existingTokens.shadow,
    };

    if ((dtcgTokens as any).colorAnalysis) {
      (mergedTokens as any).colorAnalysis = (dtcgTokens as any).colorAnalysis;
    }

    await db.update(styles).set({ tokens: mergedTokens }).where(eq(styles.id, styleId));

    console.log(`  ✓ Updated ${styleName} with ${cvTokens.color.length} colors`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  console.log("CV Token Extraction for All Styles");
  console.log("===================================\n");

  const allStyles = await db.select({ id: styles.id, name: styles.name }).from(styles);
  console.log(`Found ${allStyles.length} styles to process\n`);

  let successCount = 0;
  let failCount = 0;
  const failures: { name: string; error: string }[] = [];

  for (const style of allStyles) {
    console.log(`Processing: ${style.name}`);
    const result = await extractAndUpdateStyle(style.id, style.name);
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      failures.push({ name: style.name, error: result.error || "Unknown error" });
      console.log(`  ✗ Failed: ${result.error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n===================================");
  console.log(`Results: ${successCount} succeeded, ${failCount} failed`);
  
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
