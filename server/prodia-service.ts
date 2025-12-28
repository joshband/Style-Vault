import { createProdia } from "prodia/v2";
import { logger } from "./logger";

export interface ProdiaGenerationOptions {
  prompt: string;
  seed?: number;
  width?: number;
  height?: number;
}

export interface ProdiaGenerationResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
  processingTimeMs: number;
  seed?: number;
}

let prodiaClient: ReturnType<typeof createProdia> | null = null;

function getClient() {
  if (!prodiaClient) {
    const token = process.env.PRODIA_TOKEN;
    if (!token) {
      throw new Error("PRODIA_TOKEN environment variable is not set");
    }
    prodiaClient = createProdia({ token });
  }
  return prodiaClient;
}

export function isProdiaEnabled(): boolean {
  return !!process.env.PRODIA_TOKEN;
}

export async function generateWithFluxSchnell(
  options: ProdiaGenerationOptions
): Promise<ProdiaGenerationResult> {
  const startTime = Date.now();
  
  try {
    const client = getClient();
    
    const config: Record<string, string | number | boolean> = {
      prompt: options.prompt,
    };
    
    if (options.seed !== undefined) {
      config.seed = options.seed;
    }

    const job = await client.job({
      type: "inference.flux-fast.schnell.txt2img.v1",
      config: config as Record<string, string | number | boolean>,
    });

    const imageBuffer = await job.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const imageBase64 = `data:image/jpeg;base64,${base64}`;

    return {
      success: true,
      imageBase64,
      processingTimeMs: Date.now() - startTime,
      seed: options.seed,
    };
  } catch (error) {
    logger.error("Generation failed", error, { module: 'ProdiaService' });
    
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.message.includes("Invalid API Key") || error.message.includes("Unauthorized")) {
        errorMessage = "Invalid Prodia API key. Please check your PRODIA_TOKEN.";
      } else if (error.message.includes("Rate limit")) {
        errorMessage = "Rate limit exceeded. Please try again in a moment.";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export async function generateWithFluxDev(
  options: ProdiaGenerationOptions
): Promise<ProdiaGenerationResult> {
  const startTime = Date.now();
  
  try {
    const client = getClient();
    
    const config: Record<string, string | number | boolean> = {
      prompt: options.prompt,
    };
    
    if (options.seed !== undefined) {
      config.seed = options.seed;
    }

    const job = await client.job({
      type: "inference.flux.dev.txt2img.v1",
      config: config as Record<string, string | number | boolean>,
    });

    const imageBuffer = await job.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const imageBase64 = `data:image/jpeg;base64,${base64}`;

    return {
      success: true,
      imageBase64,
      processingTimeMs: Date.now() - startTime,
      seed: options.seed,
    };
  } catch (error) {
    logger.error("Generation failed", error, { module: 'ProdiaService' });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      processingTimeMs: Date.now() - startTime,
    };
  }
}
