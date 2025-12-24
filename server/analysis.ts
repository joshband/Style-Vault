import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface MetadataTags {
  mood: string[];
  colorFamily: string[];
  era: string[];
  medium: string[];
  subjects: string[];
  lighting: string[];
  texture: string[];
}

export interface AnalysisResult {
  styleName: string;
  description: string;
  metadataTags: MetadataTags;
}

/**
 * Analyze an uploaded image and generate creative style name and description using Gemini vision
 */
export async function analyzeImageForStyle(imageBase64: string): Promise<AnalysisResult> {
  try {
    // Remove data URL prefix if present
    let cleanBase64 = imageBase64;
    if (imageBase64.includes(",")) {
      cleanBase64 = imageBase64.split(",")[1];
    }
    
    // Ensure we have valid base64
    if (!cleanBase64 || cleanBase64.length < 100) {
      throw new Error("Invalid or incomplete image data");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this image and generate a creative, memorable style name, description, and visual metadata tags.

Return ONLY valid JSON (no markdown, no code blocks) with exactly this structure:
{
  "styleName": "A creative, concise style name (2-4 words, max 30 chars)",
  "description": "A 1-2 sentence poetic description of the visual style, color palette, mood, and aesthetic.",
  "metadataTags": {
    "mood": ["2-4 mood descriptors like: serene, dramatic, playful, melancholic, vibrant, nostalgic"],
    "colorFamily": ["2-4 color families like: warm, cool, monochrome, pastel, earth tones, jewel tones"],
    "era": ["1-2 era/period like: modern, vintage, retro, futuristic, classical, contemporary"],
    "medium": ["1-3 medium types like: photography, illustration, 3D render, painting, mixed media"],
    "subjects": ["2-4 subject types like: portrait, landscape, still life, abstract, architectural"],
    "lighting": ["1-3 lighting descriptors like: natural, studio, dramatic, soft, golden hour, high contrast"],
    "texture": ["1-3 texture descriptors like: smooth, grainy, rough, glossy, matte, organic"]
  }
}

Consider: Color palette, lighting, atmosphere, texture, surface qualities, compositional balance, and overall mood.`,
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
          ],
        },
      ],
    });

    // Handle response - Gemini may return text in parts array
    let responseText = "";
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if ("text" in part && typeof part.text === "string") {
            responseText = part.text;
            break;
          }
        }
      }
    }

    if (!responseText) {
      throw new Error("No text response from Gemini");
    }

    // Clean response - remove markdown code blocks if present
    let jsonStr = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Extract JSON if it's embedded in text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const result = JSON.parse(jsonStr) as AnalysisResult;

    // Validate result
    if (!result.styleName || !result.description) {
      throw new Error("Invalid response format from AI");
    }

    // Default metadata tags if not provided
    const defaultTags: MetadataTags = {
      mood: [],
      colorFamily: [],
      era: [],
      medium: [],
      subjects: [],
      lighting: [],
      texture: [],
    };

    return {
      styleName: result.styleName.trim(),
      description: result.description.trim(),
      metadataTags: result.metadataTags || defaultTags,
    };
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
}
