import { db } from "../server/db";
import { styles, imageAssets } from "../shared/schema";
import { eq } from "drizzle-orm";

async function migrateNeonControlGridImage() {
  console.log("Starting migration for Neon Control Grid...");
  
  const styleId = "40a06892-19c6-47e2-ab7b-ce8152d6576f";
  
  const [style] = await db
    .select({
      id: styles.id,
      name: styles.name,
      referenceImages: styles.referenceImages,
    })
    .from(styles)
    .where(eq(styles.id, styleId));
  
  if (!style) {
    console.error("Style not found!");
    process.exit(1);
  }
  
  console.log(`Found style: ${style.name}`);
  
  const refImages = style.referenceImages as string[] | null;
  
  if (!refImages || refImages.length === 0) {
    console.error("No reference images found in style!");
    process.exit(1);
  }
  
  const base64Data = refImages[0];
  console.log(`Reference image data length: ${base64Data.length} chars`);
  
  const existingImages = await db
    .select({ id: imageAssets.id })
    .from(imageAssets)
    .where(eq(imageAssets.styleId, styleId));
  
  if (existingImages.length > 0) {
    console.log("Images already exist for this style. Skipping migration.");
    process.exit(0);
  }
  
  const [inserted] = await db
    .insert(imageAssets)
    .values({
      styleId: styleId,
      type: "reference",
      originalData: base64Data,
      thumbData: base64Data,
      mediumData: base64Data,
    })
    .returning();
  
  console.log(`Successfully inserted image asset with ID: ${inserted.id}`);
  console.log("Migration complete!");
  
  process.exit(0);
}

migrateNeonControlGridImage().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
