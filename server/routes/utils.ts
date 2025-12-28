import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { MetadataTags } from "@shared/schema";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function getDefaultMetadataTags(): MetadataTags {
  return {
    mood: [],
    colorFamily: [],
    lighting: [],
    texture: [],
    era: [],
    artPeriod: [],
    historicalInfluences: [],
    similarArtists: [],
    medium: [],
    subjects: [],
    usageExamples: [],
    narrativeTone: [],
    sensoryPalette: [],
    movementRhythm: [],
    stylisticPrinciples: [],
    signatureMotifs: [],
    contrastDynamics: [],
    psychologicalEffect: [],
    culturalResonance: [],
    audiencePerception: [],
    keywords: [],
  };
}

export const DEFAULT_TOKENS = {
  "color": {
    "primary": { "$type": "color", "$value": "#2A2A2A", "$description": "Primary color" },
    "secondary": { "$type": "color", "$value": "#6B5B4D", "$description": "Secondary color" },
    "accent": { "$type": "color", "$value": "#FF4D4D", "$description": "Accent color" },
    "background": { "$type": "color", "$value": "#F5F5F5", "$description": "Background color" },
    "surface": { "$type": "color", "$value": "#FFFFFF", "$description": "Surface color" },
  },
  "typography": {
    "fontFamily": {
      "serif": { "$type": "fontFamily", "$value": "Lora, Georgia, serif", "$description": "Serif font" },
      "sans": { "$type": "fontFamily", "$value": "Inter, sans-serif", "$description": "Sans font" },
    },
  },
  "spacing": {
    "base": { "$type": "dimension", "$value": "16px", "$description": "Base spacing unit" },
  },
};
