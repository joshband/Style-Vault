"""
Normalization & Token Assembly

Converts extracted primitives into W3C DTCG 2025.10 compliant design tokens.
Non-token data (components, layers, motion) is assembled separately.
"""

from typing import Dict, Any, List, Optional
from pipeline.schemas import (
    ColorExtractionResult,
    LayoutExtractionResult,
    TypographyExtractionResult,
)


def color_to_dtcg_value(rgb: tuple, oklch: dict) -> str:
    """Format color value for DTCG token."""
    return f"oklch({oklch['l']} {oklch['c']} {oklch['h']})"


def normalize_colors_to_dtcg(
    color_result: ColorExtractionResult,
    prefix: str = "color"
) -> Dict[str, Any]:
    """
    Convert color extraction results to DTCG color tokens.
    
    DTCG 2025.10 color token format:
    {
      "$type": "color",
      "$value": "oklch(0.5 0.2 180)"
    }
    """
    tokens = {}
    
    dominant = color_result.dominant_color
    tokens[f"{prefix}.primary"] = {
        "$type": "color",
        "$value": color_to_dtcg_value(dominant.rgb, dominant.to_dict()["oklch"]),
        "$description": f"Primary/dominant color (frequency: {dominant.frequency})"
    }
    
    for i, color in enumerate(color_result.palette):
        if i == 0:
            continue
        
        role = "secondary" if i == 1 else f"palette.{i}"
        tokens[f"{prefix}.{role}"] = {
            "$type": "color",
            "$value": color_to_dtcg_value(color.rgb, color.to_dict()["oklch"]),
            "$description": f"Palette color {i} (frequency: {color.frequency})"
        }
    
    return tokens


def normalize_spacing_to_dtcg(
    layout_result: LayoutExtractionResult,
    base_unit: int = 4
) -> Dict[str, Any]:
    """
    Convert layout spacing to DTCG dimension tokens.
    
    DTCG 2025.10 dimension token format:
    {
      "$type": "dimension",
      "$value": "16px"
    }
    """
    tokens = {}
    
    spacing_values = sorted(set(layout_result.spacing_distances))
    
    for i, spacing in enumerate(spacing_values[:8]):
        scale_name = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"][i] if i < 8 else f"scale{i}"
        
        tokens[f"spacing.{scale_name}"] = {
            "$type": "dimension",
            "$value": f"{spacing}px"
        }
    
    if layout_result.grid_rhythm:
        grid = layout_result.grid_rhythm
        if "columnWidth" in grid:
            tokens["grid.columnWidth"] = {
                "$type": "dimension",
                "$value": f"{grid['columnWidth']}px"
            }
        if "gutterWidth" in grid:
            tokens["grid.gutter"] = {
                "$type": "dimension",
                "$value": f"{grid['gutterWidth']}px"
            }
    
    return tokens


def normalize_typography_to_dtcg(
    typography_result: TypographyExtractionResult
) -> Dict[str, Any]:
    """
    Convert typography extraction to DTCG font size tokens.
    
    DTCG 2025.10 dimension token for font sizes:
    {
      "$type": "dimension", 
      "$value": "16px"
    }
    """
    tokens = {}
    
    hierarchy = typography_result.size_hierarchy
    
    scale_names = ["display", "h1", "h2", "h3", "h4", "body", "caption", "small"]
    
    for i, size in enumerate(hierarchy[:len(scale_names)]):
        name = scale_names[i]
        tokens[f"fontSize.{name}"] = {
            "$type": "dimension",
            "$value": f"{int(size)}px"
        }
    
    if len(hierarchy) >= 2:
        ratio = hierarchy[0] / hierarchy[1] if hierarchy[1] > 0 else 1.0
        tokens["typography.scaleRatio"] = {
            "$type": "number",
            "$value": round(ratio, 3),
            "$description": "Type scale ratio between heading levels"
        }
    
    return tokens


def normalize_shadows_to_dtcg(
    shadow_intensity: float,
    lighting_direction: str
) -> Dict[str, Any]:
    """
    Generate shadow tokens based on lighting analysis.
    
    DTCG 2025.10 shadow token format:
    {
      "$type": "shadow",
      "$value": {
        "color": "...",
        "offsetX": "...",
        "offsetY": "...",
        "blur": "...",
        "spread": "..."
      }
    }
    """
    tokens = {}
    
    base_opacity = min(0.3, shadow_intensity * 0.4)
    
    direction_offsets = {
        "top": (0, -4),
        "top_left": (-2, -4),
        "top_right": (2, -4),
        "left": (-4, 0),
        "right": (4, 0),
        "bottom": (0, 4),
        "bottom_left": (-2, 4),
        "bottom_right": (2, 4),
        "ambient": (0, 2),
    }
    
    offset_x, offset_y = direction_offsets.get(lighting_direction, (0, 2))
    
    elevations = [
        ("sm", 1, 2, 4),
        ("md", 2, 4, 8),
        ("lg", 4, 8, 16),
        ("xl", 8, 16, 24),
    ]
    
    for name, scale, blur, spread_limit in elevations:
        tokens[f"shadow.{name}"] = {
            "$type": "shadow",
            "$value": {
                "color": f"oklch(0 0 0 / {base_opacity * scale:.2f})",
                "offsetX": f"{offset_x * scale}px",
                "offsetY": f"{offset_y * scale}px",
                "blur": f"{blur * (1 + shadow_intensity)}px",
                "spread": "0px"
            }
        }
    
    return tokens


def normalize_border_radius_to_dtcg(
    component_confidence: float = 0.5
) -> Dict[str, Any]:
    """
    Generate border radius tokens.
    
    Uses heuristics based on overall style (geometric vs organic).
    """
    base = 4 if component_confidence < 0.5 else 8
    
    tokens = {
        "borderRadius.none": {"$type": "dimension", "$value": "0px"},
        "borderRadius.sm": {"$type": "dimension", "$value": f"{base}px"},
        "borderRadius.md": {"$type": "dimension", "$value": f"{base * 2}px"},
        "borderRadius.lg": {"$type": "dimension", "$value": f"{base * 4}px"},
        "borderRadius.xl": {"$type": "dimension", "$value": f"{base * 6}px"},
        "borderRadius.full": {"$type": "dimension", "$value": "9999px"},
    }
    
    return tokens


def assemble_dtcg_tokens(
    color_tokens: Dict[str, Any],
    spacing_tokens: Dict[str, Any],
    typography_tokens: Dict[str, Any],
    shadow_tokens: Dict[str, Any],
    radius_tokens: Dict[str, Any],
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Assemble all tokens into a complete DTCG-compliant token file.
    
    Structure follows W3C DTCG 2025.10 specification.
    """
    tokens = {
        "$schema": "https://design-tokens.org/schema.json",
        "$version": "2025.10",
        "$description": "Visual DNA extracted design tokens",
    }
    
    if metadata:
        tokens["$metadata"] = metadata
    
    nested = {}
    
    all_tokens = {
        **color_tokens,
        **spacing_tokens,
        **typography_tokens,
        **shadow_tokens,
        **radius_tokens
    }
    
    for key, value in all_tokens.items():
        parts = key.split(".")
        current = nested
        
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        current[parts[-1]] = value
    
    tokens.update(nested)
    
    return tokens
