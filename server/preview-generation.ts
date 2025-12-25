import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

type ProgressCallback = (progress: number, message: string) => Promise<void>;

interface PreviewGenerationRequest {
  styleName: string;
  styleDescription: string;
  referenceImageBase64?: string;
  onProgress?: ProgressCallback;
}

interface PreviewImage {
  portrait: string;
  landscape: string;
  stillLife: string;
}

// Validate that an image string is a real base64 data URI (not SVG placeholder)
export function isValidImageDataUri(dataUri: string | null | undefined): boolean {
  if (!dataUri || typeof dataUri !== "string") return false;
  
  // Check for SVG placeholder (our fallback format)
  if (dataUri.startsWith("data:image/svg+xml")) return false;
  
  // Check for valid base64 image data URI pattern
  const validImagePattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
  if (!validImagePattern.test(dataUri)) return false;
  
  // Verify minimum base64 payload length (empty images are invalid)
  const base64Part = dataUri.split(",")[1];
  if (!base64Part || base64Part.length < 100) return false;
  
  return true;
}

// Check if preview images are valid (not placeholders)
export function validatePreviewImages(previews: PreviewImage): {
  valid: boolean;
  validCount: number;
  invalidCount: number;
  details: { portrait: boolean; landscape: boolean; stillLife: boolean };
} {
  const details = {
    portrait: isValidImageDataUri(previews.portrait),
    landscape: isValidImageDataUri(previews.landscape),
    stillLife: isValidImageDataUri(previews.stillLife),
  };
  
  const validCount = Object.values(details).filter(Boolean).length;
  const invalidCount = 3 - validCount;
  
  return {
    valid: validCount > 0,
    validCount,
    invalidCount,
    details,
  };
}

// Fixed canonical subjects for consistent cross-style comparison
const CANONICAL_SUBJECTS = {
  portrait: "an artist standing in their sunlit atelier studio, wearing a paint-stained apron, holding a palette and brush, with an easel and canvas visible behind them",
  landscape: "an elevated stone promenade with ornate railings overlooking a layered cityscape at golden hour, with rooftops, spires, and distant mountains visible on the horizon",
  stillLife: "a curated arrangement on a wooden studio desk featuring an open leather-bound sketchbook, glass jars of colorful pigments, a small sculpted bust, dried flowers in a ceramic vase, and natural light from a nearby window",
};

function generateStyledPlaceholder(
  width: number,
  height: number,
  styleName: string,
  type: "portrait" | "landscape" | "stillLife"
): string {
  let hash = 0;
  for (let i = 0; i < styleName.length; i++) {
    hash = ((hash << 5) - hash) + styleName.charCodeAt(i);
    hash = hash & hash;
  }

  const hue = Math.abs(hash % 360);
  const saturation = 65 + (Math.abs(hash) % 25);
  const lightness = 45 + (Math.abs(hash >> 8) % 25);

  const color1 = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const color2 = `hsl(${(hue + 120) % 360}, ${saturation}%, ${lightness + 15}%)`;
  const color3 = `hsl(${(hue + 240) % 360}, ${saturation}%, ${lightness - 10}%)`;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${Math.random()}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${color2};stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:${color3};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad${Math.random()})"/>
      <circle cx="${width * 0.25}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.12}" fill="${color2}" opacity="0.5"/>
      <circle cx="${width * 0.75}" cy="${height * 0.7}" r="${Math.min(width, height) * 0.08}" fill="${color3}" opacity="0.6"/>
      <text x="50%" y="50%" font-family="serif" font-size="${Math.min(width, height) * 0.08}" font-weight="600" 
            text-anchor="middle" dominant-baseline="middle" fill="white" opacity="0.7">
        ${type === "portrait" ? "PORTRAIT" : type === "landscape" ? "LANDSCAPE" : "STILL LIFE"}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function generateSinglePreview(
  styleName: string,
  styleDescription: string,
  type: "portrait" | "landscape" | "stillLife"
): Promise<string | null> {
  const aspectRatios = {
    portrait: "3:4 vertical",
    landscape: "16:9 horizontal",
    stillLife: "1:1 square",
  };
  
  const characteristics = {
    portrait: "color palette, lighting approach, texture treatment, and overall mood",
    landscape: "color palette, atmospheric treatment, spatial depth, and overall mood",
    stillLife: "color palette, material textures, lighting approach, and overall mood",
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate a ${type} image (${aspectRatios[type]} aspect ratio) rendered in the "${styleName}" visual style.

Subject: ${CANONICAL_SUBJECTS[type]}

Apply these style characteristics to the rendering: ${styleDescription}

The image should clearly demonstrate this style's ${characteristics[type]}. Keep the image compact and optimized.`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    return extractImageFromResponse(response);
  } catch (error) {
    console.warn(`${type} generation failed:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

export interface PreviewGenerationResult extends PreviewImage {
  allFailed: boolean;
  successCount: number;
}

export async function generateCanonicalPreviews(
  request: PreviewGenerationRequest
): Promise<PreviewGenerationResult> {
  const { styleName, styleDescription, onProgress } = request;

  const result: PreviewGenerationResult = {
    portrait: generateStyledPlaceholder(384, 512, styleName, "portrait"),
    landscape: generateStyledPlaceholder(512, 384, styleName, "landscape"),
    stillLife: generateStyledPlaceholder(384, 384, styleName, "stillLife"),
    allFailed: true,
    successCount: 0,
  };

  let successCount = 0;

  try {
    // If progress callback provided, generate sequentially with updates
    if (onProgress) {
      await onProgress(5, "Generating portrait preview...");
      const portraitImage = await generateSinglePreview(styleName, styleDescription, "portrait");
      if (portraitImage) {
        result.portrait = portraitImage;
        successCount++;
      }
      
      await onProgress(35, "Generating landscape preview...");
      const landscapeImage = await generateSinglePreview(styleName, styleDescription, "landscape");
      if (landscapeImage) {
        result.landscape = landscapeImage;
        successCount++;
      }
      
      await onProgress(65, "Generating still-life preview...");
      const stillLifeImage = await generateSinglePreview(styleName, styleDescription, "stillLife");
      if (stillLifeImage) {
        result.stillLife = stillLifeImage;
        successCount++;
      }
      
      await onProgress(95, "Finalizing previews...");
    } else {
      // Generate all 3 previews in parallel for ~3x speedup (no progress tracking)
      const [portraitImage, landscapeImage, stillLifeImage] = await Promise.all([
        generateSinglePreview(styleName, styleDescription, "portrait"),
        generateSinglePreview(styleName, styleDescription, "landscape"),
        generateSinglePreview(styleName, styleDescription, "stillLife"),
      ]);

      if (portraitImage) {
        result.portrait = portraitImage;
        successCount++;
      }
      if (landscapeImage) {
        result.landscape = landscapeImage;
        successCount++;
      }
      if (stillLifeImage) {
        result.stillLife = stillLifeImage;
        successCount++;
      }
    }
  } catch (error) {
    console.error("Error in preview generation:", error instanceof Error ? error.message : String(error));
  }

  result.successCount = successCount;
  result.allFailed = successCount === 0;
  
  // Log the result
  if (result.allFailed) {
    console.warn(`All preview generations failed for style "${styleName}"`);
  } else if (successCount < 3) {
    console.log(`Preview generation partial success for "${styleName}": ${successCount}/3 images generated`);
  }

  return result;
}

function extractImageFromResponse(response: any): string | null {
  try {
    if (!response || !response.candidates || response.candidates.length === 0) {
      return null;
    }

    const candidate = response.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts) {
      return null;
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        const data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/png";
        if (data) {
          return `data:${mimeType};base64,${data}`;
        }
      }
    }
  } catch (error) {
    console.warn("Error extracting image from response:", error instanceof Error ? error.message : String(error));
  }

  return null;
}
