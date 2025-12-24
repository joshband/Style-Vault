import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

interface PreviewGenerationRequest {
  styleName: string;
  styleDescription: string;
}

interface PreviewImage {
  portrait: string;
  landscape: string;
  stillLife: string;
}

/**
 * Generate 3 canonical preview images (portrait, landscape, still life) at lower resolution
 * These are then composited side-by-side into a single preview image
 * Much faster than generating 9 high-res images
 */
export async function generateCanonicalPreviews(
  request: PreviewGenerationRequest
): Promise<PreviewImage> {
  const { styleName, styleDescription } = request;

  // Define 3 preview types with specific prompts
  const previewTypes = [
    {
      key: "portrait",
      prompt: `A portrait in the "${styleName}" style: ${styleDescription}. 
      Create a compelling portrait image that demonstrates this style. Focus on capturing the essential visual characteristics.
      Generate at 384x512 resolution.`,
    },
    {
      key: "landscape",
      prompt: `A landscape scene in the "${styleName}" style: ${styleDescription}. 
      Create a scenic landscape that showcases this style's color palette and lighting.
      Generate at 512x384 resolution.`,
    },
    {
      key: "stillLife",
      prompt: `A still life arrangement in the "${styleName}" style: ${styleDescription}. 
      Create a still life composition that captures the aesthetic and mood of this style.
      Generate at 384x512 resolution.`,
    },
  ];

  const results: Partial<PreviewImage> = {};

  try {
    for (const preview of previewTypes) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: preview.prompt,
                },
              ],
            },
          ],
        });

        // Handle the image response
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
          const parts = candidates[0]?.content?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              // Check if part has inlineData with image
              if ("inlineData" in part && part.inlineData) {
                const imageData = part.inlineData as { data?: string; mimeType?: string };
                if (imageData.data) {
                  // Convert base64 to data URL
                  const mimeType = imageData.mimeType || "image/png";
                  const dataUrl = `data:${mimeType};base64,${imageData.data}`;
                  results[preview.key as keyof PreviewImage] = dataUrl;
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to generate ${preview.key} preview:`, error);
        // Use placeholder if generation fails
        results[preview.key as keyof PreviewImage] = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%23ddd' width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-family='sans-serif'%3EFailed to generate ${preview.key}%3C/text%3E%3C/svg%3E`;
      }
    }
  } catch (error) {
    console.error("Error generating previews:", error);
    throw error;
  }

  return {
    portrait: results.portrait || "",
    landscape: results.landscape || "",
    stillLife: results.stillLife || "",
  };
}
