import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import type { Style, MetadataTags, MetadataEnrichmentStatus } from "@shared/schema";
import { getPLimit } from "./utils/esm-interop";

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
  
  // Subjective Visual DNA - Emotional Resonance
  narrativeTone: string[];
  sensoryPalette: string[];
  movementRhythm: string[];
  
  // Subjective Visual DNA - Design Voice
  stylisticPrinciples: string[];
  signatureMotifs: string[];
  contrastDynamics: string[];
  
  // Subjective Visual DNA - Experiential Impact
  psychologicalEffect: string[];
  culturalResonance: string[];
  audiencePerception: string[];
  
  // Search keywords
  keywords: string[];
}

function buildEnrichmentPrompt(style: Style): string {
  const tokensPreview = JSON.stringify(style.tokens, null, 2).slice(0, 2000);
  
  return `You are an art historian, design critic, and visual culture expert. Analyze this visual style deeply and extract its "Visual DNA" - both objective characteristics and subjective interpretive qualities.

Style Name: ${style.name}
Description: ${style.description}

Design Tokens (excerpt):
${tokensPreview}

Generate tags capturing both technical attributes and subjective essence. Use lowercase, hyphenated keywords.

Respond with ONLY valid JSON in this exact format:
{
  "mood": ["tag1", "tag2"],
  "colorFamily": ["tag1", "tag2"],
  "lighting": ["tag1", "tag2"],
  "texture": ["tag1", "tag2"],
  "era": ["tag1", "tag2"],
  "artPeriod": ["tag1", "tag2"],
  "historicalInfluences": ["influence1", "influence2"],
  "similarArtists": ["artist1", "artist2"],
  "medium": ["tag1", "tag2"],
  "subjects": ["tag1", "tag2"],
  "usageExamples": ["example1", "example2"],
  "narrativeTone": ["tag1", "tag2"],
  "sensoryPalette": ["tag1", "tag2"],
  "movementRhythm": ["tag1", "tag2"],
  "stylisticPrinciples": ["tag1", "tag2"],
  "signatureMotifs": ["tag1", "tag2"],
  "contrastDynamics": ["tag1", "tag2"],
  "psychologicalEffect": ["tag1", "tag2"],
  "culturalResonance": ["tag1", "tag2"],
  "audiencePerception": ["tag1", "tag2"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

== OBJECTIVE CHARACTERISTICS ==
- mood: emotional qualities (e.g., "serene", "melancholic", "energetic", "nostalgic", "whimsical")
- colorFamily: color palettes (e.g., "earth-tones", "pastels", "monochrome", "jewel-tones")
- lighting: lighting characteristics (e.g., "soft-diffused", "dramatic-chiaroscuro", "golden-hour")
- texture: surface qualities (e.g., "smooth", "grainy", "impasto", "organic")
- era: time period (e.g., "1920s", "1970s", "contemporary", "renaissance")
- artPeriod: art movements (e.g., "art-deco", "impressionism", "bauhaus", "minimalism")
- historicalInfluences: design schools/movements (e.g., "japanese-woodblock", "swiss-style", "memphis-design")
- similarArtists: artists with comparable aesthetics (e.g., "monet", "warhol", "saul-bass")
- medium: artistic medium (e.g., "oil-painting", "watercolor", "photography", "digital-illustration")
- subjects: subject matter (e.g., "landscapes", "portraits", "abstract", "architectural")
- usageExamples: applications (e.g., "album-covers", "brand-identity", "web-design", "editorial")

== SUBJECTIVE VISUAL DNA ==

Emotional Resonance:
- narrativeTone: storytelling voice (e.g., "poetic-dreamlike", "documentary-raw", "mythological", "intimate-confessional", "epic-sweeping")
- sensoryPalette: cross-sensory associations (e.g., "velvet-touch", "citrus-bright", "autumn-smoke", "ocean-depths", "sun-warmed")
- movementRhythm: visual tempo/flow (e.g., "flowing-organic", "staccato-sharp", "meditative-slow", "dynamic-explosive", "undulating")

Design Voice:
- stylisticPrinciples: core design philosophy (e.g., "form-follows-function", "maximalist-abundance", "wabi-sabi-imperfection", "geometric-precision")
- signatureMotifs: recurring visual elements (e.g., "curved-lines", "negative-space", "layered-transparency", "bold-typography", "natural-forms")
- contrastDynamics: tension/harmony (e.g., "high-drama", "subtle-gradients", "harsh-juxtaposition", "harmonious-blend", "push-pull")

Experiential Impact:
- psychologicalEffect: viewer response (e.g., "calming-meditative", "energizing-stimulating", "thought-provoking", "comfort-nostalgia", "awe-inspiring")
- culturalResonance: cultural connections (e.g., "japanese-zen", "scandinavian-hygge", "american-midcentury", "mediterranean-warmth", "african-diaspora")
- audiencePerception: who responds (e.g., "design-professionals", "mass-market-appeal", "avant-garde-collectors", "youthful-trendy", "sophisticated-mature")

- keywords: 5-10 general search terms

Be interpretive, evocative, and specific. Generate 2-4 tags per category.`;
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
      
      // Subjective Visual DNA - Emotional Resonance
      narrativeTone: normalizeArray(parsed.narrativeTone || []),
      sensoryPalette: normalizeArray(parsed.sensoryPalette || []),
      movementRhythm: normalizeArray(parsed.movementRhythm || []),
      
      // Subjective Visual DNA - Design Voice
      stylisticPrinciples: normalizeArray(parsed.stylisticPrinciples || []),
      signatureMotifs: normalizeArray(parsed.signatureMotifs || []),
      contrastDynamics: normalizeArray(parsed.contrastDynamics || []),
      
      // Subjective Visual DNA - Experiential Impact
      psychologicalEffect: normalizeArray(parsed.psychologicalEffect || []),
      culturalResonance: normalizeArray(parsed.culturalResonance || []),
      audiencePerception: normalizeArray(parsed.audiencePerception || []),
      
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
  
  // Process up to 3 styles in parallel for faster batch enrichment
  const limit = await getPLimit(3);
  
  const results = await Promise.all(
    stylesToProcess.map(style =>
      limit(async (): Promise<EnrichmentProcessResult> => {
        try {
          const success = await enrichStyleMetadata(style.id);
          return { styleId: style.id, success };
        } catch (error) {
          return { 
            styleId: style.id, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          };
        }
      })
    )
  );
  
  return results;
}

interface StyleSpecContent {
  usageGuidelines: string;
  designNotes: string;
}

function buildStyleSpecPrompt(style: Style): string {
  const tokensPreview = JSON.stringify(style.tokens, null, 2).slice(0, 2000);
  const metadataTags = style.metadataTags as Partial<MetadataTags> | null;
  
  return `You are a senior design director writing documentation for a visual style system. Based on the style's characteristics, write clear, practical guidance for designers and developers.

Style Name: ${style.name}
Description: ${style.description}

Design Tokens (excerpt):
${tokensPreview}

${metadataTags ? `Metadata Tags:
- Mood: ${(metadataTags.mood || []).join(", ") || "N/A"}
- Color Family: ${(metadataTags.colorFamily || []).join(", ") || "N/A"}
- Lighting: ${(metadataTags.lighting || []).join(", ") || "N/A"}
- Art Period: ${(metadataTags.artPeriod || []).join(", ") || "N/A"}
- Usage Examples: ${(metadataTags.usageExamples || []).join(", ") || "N/A"}
- Stylistic Principles: ${(metadataTags.stylisticPrinciples || []).join(", ") || "N/A"}
- Psychological Effect: ${(metadataTags.psychologicalEffect || []).join(", ") || "N/A"}
- Audience Perception: ${(metadataTags.audiencePerception || []).join(", ") || "N/A"}` : ""}

Generate two pieces of content:

1. USAGE GUIDELINES (2-3 sentences): When and how to use this style. Be specific about contexts, project types, and appropriate use cases. Start directly with the content, no header.

2. DESIGN NOTES (3-5 sentences): Technical observations about the color palette, typography suggestions, and implementation tips. Include specific recommendations for pairing with other elements. Start directly with the content, no header.

Respond with ONLY valid JSON:
{
  "usageGuidelines": "Your usage guidelines text here...",
  "designNotes": "Your design notes text here..."
}`;
}

export async function generateStyleSpecContent(styleId: string): Promise<StyleSpecContent | null> {
  const style = await storage.getStyleById(styleId);
  if (!style) {
    console.log(`Style ${styleId} not found for spec generation`);
    return null;
  }

  const prompt = buildStyleSpecPrompt(style);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim() || "";
    
    let parsed: StyleSpecContent | null = null;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]) as StyleSpecContent;
      } catch {
        console.error("Failed to parse JSON from style spec response");
      }
    }
    
    if (!parsed) {
      const guidelinesMatch = text.match(/usage\s*guidelines[:\s]*["']?([\s\S]*?)(?=design\s*notes|$)/i);
      const notesMatch = text.match(/design\s*notes[:\s]*["']?([\s\S]*?)$/i);
      
      const extractedGuidelines = guidelinesMatch?.[1]?.replace(/["']/g, "").trim() || "";
      const extractedNotes = notesMatch?.[1]?.replace(/["']/g, "").trim() || "";
      
      if (extractedGuidelines.length > 20 || extractedNotes.length > 20) {
        parsed = {
          usageGuidelines: extractedGuidelines,
          designNotes: extractedNotes,
        };
        console.log(`Fallback parsing extracted: guidelines=${extractedGuidelines.length} chars, notes=${extractedNotes.length} chars`);
      }
    }
    
    if (!parsed) {
      console.error("Failed to extract JSON from style spec response");
      return null;
    }
    
    const validSpec: StyleSpecContent = {
      usageGuidelines: typeof parsed.usageGuidelines === "string" ? parsed.usageGuidelines : "",
      designNotes: typeof parsed.designNotes === "string" ? parsed.designNotes : "",
    };
    
    if (validSpec.usageGuidelines.length < 20 && validSpec.designNotes.length < 20) {
      console.error("Style spec content too short, treating as failure");
      return null;
    }

    return validSpec;
  } catch (error) {
    console.error(`Error generating style spec for ${styleId}:`, error);
    return null;
  }
}

export async function enrichStyleSpec(styleId: string): Promise<boolean> {
  const style = await storage.getStyleById(styleId);
  if (!style) return false;

  const specContent = await generateStyleSpecContent(styleId);
  if (!specContent) return false;

  const updatedSpec = {
    usageGuidelines: specContent.usageGuidelines,
    designNotes: specContent.designNotes,
    updatedAt: new Date().toISOString(),
  };

  await storage.updateStyleSpec(styleId, updatedSpec);
  console.log(`Generated style spec for: ${style.name}`);
  return true;
}

export async function enrichAllStyleSpecs(): Promise<{ processed: number; success: number; errors: string[] }> {
  const styles = await storage.getStyles();
  
  const stylesWithoutSpec = styles.filter(s => {
    const spec = s.styleSpec as { usageGuidelines?: string; designNotes?: string } | null;
    return !spec?.usageGuidelines || !spec?.designNotes;
  });

  console.log(`Found ${stylesWithoutSpec.length} styles needing spec generation`);
  
  const limit = await getPLimit(2);
  const errors: string[] = [];
  let success = 0;

  await Promise.all(
    stylesWithoutSpec.map(style =>
      limit(async () => {
        try {
          const result = await enrichStyleSpec(style.id);
          if (result) success++;
        } catch (error) {
          const errMsg = `${style.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
          errors.push(errMsg);
        }
      })
    )
  );

  return { processed: stylesWithoutSpec.length, success, errors };
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
    
    // Subjective Visual DNA - Emotional Resonance
    narrativeTone: {},
    sensoryPalette: {},
    movementRhythm: {},
    
    // Subjective Visual DNA - Design Voice
    stylisticPrinciples: {},
    signatureMotifs: {},
    contrastDynamics: {},
    
    // Subjective Visual DNA - Experiential Impact
    psychologicalEffect: {},
    culturalResonance: {},
    audiencePerception: {},
    
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
