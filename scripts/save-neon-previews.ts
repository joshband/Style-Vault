import { db } from "../server/db";
import { imageAssets, jobs } from "../shared/schema";
import { eq } from "drizzle-orm";

const STYLE_ID = "40a06892-19c6-47e2-ab7b-ce8152d6576f";
const JOB_ID = "8683abc9-ce13-42ef-8fd0-8108996eb71d";

async function saveNeonPreviews() {
  console.log("Fetching job result...");
  
  const [job] = await db
    .select({ output: jobs.output })
    .from(jobs)
    .where(eq(jobs.id, JOB_ID));
  
  if (!job || !job.output) {
    console.error("Job not found or no output");
    process.exit(1);
  }
  
  const output = job.output as { portrait?: string; landscape?: string; stillLife?: string };
  console.log("Found previews:", {
    portrait: !!output.portrait,
    landscape: !!output.landscape,
    stillLife: !!output.stillLife,
  });
  
  const previews = [
    { type: "preview_portrait", data: output.portrait },
    { type: "preview_landscape", data: output.landscape },
    { type: "preview_still_life", data: output.stillLife },
  ];
  
  for (const preview of previews) {
    if (preview.data) {
      const [inserted] = await db
        .insert(imageAssets)
        .values({
          styleId: STYLE_ID,
          type: preview.type as any,
          originalData: preview.data,
          thumbData: preview.data,
          mediumData: preview.data,
        })
        .returning();
      console.log(`Saved ${preview.type}: ${inserted.id}`);
    }
  }
  
  console.log("Done!");
  process.exit(0);
}

saveNeonPreviews().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
