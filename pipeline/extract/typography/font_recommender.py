"""
Font Recommendation Engine

Scores fonts against inferred typography intent and returns ranked matches.

Mirrors the functionality in server/typography/recommendFonts.ts
but implemented in Python for pipeline integration.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass

from .typography_intent import TypographyIntent
from .font_catalog import FontMetadata, FONT_CATALOG, FontCategory


# Dimension weights for scoring
DIMENSION_WEIGHTS = {
    'serifness': 2.0,      # Primary classifier
    'weight_bias': 1.0,
    'width_bias': 0.8,
    'formality': 1.2,
    'humanist': 0.9,
    'decorative': 0.7,
    'legibility': 1.1,
    'era': 1.3,            # Era match bonus
}


@dataclass
class FontRecommendation:
    """A single font recommendation."""
    family: str
    score: float
    category: str
    google_fonts_url: str
    reasoning: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "family": self.family,
            "score": self.score,
            "category": self.category,
            "googleFontsUrl": self.google_fonts_url,
            "reasoning": self.reasoning,
        }


@dataclass
class FontPairing:
    """Heading and body font pairing."""
    heading: FontRecommendation
    body: FontRecommendation
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "heading": self.heading.to_dict(),
            "body": self.body.to_dict(),
        }


@dataclass
class RecommendationResult:
    """Result of font recommendation."""
    recommendations: List[FontRecommendation]
    total_candidates: int
    pairing: Optional[FontPairing] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "recommendations": [r.to_dict() for r in self.recommendations],
            "totalCandidates": self.total_candidates,
        }
        if self.pairing:
            result["pairing"] = self.pairing.to_dict()
        return result


def score_font(font: FontMetadata, intent: TypographyIntent) -> tuple:
    """
    Score a single font against the intent.
    Returns (score, reasoning).
    """
    total_score = 0.0
    total_weight = 0.0
    factors: List[str] = []
    
    # Serifness match (most important)
    serif_diff = abs(font.serifness - intent.serifness)
    serif_score = 1 - serif_diff
    total_score += serif_score * DIMENSION_WEIGHTS['serifness']
    total_weight += DIMENSION_WEIGHTS['serifness']
    
    if serif_score > 0.8:
        factors.append('serif style matches' if intent.serifness > 0.5 else 'sans-serif style matches')
    
    # Weight bias match
    weight_diff = abs(font.weight_bias - intent.weight_bias)
    weight_score = 1 - weight_diff
    total_score += weight_score * DIMENSION_WEIGHTS['weight_bias']
    total_weight += DIMENSION_WEIGHTS['weight_bias']
    
    if weight_score > 0.7:
        factors.append('weight impression aligns')
    
    # Width bias match
    width_diff = abs(font.width_bias - intent.width_bias)
    width_score = 1 - width_diff
    total_score += width_score * DIMENSION_WEIGHTS['width_bias']
    total_weight += DIMENSION_WEIGHTS['width_bias']
    
    # Formality match
    formal_diff = abs(font.formality - intent.formality)
    formal_score = 1 - formal_diff
    total_score += formal_score * DIMENSION_WEIGHTS['formality']
    total_weight += DIMENSION_WEIGHTS['formality']
    
    if formal_score > 0.7:
        factors.append('formal tone matches' if intent.formality > 0.6 else 'casual tone matches')
    
    # Humanist quality match
    human_diff = abs(font.humanist - intent.humanist)
    human_score = 1 - human_diff
    total_score += human_score * DIMENSION_WEIGHTS['humanist']
    total_weight += DIMENSION_WEIGHTS['humanist']
    
    # Decorative match
    decor_diff = abs(font.decorative - intent.decorative)
    decor_score = 1 - decor_diff
    total_score += decor_score * DIMENSION_WEIGHTS['decorative']
    total_weight += DIMENSION_WEIGHTS['decorative']
    
    # Legibility consideration
    legib_score = font.legibility * intent.legibility + (1 - font.legibility) * (1 - intent.legibility)
    total_score += legib_score * DIMENSION_WEIGHTS['legibility']
    total_weight += DIMENSION_WEIGHTS['legibility']
    
    if legib_score > 0.7 and intent.legibility > 0.6:
        factors.append('optimized for readability')
    
    # Era match bonus
    if intent.era_bias == 'neutral':
        era_score = 0.5
    else:
        era_score = font.era_scores.get(intent.era_bias, 0.5)
    total_score += era_score * DIMENSION_WEIGHTS['era']
    total_weight += DIMENSION_WEIGHTS['era']
    
    if era_score > 0.7:
        factors.append(f'{intent.era_bias} era aesthetic')
    
    final_score = total_score / total_weight
    
    # Generate reasoning
    if not factors:
        reasoning = f'General visual compatibility ({int(final_score * 100)}% match)'
    elif len(factors) == 1:
        reasoning = factors[0]
    else:
        reasoning = ', '.join(factors[:2])
        if len(factors) > 2:
            reasoning += f', +{len(factors) - 2} more'
    
    return final_score, reasoning


def recommend_fonts(
    intent: TypographyIntent,
    max_results: int = 3,
    min_score: float = 0.3,
    prefer_category: Optional[FontCategory] = None,
) -> RecommendationResult:
    """
    Score fonts against intent and return top recommendations.
    
    Args:
        intent: Typography intent to match against
        max_results: Maximum number of recommendations
        min_score: Minimum score threshold
        prefer_category: Optional category preference
    
    Returns:
        RecommendationResult with ranked fonts
    """
    candidates = list(FONT_CATALOG)
    
    # Optional category preference filter
    if prefer_category:
        category_fonts = [f for f in candidates if f.category == prefer_category]
        if len(category_fonts) >= max_results:
            candidates = category_fonts
    
    # Score each font
    scored = []
    for font in candidates:
        score, reasoning = score_font(font, intent)
        scored.append((font, score, reasoning))
    
    # Sort by score descending
    scored.sort(key=lambda x: x[1], reverse=True)
    
    # Filter by minimum score and limit results
    filtered = [
        (font, score, reasoning)
        for font, score, reasoning in scored
        if score >= min_score
    ][:max_results]
    
    recommendations = [
        FontRecommendation(
            family=font.family,
            score=round(score, 2),
            category=font.category,
            google_fonts_url=font.google_fonts_url,
            reasoning=reasoning,
        )
        for font, score, reasoning in filtered
    ]
    
    return RecommendationResult(
        recommendations=recommendations,
        total_candidates=len(candidates),
    )


def recommend_font_pairing(intent: TypographyIntent) -> FontPairing:
    """
    Get font pairing suggestions (heading + body).
    
    Args:
        intent: Base typography intent
    
    Returns:
        FontPairing with heading and body recommendations
    """
    # For headings: favor lower legibility (more display-oriented)
    heading_intent = TypographyIntent(
        serifness=intent.serifness,
        weight_bias=intent.weight_bias,
        width_bias=intent.width_bias,
        formality=intent.formality,
        era_bias=intent.era_bias,
        humanist=intent.humanist,
        decorative=min(1.0, intent.decorative + 0.1),
        legibility=max(0.0, intent.legibility - 0.2),
    )
    
    # For body: favor higher legibility
    body_intent = TypographyIntent(
        serifness=intent.serifness,
        weight_bias=intent.weight_bias,
        width_bias=intent.width_bias,
        formality=intent.formality,
        era_bias=intent.era_bias,
        humanist=intent.humanist,
        decorative=max(0.0, intent.decorative - 0.15),
        legibility=min(1.0, intent.legibility + 0.2),
    )
    
    heading_recs = recommend_fonts(heading_intent, max_results=5)
    body_recs = recommend_fonts(body_intent, max_results=5)
    
    heading = heading_recs.recommendations[0]
    
    # Find a different font for body if possible
    body = None
    for rec in body_recs.recommendations:
        if rec.family != heading.family:
            body = rec
            break
    
    if body is None:
        body = body_recs.recommendations[0]
    
    return FontPairing(heading=heading, body=body)
