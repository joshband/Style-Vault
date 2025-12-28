"""
Typography Intent Inference

Deterministic mapping from visual signals to typographic intent.
All rules are explainable - no ML required.

Mirrors the functionality in server/typography/typographyIntent.ts
but implemented in Python for pipeline integration.
"""

from typing import Dict, Any, List, Literal
from dataclasses import dataclass, field
from .style_signals import StyleSignals


EraBias = Literal['modern', 'industrial', 'classical', 'futurist', 'neutral']


@dataclass
class TypographyIntent:
    """Inferred typographic intent from visual signals."""
    serifness: float        # 0-1: sans-serif to serif preference
    weight_bias: float      # 0-1: light to heavy weight preference
    width_bias: float       # 0-1: condensed to wide width preference
    formality: float        # 0-1: casual to formal
    era_bias: EraBias       # Era aesthetic
    humanist: float         # 0-1: mechanical to humanist
    decorative: float       # 0-1: plain to decorative
    legibility: float       # 0-1: display to body text suitability
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "serifness": self.serifness,
            "weightBias": self.weight_bias,
            "widthBias": self.width_bias,
            "formality": self.formality,
            "eraBias": self.era_bias,
            "humanist": self.humanist,
            "decorative": self.decorative,
            "legibility": self.legibility,
        }


@dataclass
class IntentExplanation:
    """Explanation for an intent dimension."""
    dimension: str
    value: Any
    reasoning: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimension": self.dimension,
            "value": self.value,
            "reasoning": self.reasoning,
        }


@dataclass
class TypographyIntentResult:
    """Result of typography intent inference."""
    intent: TypographyIntent
    explanations: List[IntentExplanation] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent": self.intent.to_dict(),
            "explanations": [e.to_dict() for e in self.explanations],
        }


def clamp(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Clamp value to range."""
    return max(min_val, min(max_val, value))


def infer_typography_intent(signals: StyleSignals) -> TypographyIntentResult:
    """
    Infer typographic intent from visual signals.
    
    Mapping philosophy:
    - High contrast → bolder, more impactful type
    - Sharp edges → geometric, precise fonts
    - Soft edges → humanist, organic fonts  
    - High density → condensed, efficient type
    - High symmetry → classical, balanced fonts
    - Material hints inform era and formality
    """
    explanations: List[IntentExplanation] = []
    
    # Serifness: influenced by formality cues, material, and organic/geometric balance
    serifness = compute_serifness(signals, explanations)
    
    # Weight bias: driven by contrast and visual density
    weight_bias = compute_weight_bias(signals, explanations)
    
    # Width bias: influenced by density and geometric tendencies
    width_bias = compute_width_bias(signals, explanations)
    
    # Formality: material, symmetry, and edge quality
    formality = compute_formality(signals, explanations)
    
    # Era bias: material and geometric/organic tendencies
    era_bias = compute_era_bias(signals, explanations)
    
    # Humanist quality: edge softness and organic bias
    humanist = compute_humanist(signals, explanations)
    
    # Decorative tendency: visual density and contrast extremes
    decorative = compute_decorative(signals, explanations)
    
    # Legibility for body text: moderate values are more legible
    legibility = compute_legibility(signals, explanations)
    
    intent = TypographyIntent(
        serifness=serifness,
        weight_bias=weight_bias,
        width_bias=width_bias,
        formality=formality,
        era_bias=era_bias,
        humanist=humanist,
        decorative=decorative,
        legibility=legibility,
    )
    
    return TypographyIntentResult(intent=intent, explanations=explanations)


def compute_serifness(signals: StyleSignals, explanations: List[IntentExplanation]) -> float:
    """Compute serif preference."""
    serifness = 0.5
    
    # Classical materials suggest serif
    if signals.material_bias == 'paper':
        serifness += 0.2
    
    # High symmetry suggests classical serif
    if signals.symmetry > 0.7:
        serifness += 0.1
    
    # Digital/metal materials suggest sans
    if signals.material_bias in ('digital', 'metal'):
        serifness -= 0.2
    
    # High geometric bias suggests sans
    if signals.geometric_bias > 0.7:
        serifness -= 0.15
    
    # Warm colors lean slightly toward serif
    if signals.color_temperature > 0.6:
        serifness += 0.05
    
    serifness = clamp(serifness)
    
    if serifness > 0.6:
        reasoning = 'Classical materials and warm tones suggest serif typography'
    elif serifness < 0.4:
        reasoning = 'Modern materials and geometric forms suggest sans-serif'
    else:
        reasoning = 'Balanced visual cues, either serif or sans-serif works'
    
    explanations.append(IntentExplanation('serifness', round(serifness, 2), reasoning))
    return serifness


def compute_weight_bias(signals: StyleSignals, explanations: List[IntentExplanation]) -> float:
    """Compute weight preference."""
    weight = 0.3 + (signals.contrast * 0.4) + (signals.visual_density * 0.2)
    
    # Sharp edges can handle heavier weights
    if signals.edge_sharpness > 0.7:
        weight += 0.1
    
    # Metal material suggests industrial boldness
    if signals.material_bias == 'metal':
        weight += 0.15
    
    # Glass material suggests light elegance
    if signals.material_bias == 'glass':
        weight -= 0.15
    
    weight = clamp(weight)
    
    if weight > 0.6:
        reasoning = 'High contrast and visual density suggest bold typography'
    elif weight < 0.4:
        reasoning = 'Soft visuals and airy composition suggest lighter weights'
    else:
        reasoning = 'Moderate visual weight suggests regular to medium weights'
    
    explanations.append(IntentExplanation('weightBias', round(weight, 2), reasoning))
    return weight


def compute_width_bias(signals: StyleSignals, explanations: List[IntentExplanation]) -> float:
    """Compute width preference."""
    width = 0.5 - (signals.visual_density * 0.3)
    
    # Low density allows for wider type
    if signals.visual_density < 0.3:
        width += 0.2
    
    # Geometric bias often pairs with regular width
    if signals.geometric_bias > 0.6:
        width = width * 0.8 + 0.1
    
    width = clamp(width)
    
    if width < 0.4:
        reasoning = 'Dense compositions benefit from condensed typography'
    elif width > 0.6:
        reasoning = 'Spacious layouts can accommodate wider letterforms'
    else:
        reasoning = 'Standard width typography fits the composition'
    
    explanations.append(IntentExplanation('widthBias', round(width, 2), reasoning))
    return width


def compute_formality(signals: StyleSignals, explanations: List[IntentExplanation]) -> float:
    """Compute formality level."""
    formality = 0.5
    
    # High symmetry is more formal
    formality += (signals.symmetry - 0.5) * 0.4
    
    # Sharp edges are more formal
    formality += (signals.edge_sharpness - 0.5) * 0.2
    
    # Material influences
    material_adjustments = {
        'paper': 0.15,
        'metal': 0.1,
        'organic': -0.2,
        'glass': 0.05,
    }
    formality += material_adjustments.get(signals.material_bias, 0)
    
    formality = clamp(formality)
    
    if formality > 0.6:
        reasoning = 'Symmetric composition and refined materials suggest formal typography'
    elif formality < 0.4:
        reasoning = 'Organic forms and casual composition suggest informal type'
    else:
        reasoning = 'Versatile visual context works with various formality levels'
    
    explanations.append(IntentExplanation('formality', round(formality, 2), reasoning))
    return formality


def compute_era_bias(signals: StyleSignals, explanations: List[IntentExplanation]) -> EraBias:
    """Compute era aesthetic."""
    scores = {
        'modern': 0.0,
        'industrial': 0.0,
        'classical': 0.0,
        'futurist': 0.0,
        'neutral': 0.3,
    }
    
    # Modern: clean geometry, digital material, high contrast
    scores['modern'] += signals.geometric_bias * 0.3
    if signals.material_bias == 'digital':
        scores['modern'] += 0.3
    scores['modern'] += signals.edge_sharpness * 0.2
    
    # Industrial: metal, bold contrast, geometric
    if signals.material_bias == 'metal':
        scores['industrial'] += 0.4
    scores['industrial'] += signals.contrast * 0.2
    scores['industrial'] += signals.geometric_bias * 0.2
    
    # Classical: paper, high symmetry, warm tones
    if signals.material_bias == 'paper':
        scores['classical'] += 0.3
    scores['classical'] += signals.symmetry * 0.2
    scores['classical'] += signals.color_temperature * 0.2
    
    # Futurist: glass, cool tones, high sharpness
    if signals.material_bias == 'glass':
        scores['futurist'] += 0.3
    scores['futurist'] += (1 - signals.color_temperature) * 0.2
    scores['futurist'] += signals.edge_sharpness * 0.2
    
    # Find highest scoring era
    max_era: EraBias = 'neutral'
    max_score = scores['neutral']
    
    for era, score in scores.items():
        if score > max_score:
            max_score = score
            max_era = era  # type: ignore
    
    reasoning_map = {
        'modern': 'Clean geometry and digital aesthetics suggest contemporary typography',
        'industrial': 'Bold contrast and metallic qualities evoke industrial-era type',
        'classical': 'Traditional materials and balanced composition suggest classical typography',
        'futurist': 'Cool tones and sharp edges suggest forward-looking typography',
        'neutral': 'Balanced visual cues allow flexibility in typographic era',
    }
    
    explanations.append(IntentExplanation('eraBias', max_era, reasoning_map[max_era]))
    return max_era


def compute_humanist(signals: StyleSignals, explanations: List[IntentExplanation]) -> float:
    """Compute humanist quality."""
    humanist = (1 - signals.geometric_bias) * 0.5 + (1 - signals.edge_sharpness) * 0.3
    
    if signals.material_bias == 'organic':
        humanist += 0.2
    if signals.material_bias == 'paper':
        humanist += 0.1
    
    humanist = clamp(humanist)
    
    if humanist > 0.6:
        reasoning = 'Organic forms suggest humanist letterforms with calligraphic influence'
    elif humanist < 0.4:
        reasoning = 'Geometric precision suggests mechanical, constructed letterforms'
    else:
        reasoning = 'Mixed signals allow for various levels of humanist influence'
    
    explanations.append(IntentExplanation('humanist', round(humanist, 2), reasoning))
    return humanist


def compute_decorative(signals: StyleSignals, explanations: List[IntentExplanation]) -> float:
    """Compute decorative tendency."""
    contrast_extreme = abs(signals.contrast - 0.5) * 2
    density_extreme = abs(signals.visual_density - 0.5) * 2
    
    decorative = (contrast_extreme * 0.3 + density_extreme * 0.3 + signals.color_temperature * 0.2)
    
    # Low symmetry can suggest more playful, decorative type
    if signals.symmetry < 0.4:
        decorative += 0.15
    
    decorative = clamp(decorative)
    
    if decorative > 0.6:
        reasoning = 'Bold visual contrasts and dynamic composition suit decorative display type'
    else:
        reasoning = 'Subtle visuals favor clean, unadorned typography'
    
    explanations.append(IntentExplanation('decorative', round(decorative, 2), reasoning))
    return decorative


def compute_legibility(signals: StyleSignals, explanations: List[IntentExplanation]) -> float:
    """Compute legibility suitability."""
    contrast_moderate = 1 - abs(signals.contrast - 0.5) * 2
    density_moderate = 1 - abs(signals.visual_density - 0.5) * 2
    
    legibility = (contrast_moderate * 0.4 + density_moderate * 0.3 + signals.symmetry * 0.2)
    
    # Sharp edges aid legibility
    legibility += signals.edge_sharpness * 0.1
    
    legibility = clamp(legibility)
    
    if legibility > 0.6:
        reasoning = 'Balanced composition suits text-focused typography'
    else:
        reasoning = 'Dynamic composition favors display or headline use'
    
    explanations.append(IntentExplanation('legibility', round(legibility, 2), reasoning))
    return legibility
