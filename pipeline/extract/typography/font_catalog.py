"""
Font Catalog

Curated Google Fonts with metadata scores on typography intent dimensions.
Each font is hand-scored based on its typographic characteristics.

Mirrors the catalog in server/typography/fontCatalog.ts
but implemented in Python for pipeline integration.
"""

from typing import Dict, List, Any, Literal, Optional
from dataclasses import dataclass


FontCategory = Literal['serif', 'sans-serif', 'display', 'monospace', 'handwriting']


@dataclass
class FontMetadata:
    """Metadata for a curated font."""
    family: str
    category: FontCategory
    google_fonts_url: str
    
    # Intent dimension scores (0-1)
    serifness: float
    weight_bias: float      # 0=light, 1=heavy
    width_bias: float       # 0=condensed, 1=wide
    formality: float
    humanist: float
    decorative: float
    legibility: float
    
    # Era affinities (0-1)
    era_scores: Dict[str, float]
    
    # Description for explainability
    description: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "family": self.family,
            "category": self.category,
            "googleFontsUrl": self.google_fonts_url,
            "serifness": self.serifness,
            "weightBias": self.weight_bias,
            "widthBias": self.width_bias,
            "formality": self.formality,
            "humanist": self.humanist,
            "decorative": self.decorative,
            "legibility": self.legibility,
            "eraScores": self.era_scores,
            "description": self.description,
        }


# Curated font catalog
FONT_CATALOG: List[FontMetadata] = [
    # === SANS-SERIF ===
    FontMetadata(
        family='Inter',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Inter',
        serifness=0.0, weight_bias=0.5, width_bias=0.5, formality=0.6,
        humanist=0.4, decorative=0.1, legibility=0.95,
        era_scores={'modern': 0.9, 'industrial': 0.3, 'classical': 0.1, 'futurist': 0.6},
        description='Highly legible, versatile sans-serif designed for screens',
    ),
    FontMetadata(
        family='Space Grotesk',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Space+Grotesk',
        serifness=0.0, weight_bias=0.5, width_bias=0.45, formality=0.5,
        humanist=0.3, decorative=0.25, legibility=0.85,
        era_scores={'modern': 0.8, 'industrial': 0.5, 'classical': 0.1, 'futurist': 0.9},
        description='Technical grotesque with quirky details for tech and space themes',
    ),
    FontMetadata(
        family='DM Sans',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/DM+Sans',
        serifness=0.0, weight_bias=0.5, width_bias=0.5, formality=0.55,
        humanist=0.5, decorative=0.15, legibility=0.9,
        era_scores={'modern': 0.85, 'industrial': 0.3, 'classical': 0.2, 'futurist': 0.5},
        description='Friendly geometric sans with subtle humanist touches',
    ),
    FontMetadata(
        family='Plus Jakarta Sans',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Plus+Jakarta+Sans',
        serifness=0.0, weight_bias=0.55, width_bias=0.5, formality=0.6,
        humanist=0.45, decorative=0.2, legibility=0.88,
        era_scores={'modern': 0.9, 'industrial': 0.25, 'classical': 0.15, 'futurist': 0.6},
        description='Contemporary geometric sans with elegant proportions',
    ),
    FontMetadata(
        family='Outfit',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Outfit',
        serifness=0.0, weight_bias=0.5, width_bias=0.55, formality=0.5,
        humanist=0.35, decorative=0.2, legibility=0.88,
        era_scores={'modern': 0.85, 'industrial': 0.35, 'classical': 0.1, 'futurist': 0.7},
        description='Clean geometric sans with excellent weight range',
    ),
    FontMetadata(
        family='Manrope',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Manrope',
        serifness=0.0, weight_bias=0.5, width_bias=0.5, formality=0.55,
        humanist=0.4, decorative=0.15, legibility=0.9,
        era_scores={'modern': 0.88, 'industrial': 0.3, 'classical': 0.15, 'futurist': 0.65},
        description='Semi-rounded geometric with modern professional feel',
    ),
    FontMetadata(
        family='Work Sans',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Work+Sans',
        serifness=0.0, weight_bias=0.45, width_bias=0.5, formality=0.6,
        humanist=0.5, decorative=0.1, legibility=0.92,
        era_scores={'modern': 0.8, 'industrial': 0.4, 'classical': 0.2, 'futurist': 0.4},
        description='Optimized for screen reading with humanist touches',
    ),
    FontMetadata(
        family='IBM Plex Sans',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/IBM+Plex+Sans',
        serifness=0.0, weight_bias=0.5, width_bias=0.5, formality=0.7,
        humanist=0.4, decorative=0.1, legibility=0.92,
        era_scores={'modern': 0.85, 'industrial': 0.5, 'classical': 0.2, 'futurist': 0.65},
        description='Corporate grotesque with excellent technical clarity',
    ),
    FontMetadata(
        family='Poppins',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Poppins',
        serifness=0.0, weight_bias=0.5, width_bias=0.55, formality=0.5,
        humanist=0.35, decorative=0.2, legibility=0.85,
        era_scores={'modern': 0.85, 'industrial': 0.3, 'classical': 0.1, 'futurist': 0.6},
        description='Geometric sans with friendly, approachable character',
    ),
    FontMetadata(
        family='Rubik',
        category='sans-serif',
        google_fonts_url='https://fonts.google.com/specimen/Rubik',
        serifness=0.0, weight_bias=0.55, width_bias=0.55, formality=0.45,
        humanist=0.4, decorative=0.2, legibility=0.88,
        era_scores={'modern': 0.8, 'industrial': 0.35, 'classical': 0.1, 'futurist': 0.5},
        description='Friendly rounded sans with subtle quirkiness',
    ),
    
    # === SERIF ===
    FontMetadata(
        family='Source Serif 4',
        category='serif',
        google_fonts_url='https://fonts.google.com/specimen/Source+Serif+4',
        serifness=0.85, weight_bias=0.5, width_bias=0.5, formality=0.7,
        humanist=0.6, decorative=0.15, legibility=0.9,
        era_scores={'modern': 0.6, 'industrial': 0.2, 'classical': 0.7, 'futurist': 0.2},
        description='Contemporary serif with excellent readability',
    ),
    FontMetadata(
        family='Lora',
        category='serif',
        google_fonts_url='https://fonts.google.com/specimen/Lora',
        serifness=0.9, weight_bias=0.45, width_bias=0.5, formality=0.65,
        humanist=0.7, decorative=0.25, legibility=0.88,
        era_scores={'modern': 0.5, 'industrial': 0.15, 'classical': 0.75, 'futurist': 0.15},
        description='Calligraphic serif with moderate contrast',
    ),
    FontMetadata(
        family='Playfair Display',
        category='serif',
        google_fonts_url='https://fonts.google.com/specimen/Playfair+Display',
        serifness=0.95, weight_bias=0.55, width_bias=0.55, formality=0.85,
        humanist=0.5, decorative=0.5, legibility=0.65,
        era_scores={'modern': 0.45, 'industrial': 0.2, 'classical': 0.85, 'futurist': 0.15},
        description='High-contrast display serif for elegant headlines',
    ),
    FontMetadata(
        family='Libre Baskerville',
        category='serif',
        google_fonts_url='https://fonts.google.com/specimen/Libre+Baskerville',
        serifness=0.95, weight_bias=0.5, width_bias=0.55, formality=0.8,
        humanist=0.55, decorative=0.2, legibility=0.85,
        era_scores={'modern': 0.3, 'industrial': 0.2, 'classical': 0.9, 'futurist': 0.1},
        description='Classic transitional serif for formal contexts',
    ),
    FontMetadata(
        family='Crimson Pro',
        category='serif',
        google_fonts_url='https://fonts.google.com/specimen/Crimson+Pro',
        serifness=0.9, weight_bias=0.4, width_bias=0.5, formality=0.75,
        humanist=0.6, decorative=0.2, legibility=0.88,
        era_scores={'modern': 0.4, 'industrial': 0.15, 'classical': 0.85, 'futurist': 0.1},
        description='Refined old-style serif for long-form reading',
    ),
    FontMetadata(
        family='DM Serif Display',
        category='serif',
        google_fonts_url='https://fonts.google.com/specimen/DM+Serif+Display',
        serifness=0.9, weight_bias=0.55, width_bias=0.5, formality=0.7,
        humanist=0.55, decorative=0.35, legibility=0.7,
        era_scores={'modern': 0.65, 'industrial': 0.25, 'classical': 0.6, 'futurist': 0.25},
        description='Contemporary display serif with refined details',
    ),
    
    # === DISPLAY ===
    FontMetadata(
        family='Bebas Neue',
        category='display',
        google_fonts_url='https://fonts.google.com/specimen/Bebas+Neue',
        serifness=0.0, weight_bias=0.7, width_bias=0.25, formality=0.55,
        humanist=0.15, decorative=0.5, legibility=0.5,
        era_scores={'modern': 0.7, 'industrial': 0.85, 'classical': 0.1, 'futurist': 0.6},
        description='Bold condensed display for impactful headlines',
    ),
    FontMetadata(
        family='Oswald',
        category='display',
        google_fonts_url='https://fonts.google.com/specimen/Oswald',
        serifness=0.0, weight_bias=0.6, width_bias=0.3, formality=0.55,
        humanist=0.2, decorative=0.35, legibility=0.6,
        era_scores={'modern': 0.7, 'industrial': 0.75, 'classical': 0.15, 'futurist': 0.55},
        description='Condensed gothic reworked for digital use',
    ),
    
    # === MONOSPACE ===
    FontMetadata(
        family='JetBrains Mono',
        category='monospace',
        google_fonts_url='https://fonts.google.com/specimen/JetBrains+Mono',
        serifness=0.0, weight_bias=0.5, width_bias=0.5, formality=0.6,
        humanist=0.2, decorative=0.15, legibility=0.9,
        era_scores={'modern': 0.9, 'industrial': 0.4, 'classical': 0.05, 'futurist': 0.85},
        description='Developer-focused mono with excellent legibility',
    ),
    FontMetadata(
        family='Fira Code',
        category='monospace',
        google_fonts_url='https://fonts.google.com/specimen/Fira+Code',
        serifness=0.0, weight_bias=0.5, width_bias=0.5, formality=0.55,
        humanist=0.25, decorative=0.2, legibility=0.88,
        era_scores={'modern': 0.85, 'industrial': 0.35, 'classical': 0.05, 'futurist': 0.8},
        description='Programmer font with coding ligatures',
    ),
    FontMetadata(
        family='Space Mono',
        category='monospace',
        google_fonts_url='https://fonts.google.com/specimen/Space+Mono',
        serifness=0.0, weight_bias=0.5, width_bias=0.5, formality=0.5,
        humanist=0.2, decorative=0.35, legibility=0.75,
        era_scores={'modern': 0.7, 'industrial': 0.5, 'classical': 0.05, 'futurist': 0.95},
        description='Retro-futurist mono with distinctive character',
    ),
]


def get_all_fonts() -> List[FontMetadata]:
    """Get all fonts in the catalog."""
    return FONT_CATALOG


def get_fonts_by_category(category: FontCategory) -> List[FontMetadata]:
    """Get fonts by category."""
    return [f for f in FONT_CATALOG if f.category == category]


def get_font_by_family(family: str) -> Optional[FontMetadata]:
    """Get a specific font by family name."""
    for font in FONT_CATALOG:
        if font.family.lower() == family.lower():
            return font
    return None
