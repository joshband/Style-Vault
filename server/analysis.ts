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
  "description": "A 1-2 sentence poetic description of the visual style, color palette, mood, and aesthetic. Focus on the essence of what makes this style unique."
}

Consider:
- Color palette and dominant hues
- Lighting and atmosphere
- Texture and surface qualities
- Compositional balance
- Overall mood and aesthetic`,
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64.replace(/^data:image\/(jpeg|png|webp|gif);base64,/, ""),
              },
            },
          ],
        },
      ],
    });

    const textContent = response.candidates?.[0]?.content?.parts?.[0];
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Gemini");
    }

    // Clean response - remove markdown code blocks if present
    let jsonStr = textContent.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(jsonStr) as AnalysisResult;

    // Validate result
    if (!result.styleName || !result.description) {
      throw new Error("Invalid response format");
    }

    return {
      styleName: result.styleName.trim(),
      description: result.description.trim(),
    };
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw new Error("Failed to analyze image");
  }
}
