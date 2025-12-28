"""Typography extraction and font recommendation module."""
from .typography_extraction import (
    extract_typography,
    extract_typography_with_recommendations,
    EnhancedTypographyResult,
    detect_text_regions,
    compute_hierarchy,
)
from .style_signals import (
    StyleSignals,
    extract_style_signals,
    extract_style_signals_from_array,
)
from .typography_intent import (
    TypographyIntent,
    TypographyIntentResult,
    infer_typography_intent,
)
from .font_catalog import (
    FontMetadata,
    FONT_CATALOG,
    get_all_fonts,
    get_fonts_by_category,
    get_font_by_family,
)
from .font_recommender import (
    FontRecommendation,
    FontPairing,
    RecommendationResult,
    recommend_fonts,
    recommend_font_pairing,
)
