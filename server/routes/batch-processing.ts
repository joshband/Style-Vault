import { storage } from "../storage";
import { cache, CACHE_KEYS } from "../cache";
import { analyzeImageForStyle } from "../analysis";
import { generateCanonicalPreviews } from "../preview-generation";
import { queueStyleForEnrichment } from "../metadata-enrichment";
import { getDefaultMetadataTags, DEFAULT_TOKENS } from "./utils";

export async function processBatchInBackground(batchId: string) {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(3);
  
  try {
    const jobs = await storage.getJobsByBatchId(batchId);
    
    const processJob = async (job: any) => {
      try {
        await storage.updateJobStatus(job.id, "running", {
          progress: 10,
          progressMessage: "Analyzing image...",
        });

        const input = job.input as { imageId: string; name: string; imageBase64: string };
        
        const analysis = await analyzeImageForStyle(input.imageBase64);
        
        await storage.updateJobStatus(job.id, "running", {
          progress: 40,
          progressMessage: "Generating previews...",
        });

        const previews = await generateCanonicalPreviews({
          styleName: analysis.styleName,
          styleDescription: analysis.description,
          referenceImageBase64: input.imageBase64,
          tokens: DEFAULT_TOKENS,
        });

        await storage.updateJobStatus(job.id, "running", {
          progress: 70,
          progressMessage: "Creating style...",
        });

        const style = await storage.createStyle({
          name: analysis.styleName || input.name || `Style from ${input.imageId.substring(0, 8)}`,
          description: analysis.description,
          referenceImages: [input.imageBase64],
          previews: {
            portrait: previews.portrait || "",
            landscape: previews.landscape || "",
            stillLife: previews.stillLife || "",
          },
          tokens: DEFAULT_TOKENS,
          promptScaffolding: {
            base: analysis.description,
            modifiers: ["auto-generated", "batch-upload"],
            negative: "blurry, low quality, distorted",
          },
          metadataTags: getDefaultMetadataTags(),
          metadataEnrichmentStatus: "pending",
          moodBoard: { status: "pending", history: [] },
          uiConcepts: { status: "pending", history: [] },
        });

        queueStyleForEnrichment(style.id);

        await storage.updateJobStatus(job.id, "succeeded", {
          progress: 100,
          progressMessage: "Complete",
          output: { styleId: style.id },
        });

        cache.delete(CACHE_KEYS.STYLE_SUMMARIES);

        return { success: true, styleId: style.id };
      } catch (error) {
        console.error(`Batch job ${job.id} failed:`, error);
        await storage.updateJobStatus(job.id, "failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return { success: false };
      }
    };

    const results = await Promise.all(
      jobs.map(job => limit(() => processJob(job)))
    );

    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    await storage.updateBatchProgress(batchId, completed, failed);
    
    cache.delete(CACHE_KEYS.STYLE_SUMMARIES);
    
  } catch (error) {
    console.error("Batch processing failed:", error);
    await storage.updateBatchStatus(batchId, "failed");
  }
}
