import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import type { Style, MetadataTags, MetadataEnrichmentStatus } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

interface EnrichmentResult {
  mood: string[];
  colorFamily: string[];
  era: string[];
  medium: string[];
  subjects: string[];
  lighting: string[];
  texture: string[];
  keywords: string[];
}

function buildEnrichmentPrompt(style: Style): string {
  const tokensPreview = JSON.stringify(style.tokens, null, 2).slice(0, 2000);
  
  return `Analyze this visual style and generate descriptive metadata tags for search and filtering.

Style Name: ${style.name}
Description: ${style.description}

Design Tokens (excerpt):
${tokensPreview}

Generate tags in these categories. Use lowercase, hyphenated keywords (e.g., "warm-tones", "mid-century").

Respond with ONLY valid JSON in this exact format:
{
  "mood": ["tag1", "tag2", "tag3"],
  "colorFamily": ["tag1", "tag2"],
  "era": ["tag1", "tag2"],
  "medium": ["tag1", "tag2"],
  "subjects": ["tag1", "tag2", "tag3"],
  "lighting": ["tag1", "tag2"],
  "texture": ["tag1", "tag2"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Guidelines:
- mood: emotional qualities (e.g., "serene", "energetic", "nostalgic", "playful")
- colorFamily: color palettes (e.g., "earth-tones", "pastels", "monochrome", "vibrant")
- era: time period influences (e.g., "retro", "modern", "vintage", "futuristic", "mid-century")
- medium: artistic medium feel (e.g., "photographic", "illustrated", "painterly", "digital")
- subjects: common subject matter (e.g., "nature", "urban", "portraits", "abstract")
- lighting: lighting characteristics (e.g., "soft", "dramatic", "natural", "studio")
- texture: surface qualities (e.g., "smooth", "grainy", "textured", "matte")
- keywords: 5-10 general search terms combining all aspects

Be specific and descriptive. Generate 2-4 tags per category.`;
}

function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function normalizeArray(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  const mapped = arr.map(normalizeTag).filter(Boolean);
  return Array.from(new Set(mapped));
}

function parseEnrichmentResponse(text: string): EnrichmentResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      mood: normalizeArray(parsed.mood || []),
      colorFamily: normalizeArray(parsed.colorFamily || []),
      era: normalizeArray(parsed.era || []),
      medium: normalizeArray(parsed.medium || []),
      subjects: normalizeArray(parsed.subjects || []),
      lighting: normalizeArray(parsed.lighting || []),
      texture: normalizeArray(parsed.texture || []),
      keywords: normalizeArray(parsed.keywords || []),
    };
  } catch (error) {
    console.error("Failed to parse enrichment response:", error);
    return null;
  }
}

export async function enrichStyleMetadata(styleId: string): Promise<boolean> {
  try {
    await storage.updateStyleEnrichmentStatus(styleId, "processing");
    
    const style = await storage.getStyleById(styleId);
    if (!style) {
      console.error(`Style ${styleId} not found for enrichment`);
      await storage.updateStyleEnrichmentStatus(styleId, "failed");
      return false;
    }
    
    const prompt = buildEnrichmentPrompt(style);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    const responseText = response.text || "";
    const enrichmentResult = parseEnrichmentResponse(responseText);
    
    if (!enrichmentResult) {
      console.error(`Failed to parse enrichment for style ${styleId}`);
      await storage.updateStyleEnrichmentStatus(styleId, "failed");
      return false;
    }
    
    const updatedTags: MetadataTags = {
      ...enrichmentResult,
      version: 1,
      lastAnalyzedAt: new Date().toISOString(),
    };
    
    await storage.updateStyleMetadata(styleId, updatedTags, "complete");
    console.log(`Successfully enriched metadata for style ${styleId}`);
    return true;
  } catch (error) {
    console.error(`Error enriching style ${styleId}:`, error);
    await storage.updateStyleEnrichmentStatus(styleId, "failed");
    return false;
  }
}

export async function queueStyleForEnrichment(styleId: string): Promise<void> {
  await storage.updateStyleEnrichmentStatus(styleId, "queued");
  
  setTimeout(() => {
    enrichStyleMetadata(styleId).catch(console.error);
  }, 100);
}

interface EnrichmentProcessResult {
  styleId: string;
  success: boolean;
  error?: string;
}

export async function enrichPendingStyles(): Promise<EnrichmentProcessResult[]> {
  const pendingStyles = await storage.getStylesByEnrichmentStatus("pending");
  const queuedStyles = await storage.getStylesByEnrichmentStatus("queued");
  const failedStyles = await storage.getStylesByEnrichmentStatus("failed");
  
  const stylesToProcess = [...pendingStyles, ...queuedStyles, ...failedStyles].slice(0, 5);
  
  const results: EnrichmentProcessResult[] = [];
  for (const style of stylesToProcess) {
    try {
      const success = await enrichStyleMetadata(style.id);
      results.push({ styleId: style.id, success });
    } catch (error) {
      results.push({ 
        styleId: style.id, 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

export async function getTagsSummary(): Promise<Record<string, Record<string, number>>> {
  const styles = await storage.getStyles();
  
  const summary: Record<string, Record<string, number>> = {
    mood: {},
    colorFamily: {},
    era: {},
    medium: {},
    subjects: {},
    lighting: {},
    texture: {},
    keywords: {},
  };
  
  for (const style of styles) {
    const tags = style.metadataTags as MetadataTags | null;
    if (!tags) continue;
    
    for (const [category, categoryTags] of Object.entries(summary)) {
      const styleTags = (tags as any)[category];
      if (Array.isArray(styleTags)) {
        for (const tag of styleTags) {
          summary[category][tag] = (summary[category][tag] || 0) + 1;
        }
      }
    }
  }
  
  return summary;
}
