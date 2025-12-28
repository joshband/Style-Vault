import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface ComponentCandidate {
  id: string;
  bbox: [number, number, number, number];
  shape: Record<string, number>;
  visual: Record<string, any>;
  label: string;
  confidence: number;
}

export interface MaterialSignals {
  translucency_score: number;
  specular_density: number;
  emission_score: number;
  depth_shadow_complexity: number;
}

export interface TextureSignals {
  texture_grain: number;
  microcontrast: number;
  anisotropy: number;
  noise_type_hint: string;
}

export interface AIClassificationResult {
  components: Array<{
    id: string;
    originalLabel: string;
    aiLabel: string;
    semanticType: string;
    interactionHint: string;
    confidence: number;
  }>;
  materialSummary: {
    primaryMaterial: string;
    surfaceQuality: string;
    lightingStyle: string;
    depthCharacteristics: string;
  };
  designContext: {
    uiFamily: string;
    era: string;
    platform: string;
    emotionalTone: string;
  };
  layerRecommendations: string[];
}

export async function classifyComponentsWithAI(
  imageBase64: string,
  components: ComponentCandidate[],
  materialSignals: MaterialSignals,
  textureSignals: TextureSignals
): Promise<AIClassificationResult> {
  try {
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

    const componentDescriptions = components.slice(0, 10).map((c, i) => {
      return `Component ${i + 1} (${c.id}): bbox [${c.bbox.join(", ")}], CV label: "${c.label}", aspect_ratio: ${c.shape.aspect_ratio?.toFixed(2)}, solidity: ${c.shape.solidity?.toFixed(2)}`;
    }).join("\n");

    const signalsSummary = `
Material Signals:
- Translucency: ${(materialSignals.translucency_score * 100).toFixed(0)}%
- Specular density: ${(materialSignals.specular_density * 100).toFixed(0)}%
- Emission: ${(materialSignals.emission_score * 100).toFixed(0)}%
- Shadow complexity: ${(materialSignals.depth_shadow_complexity * 100).toFixed(0)}%

Texture Signals:
- Grain: ${(textureSignals.texture_grain * 100).toFixed(0)}%
- Microcontrast: ${(textureSignals.microcontrast * 100).toFixed(0)}%
- Anisotropy: ${(textureSignals.anisotropy * 100).toFixed(0)}%
- Noise type: ${textureSignals.noise_type_hint}`;

    const prompt = `You are a UI/UX design expert specializing in design system analysis and component recognition.

Analyze this image along with the computer vision analysis results to provide semantic classification of detected UI components and material characteristics.

CV-Detected Components:
${componentDescriptions || "No components detected"}

${signalsSummary}

Based on the image and CV data, provide semantic classification. Return ONLY valid JSON (no markdown):
{
  "components": [
    {
      "id": "component_id from above",
      "originalLabel": "the CV label",
      "aiLabel": "Your semantic label (e.g., 'Primary CTA Button', 'Volume Slider', 'Toggle Switch')",
      "semanticType": "button|slider|toggle|knob|card|container|icon|text|image|input|indicator|other",
      "interactionHint": "tap|drag|rotate|swipe|hover|none",
      "confidence": 0.0 to 1.0
    }
  ],
  "materialSummary": {
    "primaryMaterial": "e.g., frosted glass, brushed metal, soft plastic, matte ceramic",
    "surfaceQuality": "e.g., smooth, textured, embossed, reflective",
    "lightingStyle": "e.g., soft ambient, dramatic spot, neon glow, natural diffuse",
    "depthCharacteristics": "e.g., flat, subtle elevation, deep shadows, floating layers"
  },
  "designContext": {
    "uiFamily": "e.g., skeuomorphic, flat, neumorphic, glassmorphic, brutalist",
    "era": "e.g., modern, retro, futuristic, vintage",
    "platform": "e.g., iOS, Android, web, desktop, embedded",
    "emotionalTone": "e.g., playful, professional, luxurious, minimal, technical"
  },
  "layerRecommendations": ["list of 3-5 recommended layer effects like 'inner glow', 'soft shadow', 'gradient overlay'"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
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

    const jsonStr = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(jsonStr) as AIClassificationResult;
    return result;
  } catch (error) {
    console.error("AI classification error:", error);
    return getDefaultClassification(components);
  }
}

function getDefaultClassification(components: ComponentCandidate[]): AIClassificationResult {
  return {
    components: components.map(c => ({
      id: c.id,
      originalLabel: c.label,
      aiLabel: c.label,
      semanticType: "other",
      interactionHint: "none",
      confidence: 0.5,
    })),
    materialSummary: {
      primaryMaterial: "unknown",
      surfaceQuality: "unknown",
      lightingStyle: "unknown",
      depthCharacteristics: "unknown",
    },
    designContext: {
      uiFamily: "unknown",
      era: "modern",
      platform: "unknown",
      emotionalTone: "neutral",
    },
    layerRecommendations: [],
  };
}

export async function generateMaterialTokensWithAI(
  imageBase64: string,
  recipeMatch: { recipe_id: string; label: string; confidence: number },
  materialSignals: MaterialSignals,
  textureSignals: TextureSignals
): Promise<Record<string, any>> {
  try {
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

    const prompt = `You are a W3C Design Tokens expert. Analyze this UI image and the detected material characteristics to generate DTCG 2025.10 compliant design tokens for the material and surface effects.

Detected Material Recipe: ${recipeMatch.label} (confidence: ${(recipeMatch.confidence * 100).toFixed(0)}%)

Material Signals:
- Translucency: ${(materialSignals.translucency_score * 100).toFixed(0)}%
- Specular: ${(materialSignals.specular_density * 100).toFixed(0)}%
- Emission: ${(materialSignals.emission_score * 100).toFixed(0)}%
- Shadow Complexity: ${(materialSignals.depth_shadow_complexity * 100).toFixed(0)}%

Texture Signals:
- Grain: ${(textureSignals.texture_grain * 100).toFixed(0)}%
- Microcontrast: ${(textureSignals.microcontrast * 100).toFixed(0)}%
- Anisotropy: ${(textureSignals.anisotropy * 100).toFixed(0)}%

Generate W3C DTCG tokens that capture the material and texture characteristics. Return ONLY valid JSON (no markdown):
{
  "material": {
    "blur": { "$type": "dimension", "$value": "Xpx", "$description": "Background blur radius" },
    "opacity": { "$type": "number", "$value": 0.X, "$description": "Surface opacity" },
    "saturation": { "$type": "number", "$value": X, "$description": "Backdrop saturation multiplier" }
  },
  "texture": {
    "noise": { "$type": "number", "$value": 0.X, "$description": "Noise overlay intensity" },
    "grain": { "$type": "number", "$value": 0.X, "$description": "Film grain intensity" }
  },
  "lighting": {
    "highlight": {
      "color": { "$type": "color", "$value": "rgba(255,255,255,0.X)", "$description": "Highlight tint" },
      "position": { "$type": "dimension", "$value": "X%", "$description": "Highlight vertical position" }
    },
    "glow": {
      "color": { "$type": "color", "$value": "#XXXXXX", "$description": "Emission glow color" },
      "spread": { "$type": "dimension", "$value": "Xpx", "$description": "Glow spread radius" },
      "intensity": { "$type": "number", "$value": 0.X, "$description": "Glow opacity" }
    }
  },
  "shadow": {
    "ambient": { "$type": "shadow", "$value": "0 Xpx Xpx rgba(0,0,0,0.X)", "$description": "Ambient occlusion shadow" },
    "drop": { "$type": "shadow", "$value": "0 Xpx Xpx rgba(0,0,0,0.X)", "$description": "Drop shadow" }
  },
  "border": {
    "width": { "$type": "dimension", "$value": "Xpx", "$description": "Border width" },
    "color": { "$type": "color", "$value": "rgba(255,255,255,0.X)", "$description": "Border highlight color" }
  }
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
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

    const jsonStr = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Material token generation error:", error);
    return getDefaultMaterialTokens(materialSignals, textureSignals);
  }
}

function getDefaultMaterialTokens(
  materialSignals: MaterialSignals,
  textureSignals: TextureSignals
): Record<string, any> {
  return {
    material: {
      blur: { "$type": "dimension", "$value": `${Math.round(materialSignals.translucency_score * 20)}px`, "$description": "Background blur radius" },
      opacity: { "$type": "number", "$value": 1 - materialSignals.translucency_score * 0.5, "$description": "Surface opacity" },
    },
    texture: {
      noise: { "$type": "number", "$value": textureSignals.texture_grain * 0.5, "$description": "Noise overlay intensity" },
    },
    shadow: {
      drop: { "$type": "shadow", "$value": `0 ${Math.round(materialSignals.depth_shadow_complexity * 16)}px ${Math.round(materialSignals.depth_shadow_complexity * 32)}px rgba(0,0,0,${(materialSignals.depth_shadow_complexity * 0.3).toFixed(2)})`, "$description": "Drop shadow" },
    },
  };
}
