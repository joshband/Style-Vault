"""
Stage 1C: Typography Primitive Extraction with Font Recommendations

Detects text regions, estimates font sizes, captures hierarchy,
extracts visual style signals, and recommends fonts based on image analysis.

This module integrates the typography recommendation engine for complete
visual-to-typography inference.
"""

from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass, field

try:
    import numpy as np
    from PIL import Image
    import cv2
except ImportError:
    np = None
    Image = None
    cv2 = None

from pipeline.schemas import BoundingBox, TypographyPrimitive, TypographyExtractionResult


@dataclass
class FontRecommendationData:
    """Font recommendation data for pipeline output."""
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
class EnhancedTypographyResult:
    """Extended typography result with font recommendations."""
    text_regions: List[TypographyPrimitive]
    size_hierarchy: List[float]
    style_signals: Optional[Dict[str, Any]] = None
    typography_intent: Optional[Dict[str, Any]] = None
    font_recommendations: List[FontRecommendationData] = field(default_factory=list)
    font_pairing: Optional[Dict[str, Any]] = None
    intent_explanations: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "textRegions": [t.to_dict() for t in self.text_regions],
            "sizeHierarchy": self.size_hierarchy,
        }
        if self.style_signals:
            result["styleSignals"] = self.style_signals
        if self.typography_intent:
            result["typographyIntent"] = self.typography_intent
        if self.font_recommendations:
            result["fontRecommendations"] = [r.to_dict() for r in self.font_recommendations]
        if self.font_pairing:
            result["fontPairing"] = self.font_pairing
        if self.intent_explanations:
            result["intentExplanations"] = self.intent_explanations
        return result


def detect_text_regions(image_path: str) -> List[Tuple[BoundingBox, float]]:
    """
    Detect potential text regions using morphological operations.
    Returns bounding boxes with estimated text height.
    """
    if cv2 is None:
        raise ImportError("OpenCV is required for typography extraction")
    
    img = cv2.imread(image_path)
    if img is None:
        return []
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1))
    horizontal_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_h)
    
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 15))
    vertical_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_v)
    
    text_mask = binary - horizontal_lines - vertical_lines
    text_mask = np.clip(text_mask, 0, 255).astype(np.uint8)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 3))
    dilated = cv2.dilate(text_mask, kernel, iterations=2)
    
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    regions = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        
        aspect_ratio = w / h if h > 0 else 0
        if w > 20 and h > 8 and aspect_ratio > 1.5:
            bbox = BoundingBox(x=x, y=y, width=w, height=h)
            
            estimated_size = h * 0.75
            regions.append((bbox, estimated_size))
    
    return regions


def compute_hierarchy(regions: List[Tuple[BoundingBox, float]]) -> List[TypographyPrimitive]:
    """
    Assign hierarchy levels based on estimated font size.
    Larger text = higher hierarchy (lower number).
    """
    if not regions:
        return []
    
    sorted_regions = sorted(regions, key=lambda r: r[1], reverse=True)
    
    max_size = sorted_regions[0][1]
    
    size_groups = []
    current_group = [sorted_regions[0][1]]
    tolerance = max_size * 0.15
    
    for _, size in sorted_regions[1:]:
        if abs(size - current_group[-1]) <= tolerance:
            current_group.append(size)
        else:
            size_groups.append(np.mean(current_group))
            current_group = [size]
    size_groups.append(np.mean(current_group))
    
    primitives = []
    for bbox, size in regions:
        level = 1
        for i, group_size in enumerate(size_groups):
            if abs(size - group_size) <= tolerance:
                level = i + 1
                break
        
        relative_scale = size / max_size if max_size > 0 else 1.0
        
        primitives.append(TypographyPrimitive(
            bbox=bbox,
            estimated_size=round(size, 1),
            hierarchy_level=level,
            relative_scale=round(relative_scale, 3)
        ))
    
    return primitives


def extract_typography(image_path: str) -> TypographyExtractionResult:
    """
    Extract typography primitives from an image.
    
    Args:
        image_path: Path to the image file
    
    Returns:
        TypographyExtractionResult with text regions and size hierarchy
    """
    regions = detect_text_regions(image_path)
    primitives = compute_hierarchy(regions)
    
    sizes = sorted(set(p.estimated_size for p in primitives), reverse=True)
    
    return TypographyExtractionResult(
        text_regions=primitives,
        size_hierarchy=sizes
    )


def extract_typography_with_recommendations(
    image_path: str,
    include_pairing: bool = True,
    max_recommendations: int = 3
) -> EnhancedTypographyResult:
    """
    Extract typography primitives AND generate font recommendations.
    
    This is the integrated typography + font recommendation pipeline that
    combines text region detection with visual signal analysis and font matching.
    
    Args:
        image_path: Path to the image file
        include_pairing: Whether to include heading/body font pairing
        max_recommendations: Maximum number of font recommendations
    
    Returns:
        EnhancedTypographyResult with primitives, signals, intent, and recommendations
    """
    regions = detect_text_regions(image_path)
    primitives = compute_hierarchy(regions)
    sizes = sorted(set(p.estimated_size for p in primitives), reverse=True)
    
    style_signals = None
    typography_intent = None
    font_recommendations = []
    font_pairing = None
    intent_explanations = []
    
    try:
        from .style_signals import extract_style_signals
        from .typography_intent import infer_typography_intent
        from .font_recommender import recommend_fonts, recommend_font_pairing
        
        signals = extract_style_signals(image_path)
        style_signals = signals.to_dict()
        
        intent_result = infer_typography_intent(signals)
        typography_intent = intent_result.intent.to_dict()
        intent_explanations = [e.to_dict() for e in intent_result.explanations]
        
        rec_result = recommend_fonts(
            intent_result.intent,
            max_results=max_recommendations
        )
        font_recommendations = [
            FontRecommendationData(
                family=r.family,
                score=r.score,
                category=r.category,
                google_fonts_url=r.google_fonts_url,
                reasoning=r.reasoning,
            )
            for r in rec_result.recommendations
        ]
        
        if include_pairing:
            pairing = recommend_font_pairing(intent_result.intent)
            font_pairing = pairing.to_dict()
            
    except ImportError:
        pass
    except Exception as e:
        print(f"[Typography] Font recommendation failed: {e}")
    
    return EnhancedTypographyResult(
        text_regions=primitives,
        size_hierarchy=sizes,
        style_signals=style_signals,
        typography_intent=typography_intent,
        font_recommendations=font_recommendations,
        font_pairing=font_pairing,
        intent_explanations=intent_explanations,
    )
