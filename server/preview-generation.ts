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

export async function generateCanonicalPreviews(
  request: PreviewGenerationRequest
): Promise<PreviewImage> {
  const { styleName, styleDescription } = request;

  const result: PreviewImage = {
    portrait: generateStyledPlaceholder(384, 512, styleName, "portrait"),
    landscape: generateStyledPlaceholder(512, 384, styleName, "landscape"),
    stillLife: generateStyledPlaceholder(384, 384, styleName, "stillLife"),
  };

  try {
    // Generate portrait (3:4) - fixed subject: artist in atelier
    try {
      const portraitResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-05-20",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Generate a portrait image (3:4 vertical aspect ratio) rendered in the "${styleName}" visual style.

Subject: ${CANONICAL_SUBJECTS.portrait}

Apply these style characteristics to the rendering: ${styleDescription}

The image should clearly demonstrate this style's color palette, lighting approach, texture treatment, and overall mood.`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ["image", "text"],
        },
      });

      const portraitImage = extractImageFromResponse(portraitResponse);
      if (portraitImage) {
        result.portrait = portraitImage;
      }
    } catch (error) {
      console.warn("Portrait generation failed:", error instanceof Error ? error.message : String(error));
    }

    // Generate landscape (16:9) - fixed subject: elevated promenade overlooking cityscape
    try {
      const landscapeResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-05-20",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Generate a landscape image (16:9 horizontal aspect ratio) rendered in the "${styleName}" visual style.

Subject: ${CANONICAL_SUBJECTS.landscape}

Apply these style characteristics to the rendering: ${styleDescription}

The image should clearly demonstrate this style's color palette, atmospheric treatment, spatial depth, and overall mood.`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ["image", "text"],
        },
      });

      const landscapeImage = extractImageFromResponse(landscapeResponse);
      if (landscapeImage) {
        result.landscape = landscapeImage;
      }
    } catch (error) {
      console.warn("Landscape generation failed:", error instanceof Error ? error.message : String(error));
    }

    // Generate still life (1:1) - fixed subject: curated desk arrangement
    try {
      const stillLifeResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-05-20",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Generate a still life image (1:1 square aspect ratio) rendered in the "${styleName}" visual style.

Subject: ${CANONICAL_SUBJECTS.stillLife}

Apply these style characteristics to the rendering: ${styleDescription}

The image should clearly demonstrate this style's color palette, material textures, lighting approach, and overall mood.`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ["image", "text"],
        },
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
