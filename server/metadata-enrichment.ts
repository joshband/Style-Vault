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
  // Core visual characteristics
  mood: string[];
  colorFamily: string[];
  lighting: string[];
  texture: string[];
  
  // Art historical context
  era: string[];
  artPeriod: string[];
  historicalInfluences: string[];
  similarArtists: string[];
  
  // Technical aspects
  medium: string[];
  subjects: string[];
  
  // Application guidance
  usageExamples: string[];
  
  // Search keywords
  keywords: string[];
}

function buildEnrichmentPrompt(style: Style): string {
  const tokensPreview = JSON.stringify(style.tokens, null, 2).slice(0, 2000);
  
  return `You are an art historian and design expert. Analyze this visual style and generate rich descriptive metadata for discovery and classification.

Style Name: ${style.name}
Description: ${style.description}

Design Tokens (excerpt):
${tokensPreview}

Generate tags in these categories. Use lowercase, hyphenated keywords where appropriate.

Respond with ONLY valid JSON in this exact format:
{
  "mood": ["tag1", "tag2", "tag3"],
  "colorFamily": ["tag1", "tag2"],
  "lighting": ["tag1", "tag2"],
  "texture": ["tag1", "tag2"],
  "era": ["tag1", "tag2"],
  "artPeriod": ["tag1", "tag2"],
  "historicalInfluences": ["influence1", "influence2"],
  "similarArtists": ["artist1", "artist2"],
  "medium": ["tag1", "tag2"],
  "subjects": ["tag1", "tag2"],
  "usageExamples": ["example1", "example2", "example3"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Guidelines:
- mood: emotional qualities (e.g., "serene", "melancholic", "energetic", "nostalgic", "whimsical", "dramatic")
- colorFamily: color palettes (e.g., "earth-tones", "pastels", "monochrome", "jewel-tones", "muted", "high-contrast")
- lighting: lighting characteristics (e.g., "soft-diffused", "dramatic-chiaroscuro", "golden-hour", "flat", "rim-lit")
- texture: surface qualities (e.g., "smooth", "grainy", "impasto", "organic", "geometric")
- era: time period (e.g., "1920s", "1970s", "contemporary", "ancient", "medieval", "renaissance")
- artPeriod: art movement or period (e.g., "art-deco", "art-nouveau", "impressionism", "bauhaus", "pop-art", "minimalism")
- historicalInfluences: art movements, cultural movements, or design schools that influenced this style (e.g., "japanese-woodblock", "bauhaus-school", "memphis-design", "swiss-style")
- similarArtists: artists or designers with comparable aesthetics (e.g., "monet", "warhol", "mucha", "saul-bass", "yayoi-kusama")
- medium: artistic medium feel (e.g., "oil-painting", "watercolor", "photography", "digital-illustration", "collage")
- subjects: common subject matter (e.g., "landscapes", "portraits", "still-life", "abstract", "architectural")
- usageExamples: practical applications (e.g., "album-covers", "book-illustrations", "brand-identity", "editorial", "packaging", "web-design", "fashion-photography")
- keywords: 5-10 general search terms combining all aspects

Be specific, knowledgeable, and descriptive. Generate 2-5 tags per category.`;
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
      // Core visual characteristics
      mood: normalizeArray(parsed.mood || []),
      colorFamily: normalizeArray(parsed.colorFamily || []),
      lighting: normalizeArray(parsed.lighting || []),
      texture: normalizeArray(parsed.texture || []),
      
      // Art historical context
      era: normalizeArray(parsed.era || []),
      artPeriod: normalizeArray(parsed.artPeriod || []),
      historicalInfluences: normalizeArray(parsed.historicalInfluences || []),
      similarArtists: normalizeArray(parsed.similarArtists || []),
      
      // Technical aspects
      medium: normalizeArray(parsed.medium || []),
      subjects: normalizeArray(parsed.subjects || []),
      
      // Application guidance
      usageExamples: normalizeArray(parsed.usageExamples || []),
      
      // Search keywords
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
    // Core visual characteristics
    mood: {},
    colorFamily: {},
    lighting: {},
    texture: {},
    
    // Art historical context
    era: {},
    artPeriod: {},
    historicalInfluences: {},
    similarArtists: {},
    
    // Technical aspects
    medium: {},
    subjects: {},
    
    // Application guidance
    usageExamples: {},
    
    // Search keywords
    keywords: {},
  };
  
  for (const style of styles) {
    const tags = style.metadataTags as Partial<MetadataTags> | null;
    if (!tags) continue;
    
    for (const category of Object.keys(summary)) {
      const styleTags = (tags as Record<string, unknown>)[category];
      if (Array.isArray(styleTags)) {
        for (const tag of styleTags) {
          if (typeof tag === "string" && tag.length > 0) {
            summary[category][tag] = (summary[category][tag] || 0) + 1;
          }
        }
      }
    }
  }
  
  return summary;
}
