import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import type { Style, MetadataTags } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface ProjectAnalysis {
  domain: string;
  subDomain?: string;
  targetAudience: string;
  mood: string[];
  keywords: string[];
  uiDensity: "minimal" | "moderate" | "dense";
  colorTemperature: "warm" | "cool" | "neutral" | "mixed";
  formality: "professional" | "casual" | "playful" | "serious";
  aestheticStyle: string;
  platformType: string;
  summary: string;
}

export interface TokenSuggestions {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    scale: number;
    weight: "light" | "regular" | "medium" | "bold";
  };
  spacing: {
    baseUnit: number;
    density: "compact" | "comfortable" | "spacious";
  };
  effects: {
    borderRadius: string;
    shadowStyle: "none" | "subtle" | "medium" | "dramatic";
    materialHint: string;
  };
  motion: {
    speed: "instant" | "quick" | "moderate" | "slow";
    style: "snappy" | "smooth" | "elastic" | "drifting";
  };
}

export interface StyleMatch {
  styleId: string;
  styleName: string;
  relevanceScore: number;
  matchReasons: string[];
  thumbnailUrl?: string;
}

export interface ConsultantRecommendation {
  analysis: ProjectAnalysis;
  tokenSuggestions: TokenSuggestions;
  matchingStyles: StyleMatch[];
  promptScaffolding: {
    base: string;
    modifiers: string[];
    negative: string;
  };
  rationale: string;
}

export async function analyzeProjectDescription(description: string): Promise<ConsultantRecommendation> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a design consultant analyzing a project description to recommend visual styles and design tokens.

Analyze this project description and extract design requirements:

---
${description}
---

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "analysis": {
    "domain": "Primary industry/domain (e.g., 'Audio Software', 'Healthcare', 'E-commerce', 'Gaming')",
    "subDomain": "Optional sub-domain (e.g., 'Music Production', 'Patient Management')",
    "targetAudience": "Primary audience (e.g., 'Professional musicians', 'Enterprise users', 'Gen Z consumers')",
    "mood": ["3-5 mood keywords like: minimal, dramatic, playful, cinematic, elegant, bold, serene, edgy"],
    "keywords": ["5-8 design-relevant keywords extracted from the description"],
    "uiDensity": "minimal|moderate|dense based on described UI philosophy",
    "colorTemperature": "warm|cool|neutral|mixed based on implied aesthetic",
    "formality": "professional|casual|playful|serious",
    "aestheticStyle": "One-phrase description like 'Dark cinematic minimalism' or 'Vibrant tech optimism'",
    "platformType": "Type of app/product (e.g., 'Desktop plugin', 'Web dashboard', 'Mobile app')",
    "summary": "2-3 sentence summary of the design direction"
  },
  "tokenSuggestions": {
    "colors": {
      "primary": "#hexcolor - main brand/action color",
      "secondary": "#hexcolor - secondary color",
      "accent": "#hexcolor - highlight/accent",
      "background": "#hexcolor - main background",
      "surface": "#hexcolor - card/panel surfaces",
      "text": "#hexcolor - primary text color"
    },
    "typography": {
      "headingFont": "Font family name for headings",
      "bodyFont": "Font family name for body text",
      "scale": 1.2,
      "weight": "light|regular|medium|bold"
    },
    "spacing": {
      "baseUnit": 8,
      "density": "compact|comfortable|spacious"
    },
    "effects": {
      "borderRadius": "0px|4px|8px|12px|16px|24px|full",
      "shadowStyle": "none|subtle|medium|dramatic",
      "materialHint": "Material/texture description like 'matte aluminum', 'frosted glass', 'soft plastic'"
    },
    "motion": {
      "speed": "instant|quick|moderate|slow",
      "style": "snappy|smooth|elastic|drifting"
    }
  },
  "promptScaffolding": {
    "base": "A detailed base prompt (50-80 words) that would generate images matching this aesthetic. Include visual descriptors, lighting, atmosphere, and style.",
    "modifiers": ["4-6 style modifiers like 'cinematic lighting', 'muted tones', 'high contrast'"],
    "negative": "Negative prompt describing what to avoid (e.g., 'cluttered, busy, bright neon colors, cartoon style')"
  },
  "rationale": "2-3 sentences explaining why these recommendations fit the project requirements"
}

Be specific with color hex codes. Choose colors that match the mood and domain.
For audio/music software with dark themes: use deep blacks (#0a0a0a to #1a1a1a), muted accents, subtle highlights.
For enterprise apps: use professional blues, clean whites, subtle grays.
For creative tools: balance expressiveness with usability.`,
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
      responseText = (parts[0] as { text?: string })?.text || "";
    }
  }

  const cleanedJson = responseText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const parsed = JSON.parse(cleanedJson);

  const matchingStyles = await findMatchingStyles(parsed.analysis);

  return {
    analysis: parsed.analysis,
    tokenSuggestions: parsed.tokenSuggestions,
    matchingStyles,
    promptScaffolding: parsed.promptScaffolding,
    rationale: parsed.rationale,
  };
}

async function findMatchingStyles(analysis: ProjectAnalysis): Promise<StyleMatch[]> {
  const allStyles = await storage.getStyles();
  const publicStyles = allStyles.filter((s) => s.isPublic);

  const matches: StyleMatch[] = [];

  for (const style of publicStyles) {
    const metadata = style.metadataTags as MetadataTags | null;
    if (!metadata) continue;

    let score = 0;
    const reasons: string[] = [];

    const styleMoods = metadata.mood || [];
    const styleKeywords = metadata.keywords || [];
    const allStyleTerms = [
      ...styleMoods.map((m) => m.toLowerCase()),
      ...styleKeywords.map((k) => k.toLowerCase()),
    ];

    for (const mood of analysis.mood) {
      if (allStyleTerms.some((term) => term.includes(mood.toLowerCase()) || mood.toLowerCase().includes(term))) {
        score += 20;
        reasons.push(`Matches mood: ${mood}`);
      }
    }

    for (const keyword of analysis.keywords) {
      if (allStyleTerms.some((term) => term.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(term))) {
        score += 10;
        reasons.push(`Matches keyword: ${keyword}`);
      }
    }

    const styleLighting = metadata.lighting || [];
    const styleTexture = metadata.texture || [];
    const styleColorFamily = metadata.colorFamily || [];

    if (analysis.colorTemperature === "cool" && styleColorFamily.some((c) => c.toLowerCase().includes("cool"))) {
      score += 15;
      reasons.push("Cool color temperature match");
    }
    if (analysis.colorTemperature === "warm" && styleColorFamily.some((c) => c.toLowerCase().includes("warm"))) {
      score += 15;
      reasons.push("Warm color temperature match");
    }

    if (analysis.mood.includes("dramatic") && styleLighting.some((l) => l.toLowerCase().includes("dramatic"))) {
      score += 15;
      reasons.push("Dramatic lighting match");
    }
    if (analysis.mood.includes("minimal") && styleLighting.some((l) => l.toLowerCase().includes("soft") || l.toLowerCase().includes("natural"))) {
      score += 10;
      reasons.push("Minimal/soft lighting match");
    }

    if (score > 20 && reasons.length > 0) {
      const previews = style.previews as { portrait?: string } | null;
      matches.push({
        styleId: style.id,
        styleName: style.name,
        relevanceScore: Math.min(score, 100),
        matchReasons: reasons.slice(0, 3),
        thumbnailUrl: previews?.portrait,
      });
    }
  }

  matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return matches.slice(0, 5);
}

export function convertRecommendationToTokens(suggestion: TokenSuggestions): Record<string, any> {
  return {
    color: {
      primary: { $type: "color", $value: suggestion.colors.primary, $description: "Primary brand color" },
      secondary: { $type: "color", $value: suggestion.colors.secondary, $description: "Secondary color" },
      accent: { $type: "color", $value: suggestion.colors.accent, $description: "Accent/highlight color" },
      background: { $type: "color", $value: suggestion.colors.background, $description: "Main background" },
      surface: { $type: "color", $value: suggestion.colors.surface, $description: "Surface/card color" },
      text: { $type: "color", $value: suggestion.colors.text, $description: "Primary text color" },
    },
    typography: {
      fontFamily: {
        heading: { $type: "fontFamily", $value: suggestion.typography.headingFont, $description: "Heading font" },
        body: { $type: "fontFamily", $value: suggestion.typography.bodyFont, $description: "Body text font" },
      },
      scale: { $type: "number", $value: suggestion.typography.scale, $description: "Type scale ratio" },
      weight: { $type: "string", $value: suggestion.typography.weight, $description: "Default font weight" },
    },
    spacing: {
      unit: { $type: "dimension", $value: `${suggestion.spacing.baseUnit}px`, $description: "Base spacing unit" },
      density: { $type: "string", $value: suggestion.spacing.density, $description: "Spacing density" },
    },
    effects: {
      borderRadius: { $type: "dimension", $value: suggestion.effects.borderRadius, $description: "Corner radius" },
      shadow: { $type: "string", $value: suggestion.effects.shadowStyle, $description: "Shadow style" },
      material: { $type: "string", $value: suggestion.effects.materialHint, $description: "Material/texture hint" },
    },
    motion: {
      speed: { $type: "string", $value: suggestion.motion.speed, $description: "Animation speed" },
      style: { $type: "string", $value: suggestion.motion.style, $description: "Motion style" },
    },
  };
}
