/**
 * Font Recommendation Engine
 * 
 * Scores fonts against inferred typography intent and returns ranked matches.
 */

import type { TypographyIntent } from './typographyIntent';
import type { FontMetadata } from './fontCatalog';
import { FONT_CATALOG } from './fontCatalog';

export interface FontRecommendation {
  family: string;
  score: number;
  category: FontMetadata['category'];
  googleFontsUrl: string;
  reasoning: string;
}

export interface RecommendationResult {
  recommendations: FontRecommendation[];
  totalCandidates: number;
}

/**
 * Dimension weights for scoring
 * Higher weights = more influence on final score
 */
const DIMENSION_WEIGHTS = {
  serifness: 2.0,      // Primary classifier
  weightBias: 1.0,
  widthBias: 0.8,
  formality: 1.2,
  humanist: 0.9,
  decorative: 0.7,
  legibility: 1.1,
  era: 1.3,            // Era match bonus
};

/**
 * Score fonts against intent and return top recommendations
 */
export function recommendFonts(
  intent: TypographyIntent,
  options: {
    maxResults?: number;
    minScore?: number;
    preferCategory?: FontMetadata['category'];
  } = {}
): RecommendationResult {
  const { maxResults = 3, minScore = 0.3, preferCategory } = options;
  
  let candidates = [...FONT_CATALOG];
  
  // Optional category preference filter
  if (preferCategory) {
    const categoryFonts = candidates.filter(f => f.category === preferCategory);
    if (categoryFonts.length >= maxResults) {
      candidates = categoryFonts;
    }
  }
  
  // Score each font
  const scored: { font: FontMetadata; score: number; reasoning: string }[] = candidates.map(font => {
    const { score, reasoning } = scoreFont(font, intent);
    return { font, score, reasoning };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Filter by minimum score and limit results
  const filtered = scored
    .filter(s => s.score >= minScore)
    .slice(0, maxResults);
  
  return {
    recommendations: filtered.map(({ font, score, reasoning }) => ({
      family: font.family,
      score: Math.round(score * 100) / 100,
      category: font.category,
      googleFontsUrl: font.googleFontsUrl,
      reasoning,
    })),
    totalCandidates: candidates.length,
  };
}

/**
 * Score a single font against the intent
 */
function scoreFont(font: FontMetadata, intent: TypographyIntent): { score: number; reasoning: string } {
  let totalScore = 0;
  let totalWeight = 0;
  const factors: string[] = [];
  
  // Serifness match (most important)
  const serifDiff = Math.abs(font.serifness - intent.serifness);
  const serifScore = 1 - serifDiff;
  totalScore += serifScore * DIMENSION_WEIGHTS.serifness;
  totalWeight += DIMENSION_WEIGHTS.serifness;
  
  if (serifScore > 0.8) {
    factors.push(intent.serifness > 0.5 ? 'serif style matches' : 'sans-serif style matches');
  }
  
  // Weight bias match
  const weightDiff = Math.abs(font.weightBias - intent.weightBias);
  const weightScore = 1 - weightDiff;
  totalScore += weightScore * DIMENSION_WEIGHTS.weightBias;
  totalWeight += DIMENSION_WEIGHTS.weightBias;
  
  if (weightScore > 0.7) {
    factors.push('weight impression aligns');
  }
  
  // Width bias match
  const widthDiff = Math.abs(font.widthBias - intent.widthBias);
  const widthScore = 1 - widthDiff;
  totalScore += widthScore * DIMENSION_WEIGHTS.widthBias;
  totalWeight += DIMENSION_WEIGHTS.widthBias;
  
  // Formality match
  const formalDiff = Math.abs(font.formality - intent.formality);
  const formalScore = 1 - formalDiff;
  totalScore += formalScore * DIMENSION_WEIGHTS.formality;
  totalWeight += DIMENSION_WEIGHTS.formality;
  
  if (formalScore > 0.7) {
    factors.push(intent.formality > 0.6 ? 'formal tone matches' : 'casual tone matches');
  }
  
  // Humanist quality match
  const humanDiff = Math.abs(font.humanist - intent.humanist);
  const humanScore = 1 - humanDiff;
  totalScore += humanScore * DIMENSION_WEIGHTS.humanist;
  totalWeight += DIMENSION_WEIGHTS.humanist;
  
  // Decorative match
  const decorDiff = Math.abs(font.decorative - intent.decorative);
  const decorScore = 1 - decorDiff;
  totalScore += decorScore * DIMENSION_WEIGHTS.decorative;
  totalWeight += DIMENSION_WEIGHTS.decorative;
  
  // Legibility consideration
  const legibScore = font.legibility * intent.legibility + (1 - font.legibility) * (1 - intent.legibility);
  totalScore += legibScore * DIMENSION_WEIGHTS.legibility;
  totalWeight += DIMENSION_WEIGHTS.legibility;
  
  if (legibScore > 0.7 && intent.legibility > 0.6) {
    factors.push('optimized for readability');
  }
  
  // Era match bonus
  const eraScore = intent.eraBias === 'neutral' 
    ? 0.5 
    : (font.eraScores[intent.eraBias] ?? 0.5);
  totalScore += eraScore * DIMENSION_WEIGHTS.era;
  totalWeight += DIMENSION_WEIGHTS.era;
  
  if (eraScore > 0.7) {
    factors.push(`${intent.eraBias} era aesthetic`);
  }
  
  const finalScore = totalScore / totalWeight;
  
  // Generate reasoning
  let reasoning: string;
  if (factors.length === 0) {
    reasoning = `General visual compatibility (${Math.round(finalScore * 100)}% match)`;
  } else if (factors.length === 1) {
    reasoning = factors[0];
  } else {
    reasoning = `${factors.slice(0, 2).join(', ')}`;
    if (factors.length > 2) {
      reasoning += `, +${factors.length - 2} more`;
    }
  }
  
  return { score: finalScore, reasoning };
}

/**
 * Get font pairing suggestions (heading + body)
 */
export function recommendFontPairing(intent: TypographyIntent): {
  heading: FontRecommendation;
  body: FontRecommendation;
} {
  // For headings: favor lower legibility (more display-oriented)
  const headingIntent: TypographyIntent = {
    ...intent,
    legibility: Math.max(0, intent.legibility - 0.2),
    decorative: Math.min(1, intent.decorative + 0.1),
  };
  
  // For body: favor higher legibility
  const bodyIntent: TypographyIntent = {
    ...intent,
    legibility: Math.min(1, intent.legibility + 0.2),
    decorative: Math.max(0, intent.decorative - 0.15),
  };
  
  const headingRecs = recommendFonts(headingIntent, { maxResults: 5 });
  const bodyRecs = recommendFonts(bodyIntent, { maxResults: 5 });
  
  // Find a good pairing (different fonts when possible)
  const heading = headingRecs.recommendations[0];
  let body = bodyRecs.recommendations.find(r => r.family !== heading.family);
  
  if (!body) {
    body = bodyRecs.recommendations[0];
  }
  
  return { heading, body };
}
