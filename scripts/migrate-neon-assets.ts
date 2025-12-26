import { db } from "../server/db";
import { styles, imageAssets } from "../shared/schema";
import { eq } from "drizzle-orm";

const STYLE_ID = "40a06892-19c6-47e2-ab7b-ce8152d6576f";

async function migrateNeonAssets() {
  console.log("Fetching Neon Control Grid style...");
  
  const [style] = await db.select().from(styles).where(eq(styles.id, STYLE_ID));
  
  if (!style) {
    console.error("Style not found!");
    return;
  }
  
  console.log("Style found:", style.name);
  
  const moodBoard = style.moodBoard as { collage?: string; status?: string; history?: unknown[] } | null;
  const uiConcepts = style.uiConcepts as { audioPlugin?: string; dashboard?: string; status?: string; history?: unknown[] } | null;
  
  console.log("Has moodBoard.collage:", !!moodBoard?.collage);
  console.log("Has uiConcepts.audioPlugin:", !!uiConcepts?.audioPlugin);
  console.log("Has uiConcepts.dashboard:", !!uiConcepts?.dashboard);
  
  const existingAssets = await db.select().from(imageAssets).where(eq(imageAssets.styleId, STYLE_ID));
  const existingTypes = existingAssets.map(a => a.type);
  console.log("Existing asset types:", existingTypes);
  
  if (moodBoard?.collage && !existingTypes.includes("mood_board")) {
    console.log("Creating mood_board asset...");
    
    const [inserted] = await db.insert(imageAssets).values({
      styleId: STYLE_ID,
      type: "mood_board",
      originalData: moodBoard.collage,
    }).returning();
    
    console.log("Created mood_board with id:", inserted.id);
  } else if (existingTypes.includes("mood_board")) {
    console.log("mood_board already exists, skipping");
  }
  
  if (uiConcepts?.audioPlugin && !existingTypes.includes("ui_audio_plugin")) {
    console.log("Creating ui_audio_plugin asset...");
    
    const [inserted] = await db.insert(imageAssets).values({
      styleId: STYLE_ID,
      type: "ui_audio_plugin",
      originalData: uiConcepts.audioPlugin,
    }).returning();
    
    console.log("Created ui_audio_plugin with id:", inserted.id);
  } else if (existingTypes.includes("ui_audio_plugin")) {
    console.log("ui_audio_plugin already exists, skipping");
  }
  
  if (uiConcepts?.dashboard && !existingTypes.includes("ui_dashboard")) {
    console.log("Creating ui_dashboard asset...");
    
    const [inserted] = await db.insert(imageAssets).values({
      styleId: STYLE_ID,
      type: "ui_dashboard",
      originalData: uiConcepts.dashboard,
    }).returning();
    
    console.log("Created ui_dashboard with id:", inserted.id);
  } else if (existingTypes.includes("ui_dashboard")) {
    console.log("ui_dashboard already exists, skipping");
  }
  
  console.log("\nClearing legacy base64 data from moodBoard/uiConcepts columns...");
  
  const cleanedMoodBoard = moodBoard ? {
    status: (moodBoard.status || "complete") as "pending" | "complete" | "failed" | "generating",
    history: moodBoard.history || [],
  } : null;
  
  const cleanedUiConcepts = uiConcepts ? {
    status: (uiConcepts.status || "complete") as "pending" | "complete" | "failed" | "generating",
    history: uiConcepts.history || [],
  } : null;
  
  await db.update(styles)
    .set({ 
      moodBoard: cleanedMoodBoard,
      uiConcepts: cleanedUiConcepts,
    })
    .where(eq(styles.id, STYLE_ID));
  
  console.log("Migration complete!");
  
  const finalAssets = await db.select({ id: imageAssets.id, type: imageAssets.type }).from(imageAssets).where(eq(imageAssets.styleId, STYLE_ID));
  console.log("\nFinal assets for Neon Control Grid:");
  for (const asset of finalAssets) {
    console.log(`  - ${asset.type}: ${asset.id}`);
  }
}

migrateNeonAssets().catch(console.error);
