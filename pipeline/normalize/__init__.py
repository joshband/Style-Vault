"""Normalization and standardization module."""
from .token_normalizer import (
    normalize_colors_to_dtcg,
    normalize_spacing_to_dtcg,
    normalize_typography_to_dtcg,
    normalize_shadows_to_dtcg,
    normalize_border_radius_to_dtcg,
    assemble_dtcg_tokens,
)
from .dtcg_validator import (
    DTCGTokenType,
    ValidationError,
    ValidationResult,
    validate_dtcg_tokens,
    resolve_all_aliases,
    is_alias,
    extract_alias_path,
)
from .schema_validator import (
    SchemaError,
    SchemaValidationResult,
    SCHEMA_VERSION,
    validate_component,
    validate_layer,
    validate_lighting,
    validate_materials,
    validate_motion,
    validate_style_semantics,
)
from .lineage import (
    PIPELINE_VERSION,
    StageRecord,
    LineageRecord,
    LineageTracker,
    IntermediateArtifact,
    ArtifactRegistry,
    compute_hash,
)
from .canonical_assembler import (
    CanonicalStyleArtifact,
    AssemblyResult,
    assemble_canonical_artifact,
    merge_artifacts,
    generate_style_id,
)
