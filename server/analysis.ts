import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface AnalysisResult {
  styleName: string;
  description: string;
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
              text: `Analyze this image and generate a creative, memorable style name and compelling description.

Return ONLY valid JSON (no markdown, no code blocks) with exactly this structure:
{
  "styleName": "A creative, concise style name (2-4 words, max 30 chars)",
  "description": "A 1-2 sentence poetic description of the visual style, color palette, mood, and aesthetic."
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

    return {
      styleName: result.styleName.trim(),
      description: result.description.trim(),
    };
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
}
