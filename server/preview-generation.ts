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
  referenceImageBase64?: string;
}

interface PreviewImage {
  portrait: string;
  landscape: string;
  stillLife: string;
}

/**
 * Generate style-inspired placeholder images
 */
function generateStyledPlaceholder(
  width: number,
  height: number,
  styleName: string,
  type: "portrait" | "landscape" | "stillLife"
): string {
  // Generate colors from style name
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

/**
 * Determine the subject from the image using Gemini's vision capabilities
 */
async function determineSubject(referenceImageBase64?: string, styleDescription?: string): Promise<string> {
  try {
    // If we have a reference image, analyze it to determine the subject
    if (referenceImageBase64) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: referenceImageBase64.split(",")[1] || referenceImageBase64,
                },
              },
              {
                text: "What is the main subject or object in this image? Respond with just 2-3 words describing the subject.",
              },
            ],
          },
        ],
      });

      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts?.[0]?.text) {
        const subject = candidate.content.parts[0].text.trim();
        if (subject.length > 0 && subject.length < 50) {
          return subject;
        }
      }
    }

    // Fallback: try to extract subject from description
    if (styleDescription) {
      // Look for common subjects mentioned in descriptions
      const subjectPatterns = [
        /a (portrait|photo|image) of ([a-z\s]+)/i,
        /featuring ([a-z\s]+)/i,
        /showing ([a-z\s]+)/i,
      ];

      for (const pattern of subjectPatterns) {
        const match = styleDescription.match(pattern);
        if (match) {
          return match[2] || match[1];
        }
      }

      // Extract the most descriptive noun phrase from the first sentence
      const firstSentence = styleDescription.split(/[.!?]/)[0];
      const words = firstSentence.split(" ").slice(0, 5).join(" ");
      if (words.length > 3) {
        return words;
      }
    }

    return "subject in a specific style";
  } catch (error) {
    console.warn("Failed to determine subject:", error instanceof Error ? error.message : String(error));
    return "subject in a specific style";
  }
}

/**
 * Generate 3 canonical preview images with consistent subject but varying compositions
 */
export async function generateCanonicalPreviews(
  request: PreviewGenerationRequest
): Promise<PreviewImage> {
  const { styleName, styleDescription, referenceImageBase64 } = request;

  const result: PreviewImage = {
    portrait: generateStyledPlaceholder(384, 512, styleName, "portrait"),
    landscape: generateStyledPlaceholder(512, 384, styleName, "landscape"),
    stillLife: generateStyledPlaceholder(384, 384, styleName, "stillLife"),
  };

  try {
    // Determine the subject from the reference image
    const subject = await determineSubject(referenceImageBase64, styleDescription);

    // Generate portrait with same subject
    try {
      const portraitResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Create a portrait-oriented photograph of ${subject} in the "${styleName}" style. Style details: ${styleDescription}. Keep the composition focused on the subject in portrait orientation (vertical).`,
              },
            ],
          },
        ],
      });

      const portraitImage = extractImageFromResponse(portraitResponse);
      if (portraitImage) {
        result.portrait = portraitImage;
      }
    } catch (error) {
      console.warn("Portrait generation failed:", error instanceof Error ? error.message : String(error));
    }

    // Generate landscape with same subject
    try {
      const landscapeResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Create a landscape-oriented photograph of ${subject} in the "${styleName}" style. Style details: ${styleDescription}. Keep the composition focused on the subject in landscape orientation (horizontal).`,
              },
            ],
          },
        ],
      });

      const landscapeImage = extractImageFromResponse(landscapeResponse);
      if (landscapeImage) {
        result.landscape = landscapeImage;
      }
    } catch (error) {
      console.warn("Landscape generation failed:", error instanceof Error ? error.message : String(error));
    }

    // Generate still life with same subject
    try {
      const stillLifeResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Create a still life photograph of ${subject} in the "${styleName}" style. Style details: ${styleDescription}. Keep the composition focused on the subject in square format.`,
              },
            ],
          },
        ],
      });

      const stillLifeImage = extractImageFromResponse(stillLifeResponse);
      if (stillLifeImage) {
        result.stillLife = stillLifeImage;
      }
    } catch (error) {
      console.warn("Still life generation failed:", error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    console.error("Error in preview generation:", error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Extract image from Gemini API response
 */
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
