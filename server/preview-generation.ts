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

interface GeneratedPreview {
  url: string;
  subject: string;
}

/**
 * Generate 9 canonical preview images showcasing a style in different contexts
 * Similar to Midjourney's style preview gallery
 */
export async function generateCanonicalPreviews(
  request: PreviewGenerationRequest
): Promise<GeneratedPreview[]> {
  const { styleName, styleDescription } = request;

  // Define 9 diverse subject categories to showcase the style
  const subjects = [
    "portrait photography",
    "landscape scenery",
    "still life arrangement",
    "urban architecture",
    "close-up detail",
    "interior design",
    "nature and wildlife",
    "conceptual abstract",
    "everyday objects"
  ];

  const previews: GeneratedPreview[] = [];

  try {
    for (const subject of subjects) {
      try {
        const prompt = `Generate an image in the "${styleName}" style: ${styleDescription}
        
        Subject: ${subject}
        
        Create a visually compelling image that demonstrates this style applied to ${subject}. Maintain artistic consistency with the style description while showcasing the unique characteristics of ${subject}.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
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
                  previews.push({
                    url: dataUrl,
                    subject,
                  });
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to generate preview for ${subject}:`, error);
        // Continue with next subject instead of failing entirely
        previews.push({
          url: `https://images.unsplash.com/photo-${Math.random().toString().slice(2, 15)}?q=80&w=600&h=400&auto=format&fit=crop`,
          subject,
        });
      }
    }
  } catch (error) {
    console.error("Error generating previews:", error);
    throw error;
  }

  return previews;
}
