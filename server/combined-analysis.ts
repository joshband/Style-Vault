import { visionService, VisionAnalysisResult } from "./vision-service";
import { extractTokensWithCV, CVExtractionResult, CVColorToken } from "./cv-bridge";
import type { MetadataTags } from "@shared/schema";

interface VisionDerivedMetadata {
  subjects: string[];
  detectedLabels: string[];
  detectedText?: string;
  safeForWork: boolean;
  webContext: string[];
}

interface CombinedAnalysisResult {
  cv: CVExtractionResult;
  vision?: VisionAnalysisResult;
  visionMetadata?: VisionDerivedMetadata;
  mergedColors?: Array<{
    oklch?: string;
    rgb: { r: number; g: number; b: number };
    source: "cv" | "vision";
    weight: number;
  }>;
  processingTimeMs: number;
}

function labelToKebabCase(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function mapLabelsToSubjects(labels: Array<{ description: string; score: number }>): string[] {
  const subjectKeywords = [
    "person", "people", "portrait", "face", "woman", "man", "child",
    "animal", "cat", "dog", "bird", "wildlife",
    "building", "architecture", "city", "urban", "street",
    "nature", "landscape", "mountain", "ocean", "forest", "tree",
    "food", "meal", "drink", "cuisine",
    "vehicle", "car", "plane", "boat",
    "technology", "computer", "phone", "device",
    "art", "painting", "sculpture", "illustration",
    "fashion", "clothing", "accessory",
    "interior", "furniture", "room",
    "product", "object", "tool"
  ];

  const subjects: string[] = [];
  
  for (const label of labels) {
    if (label.score < 0.5) continue;
    
    const labelLower = label.description.toLowerCase();
    
    for (const keyword of subjectKeywords) {
      if (labelLower.includes(keyword) || keyword.includes(labelLower)) {
        subjects.push(labelToKebabCase(label.description));
        break;
      }
    }
  }

  return Array.from(new Set(subjects)).slice(0, 10);
}

function mapLabelsToMetadataHints(labels: Array<{ description: string; score: number }>): Partial<MetadataTags> {
  const hints: Partial<MetadataTags> = {
    subjects: [],
    mood: [],
    lighting: [],
    texture: [],
  };

  const moodKeywords: Record<string, string[]> = {
    "serene": ["calm", "peaceful", "tranquil", "quiet", "zen"],
    "energetic": ["dynamic", "active", "vibrant", "lively", "action"],
    "dramatic": ["intense", "bold", "striking", "powerful"],
    "nostalgic": ["vintage", "retro", "classic", "old", "antique"],
    "futuristic": ["modern", "technology", "digital", "cyber", "sci-fi"],
    "natural": ["nature", "organic", "earth", "botanical"],
    "industrial": ["metal", "machine", "factory", "urban"],
    "minimalist": ["simple", "clean", "minimal", "sparse"],
    "luxurious": ["elegant", "luxury", "premium", "gold", "refined"],
    "playful": ["fun", "colorful", "whimsical", "cartoon"],
  };

  const lightingKeywords: Record<string, string[]> = {
    "natural-light": ["sunlight", "daylight", "outdoor"],
    "studio-lighting": ["studio", "professional", "portrait"],
    "dramatic-shadows": ["shadow", "contrast", "dark"],
    "soft-diffused": ["soft", "diffused", "gentle"],
    "golden-hour": ["sunset", "sunrise", "warm"],
    "neon-glow": ["neon", "glow", "fluorescent"],
  };

  const textureKeywords: Record<string, string[]> = {
    "smooth": ["smooth", "polished", "sleek", "glossy"],
    "rough": ["rough", "textured", "gritty", "rugged"],
    "metallic": ["metal", "chrome", "steel", "brass"],
    "organic": ["natural", "wood", "stone", "fabric"],
    "digital": ["digital", "pixel", "screen", "lcd"],
  };

  for (const label of labels) {
    if (label.score < 0.4) continue;
    const labelLower = label.description.toLowerCase();

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(k => labelLower.includes(k))) {
        hints.mood?.push(mood);
      }
    }

    for (const [lighting, keywords] of Object.entries(lightingKeywords)) {
      if (keywords.some(k => labelLower.includes(k))) {
        hints.lighting?.push(lighting);
      }
    }

    for (const [texture, keywords] of Object.entries(textureKeywords)) {
      if (keywords.some(k => labelLower.includes(k))) {
        hints.texture?.push(texture);
      }
    }
  }

  hints.mood = Array.from(new Set(hints.mood)).slice(0, 5);
  hints.lighting = Array.from(new Set(hints.lighting)).slice(0, 3);
  hints.texture = Array.from(new Set(hints.texture)).slice(0, 3);

  return hints;
}

function deriveMetadataFromVision(vision: VisionAnalysisResult): VisionDerivedMetadata {
  const subjects = mapLabelsToSubjects(vision.labels);
  
  const objectSubjects = vision.objects
    .filter(obj => obj.score > 0.5)
    .map(obj => labelToKebabCase(obj.name));
  
  const allSubjects = Array.from(new Set([...subjects, ...objectSubjects])).slice(0, 15);

  const detectedLabels = vision.labels
    .filter(l => l.score > 0.5)
    .map(l => labelToKebabCase(l.description))
    .slice(0, 20);

  const safeForWork = 
    vision.safeSearch?.adult !== "LIKELY" && 
    vision.safeSearch?.adult !== "VERY_LIKELY" &&
    vision.safeSearch?.violence !== "LIKELY" &&
    vision.safeSearch?.violence !== "VERY_LIKELY";

  const webContext = vision.webEntities
    ?.filter(e => e.score > 0.3)
    .map(e => labelToKebabCase(e.description))
    .slice(0, 10) || [];

  const detectedText = vision.text[0]?.text;

  return {
    subjects: allSubjects,
    detectedLabels,
    detectedText: detectedText?.slice(0, 500),
    safeForWork,
    webContext,
  };
}

function mergeColorsFromVisionAndCV(
  cvColors: CVColorToken[] | undefined,
  visionColors: VisionAnalysisResult["dominantColors"]
): CombinedAnalysisResult["mergedColors"] {
  const merged: CombinedAnalysisResult["mergedColors"] = [];

  if (cvColors) {
    for (let i = 0; i < Math.min(5, cvColors.length); i++) {
      const color = cvColors[i];
      merged.push({
        oklch: `oklch(${color.l.toFixed(2)} ${color.c.toFixed(3)} ${color.h.toFixed(0)})`,
        rgb: { r: 0, g: 0, b: 0 },
        source: "cv",
        weight: 1 / (i + 1),
      });
    }
  }

  for (const color of visionColors.slice(0, 5)) {
    merged.push({
      rgb: { r: color.red, g: color.green, b: color.blue },
      source: "vision",
      weight: color.pixelFraction,
    });
  }

  return merged;
}

export async function analyzeImageCombined(
  imageSource: string,
  options: {
    includeVision?: boolean;
    includeCv?: boolean;
  } = {}
): Promise<CombinedAnalysisResult> {
  const startTime = Date.now();
  const { includeVision = true, includeCv = true } = options;

  const isUrl = imageSource.startsWith("http://") || imageSource.startsWith("https://") || imageSource.startsWith("gs://");
  
  const promises: [Promise<CVExtractionResult> | null, Promise<VisionAnalysisResult> | null] = [
    includeCv && !isUrl ? extractTokensWithCV(imageSource) : null,
    includeVision && visionService.isAvailable() ? visionService.analyzeImage(imageSource) : null,
  ];

  const [cvResult, visionResult] = await Promise.all([
    promises[0] || Promise.resolve({ success: false, error: "CV disabled" } as CVExtractionResult),
    promises[1] || Promise.resolve(undefined),
  ]);

  const result: CombinedAnalysisResult = {
    cv: cvResult,
    processingTimeMs: Date.now() - startTime,
  };

  if (visionResult && !visionResult.error) {
    result.vision = visionResult;
    result.visionMetadata = deriveMetadataFromVision(visionResult);
    
    if (cvResult.success && cvResult.tokens?.color) {
      result.mergedColors = mergeColorsFromVisionAndCV(
        cvResult.tokens.color,
        visionResult.dominantColors
      );
    }
  }

  return result;
}

export function enrichMetadataWithVision(
  existingMetadata: MetadataTags,
  visionMetadata: VisionDerivedMetadata
): MetadataTags {
  const enriched = { ...existingMetadata };

  if (visionMetadata.subjects.length > 0) {
    const existingSubjects = new Set(enriched.subjects || []);
    for (const subject of visionMetadata.subjects) {
      existingSubjects.add(subject);
    }
    enriched.subjects = Array.from(existingSubjects).slice(0, 15);
  }

  const metadataHints = mapLabelsToMetadataHints(
    visionMetadata.detectedLabels.map(label => ({ description: label, score: 0.8 }))
  );

  if (metadataHints.mood && metadataHints.mood.length > 0) {
    const existingMoods = new Set(enriched.mood || []);
    for (const mood of metadataHints.mood) {
      existingMoods.add(mood);
    }
    enriched.mood = Array.from(existingMoods).slice(0, 8);
  }

  if (metadataHints.lighting && metadataHints.lighting.length > 0) {
    const existingLighting = new Set(enriched.lighting || []);
    for (const light of metadataHints.lighting) {
      existingLighting.add(light);
    }
    enriched.lighting = Array.from(existingLighting).slice(0, 5);
  }

  if (metadataHints.texture && metadataHints.texture.length > 0) {
    const existingTexture = new Set(enriched.texture || []);
    for (const tex of metadataHints.texture) {
      existingTexture.add(tex);
    }
    enriched.texture = Array.from(existingTexture).slice(0, 5);
  }

  return enriched;
}

export { VisionDerivedMetadata };
