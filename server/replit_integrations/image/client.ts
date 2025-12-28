import { GoogleGenAI, Modality } from "@google/genai";
import OpenAI from "openai";

// Gemini client via Replit AI Integrations
export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// OpenAI client via Replit AI Integrations
export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type ImageProvider = "gemini" | "openai" | "prodia";

interface StyleTransferOptions {
  referenceImageBase64?: string;
  renderingStyle?: RenderingStyle;
}

export interface RenderingStyle {
  medium: string;
  technique: string;
  colorPalette: string;
  characteristics: string[];
}

/**
 * Generate an image with Gemini, optionally using a style reference image.
 * Uses gemini-2.5-flash-image model via Replit AI Integrations.
 */
export async function generateWithGemini(
  prompt: string, 
  options?: StyleTransferOptions
): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  
  // If we have a reference image, add it as style reference
  if (options?.referenceImageBase64) {
    const mimeMatch = options.referenceImageBase64.match(/^data:(image\/[a-z]+);base64,/);
    const mimeType = mimeMatch?.[1] || "image/jpeg";
    const base64Data = options.referenceImageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    
    parts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  }
  
  // Build enhanced prompt with rendering style instructions
  let enhancedPrompt = prompt;
  if (options?.renderingStyle) {
    const rs = options.renderingStyle;
    enhancedPrompt = `CRITICAL STYLE REQUIREMENTS - You MUST follow these exactly:
- Medium: ${rs.medium}
- Technique: ${rs.technique}  
- Color palette: ${rs.colorPalette}
- Style characteristics: ${rs.characteristics.join(", ")}

DO NOT render as photorealistic. DO NOT use modern digital gradients. 
MATCH the artistic rendering style shown in the reference image exactly.

Subject to render: ${prompt}`;
  } else if (options?.referenceImageBase64) {
    enhancedPrompt = `Study the artistic style, rendering technique, and color palette of the reference image carefully. 
Generate a NEW image with the EXACT same artistic rendering style, medium, and color treatment.
DO NOT make it photorealistic if the reference is illustrated/painted.
Preserve the same level of detail, line quality, and color saturation.

Subject to generate: ${prompt}`;
  }
  
  parts.push({ text: enhancedPrompt });
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in Gemini response");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

/**
 * Generate an image with OpenAI gpt-image-1.
 */
export async function generateWithOpenAI(
  prompt: string,
  options?: StyleTransferOptions
): Promise<string> {
  let enhancedPrompt = prompt;
  
  if (options?.renderingStyle) {
    const rs = options.renderingStyle;
    enhancedPrompt = `Create an image with EXACTLY this artistic style:
Medium: ${rs.medium}
Technique: ${rs.technique}
Color palette: ${rs.colorPalette}
Style: ${rs.characteristics.join(", ")}

IMPORTANT: This is NOT photorealistic. Render as ${rs.medium} with ${rs.technique} technique.

Subject: ${prompt}`;
  }
  
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: enhancedPrompt,
    size: "1024x1024",
  });

  const base64 = response.data?.[0]?.b64_json ?? "";
  if (!base64) {
    throw new Error("No image data in OpenAI response");
  }
  
  return `data:image/png;base64,${base64}`;
}

/**
 * Analyze a reference image to extract its rendering style.
 */
export async function analyzeRenderingStyle(referenceImageBase64: string): Promise<RenderingStyle | null> {
  try {
    const mimeMatch = referenceImageBase64.match(/^data:(image\/[a-z]+);base64,/);
    const mimeType = mimeMatch?.[1] || "image/jpeg";
    const base64Data = referenceImageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `Analyze the ARTISTIC RENDERING STYLE of this image. Focus on HOW it was created, not WHAT it shows.

Return JSON:
{
  "medium": "exact medium (e.g., 'hand-drawn line art with watercolor wash', 'digital illustration', 'oil painting', 'pencil sketch', 'vector art')",
  "technique": "rendering technique (e.g., 'cross-hatching', 'flat color blocks', 'soft gradients', 'impasto', 'cel-shading')",
  "colorPalette": "describe the color treatment (e.g., 'muted earth tones with cream and rust', 'vibrant neon', 'desaturated pastels', 'monochromatic')",
  "characteristics": ["list", "of", "5-7", "specific", "visual", "traits", "like", "visible-brushstrokes", "hand-drawn-quality", "retro-illustration", "limited-color-palette"]
}

Be VERY specific about the artistic medium and technique. This will be used to replicate the style.
Only return valid JSON, no markdown.`,
          },
        ],
      }],
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0];
    if (!text || typeof text !== "object" || !("text" in text)) return null;
    
    const jsonStr = String(text.text).replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonStr) as RenderingStyle;
  } catch (error) {
    console.error("[StyleAnalysis] Failed to analyze rendering style:", error);
    return null;
  }
}

/**
 * Simple image generation (backward compatible).
 */
export async function generateImage(prompt: string): Promise<string> {
  return generateWithGemini(prompt);
}

