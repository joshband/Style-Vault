import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface GenerationResult {
  imageBase64: string;
  thumbnailBase64: string;
}

export async function generateStyledImage(
  prompt: string,
  styleName: string,
  styleDescription: string,
  promptScaffolding: { base: string; modifiers: string[]; negative: string }
): Promise<GenerationResult> {
  try {
    const fullPrompt = `${promptScaffolding.base}

Style: ${styleName}
Style description: ${styleDescription}

User concept: ${prompt}

Style modifiers: ${promptScaffolding.modifiers.join(", ")}

Create a high-quality image that faithfully applies the style to the user's concept. Maintain the color palette, mood, and aesthetic characteristics of the style.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
        },
      ],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    let imageBase64 = "";
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if ("inlineData" in part && part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            break;
          }
        }
      }
    }

    if (!imageBase64) {
      throw new Error("No image generated from AI");
    }

    const thumbnailBase64 = imageBase64;

    return {
      imageBase64,
      thumbnailBase64,
    };
  } catch (error) {
    console.error("Error generating styled image:", error);
    throw error;
  }
}
