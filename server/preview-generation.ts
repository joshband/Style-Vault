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
 * Generate placeholder images with style-inspired colors
 */
function generatePlaceholderImage(
  width: number,
  height: number,
  styleName: string,
  type: "portrait" | "landscape" | "stillLife"
): string {
  // Generate a deterministic color based on style name
  let hash = 0;
  for (let i = 0; i < styleName.length; i++) {
    hash = ((hash << 5) - hash) + styleName.charCodeAt(i);
    hash = hash & hash;
  }

  const hue = Math.abs(hash % 360);
  const saturation = 60 + (Math.abs(hash) % 30);
  const lightness = 50 + (Math.abs(hash >> 8) % 20);

  const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const accentColor = `hsl(${(hue + 180) % 360}, ${saturation}%, ${lightness - 20}%)`;

  // Create SVG placeholder with style-inspired gradient
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)"/>
      <text x="50%" y="50%" font-family="serif" font-size="24" font-weight="bold" 
            text-anchor="middle" dominant-baseline="middle" fill="white" opacity="0.4">
        ${type.toUpperCase()}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Generate 3 canonical preview images (portrait, landscape, still life) at lower resolution
 */
export async function generateCanonicalPreviews(
  request: PreviewGenerationRequest
): Promise<PreviewImage> {
  const { styleName, styleDescription } = request;

  try {
    // Try Gemini image generation first
    const previewTypes = [
      {
        key: "portrait",
        prompt: `Generate a portrait in the "${styleName}" style. ${styleDescription}`,
      },
      {
        key: "landscape",
        prompt: `Generate a landscape in the "${styleName}" style. ${styleDescription}`,
      },
      {
        key: "stillLife",
        prompt: `Generate a still life in the "${styleName}" style. ${styleDescription}`,
      },
    ];

    const results: Partial<PreviewImage> = {};

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

        // Try to extract image from response
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
          const parts = candidates[0]?.content?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if ("inlineData" in part && part.inlineData) {
                const imageData = part.inlineData as { data?: string; mimeType?: string };
                if (imageData.data) {
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
        console.warn(`Failed to generate ${preview.key} preview with Gemini:`, error);
      }
    }

    // Fill in any missing previews with styled placeholders
    if (!results.portrait) {
      results.portrait = generatePlaceholderImage(384, 512, styleName, "portrait");
    }
    if (!results.landscape) {
      results.landscape = generatePlaceholderImage(512, 384, styleName, "landscape");
    }
    if (!results.stillLife) {
      results.stillLife = generatePlaceholderImage(384, 384, styleName, "stillLife");
    }

    return {
      portrait: results.portrait || "",
      landscape: results.landscape || "",
      stillLife: results.stillLife || "",
    };
  } catch (error) {
    console.error("Error generating previews:", error);

    // Return styled placeholder images for all types
    return {
      portrait: generatePlaceholderImage(384, 512, styleName, "portrait"),
      landscape: generatePlaceholderImage(512, 384, styleName, "landscape"),
      stillLife: generatePlaceholderImage(384, 384, styleName, "stillLife"),
    };
  }
}
