"""
Canonical Style Artifact Assembler

Assembles the final canonical style artifact from all normalized data.
This is the single source of truth output from the pipeline.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid

from .dtcg_validator import validate_dtcg_tokens, resolve_all_aliases, ValidationResult
from .schema_validator import (
    validate_component,
    validate_layer,
    validate_lighting,
    validate_materials,
    validate_motion,
    validate_style_semantics,
    SchemaValidationResult,
    SCHEMA_VERSION,
)
from .lineage import LineageRecord, PIPELINE_VERSION


@dataclass
class CanonicalStyleArtifact:
    """
    The canonical style artifact - single source of truth output.
    
    This structure follows the specification:
    - styleId: unique identifier
    - tokens: W3C DTCG compliant tokens
    - components: detected UI components
    - layers: foreground/midground/background
    - styleSemantics: tags, mood, embeddings
    - lighting: direction, shadows, highlights
    - materials: surface types and textures
    - motion: micro-interaction recommendations
    - lineage: provenance and reproducibility data
    """
    style_id: str
    version: str
    created_at: str
    tokens: Dict[str, Any]
    components: List[Dict[str, Any]]
    layers: List[Dict[str, Any]]
    style_semantics: Dict[str, Any]
    lighting: Dict[str, Any]
    materials: Dict[str, Any]
    motion: List[Dict[str, Any]]
    lineage: Dict[str, Any]
    validation: Dict[str, Any] = field(default_factory=dict)
    flags: Dict[str, bool] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "styleId": self.style_id,
            "version": self.version,
            "createdAt": self.created_at,
            "tokens": self.tokens,
            "components": self.components,
            "layers": self.layers,
            "styleSemantics": self.style_semantics,
            "lighting": self.lighting,
            "materials": self.materials,
            "motion": self.motion,
            "lineage": self.lineage,
            "validation": self.validation,
            "flags": self.flags,
        }


@dataclass
class AssemblyResult:
    """Result of canonical assembly."""
    artifact: CanonicalStyleArtifact
    token_validation: ValidationResult
    schema_validations: Dict[str, SchemaValidationResult]
    is_valid: bool
    is_partial: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "artifact": self.artifact.to_dict(),
            "tokenValidation": self.token_validation.to_dict(),
            "schemaValidations": {k: v.to_dict() for k, v in self.schema_validations.items()},
            "isValid": self.is_valid,
            "isPartial": self.is_partial,
        }


def generate_style_id() -> str:
    """Generate a unique style ID."""
    return str(uuid.uuid4())[:8]


def assemble_canonical_artifact(
    tokens: Dict[str, Any],
    components: List[Dict[str, Any]],
    layers: List[Dict[str, Any]],
    style_semantics: Dict[str, Any],
    lighting: Dict[str, Any],
    materials: Dict[str, Any],
    motion: List[Dict[str, Any]],
    lineage: Optional[LineageRecord] = None,
    style_id: Optional[str] = None,
    resolve_aliases: bool = True,
    validate: bool = True,
) -> AssemblyResult:
    """
    Assemble all data into a canonical style artifact.
    
    Args:
        tokens: DTCG token dictionary
        components: List of component objects
        layers: List of layer objects
        style_semantics: Style/mood data
        lighting: Lighting analysis data
        materials: Material analysis data
        motion: Motion recommendations
        lineage: Lineage record (optional)
        style_id: Pre-defined style ID (optional)
        resolve_aliases: Whether to resolve token aliases
        validate: Whether to run validation
    
    Returns:
        AssemblyResult with artifact and validation results
    """
    if style_id is None:
        style_id = generate_style_id()
    
    if resolve_aliases:
        tokens = resolve_all_aliases(tokens)
    
    token_validation = ValidationResult(valid=True, token_count=0)
    schema_validations: Dict[str, SchemaValidationResult] = {}
    
    if validate:
        token_validation = validate_dtcg_tokens(tokens)
        
        for i, comp in enumerate(components):
            result = validate_component(comp, f"components[{i}]")
            if not result.valid:
                schema_validations[f"component_{i}"] = result
        
        for i, layer in enumerate(layers):
            result = validate_layer(layer, f"layers[{i}]")
            if not result.valid:
                schema_validations[f"layer_{i}"] = result
        
        if lighting:
            lighting_data = lighting.get("lighting", lighting)
            result = validate_lighting(lighting_data, "lighting")
            if not result.valid:
                schema_validations["lighting"] = result
        
        if materials:
            result = validate_materials(materials, "materials")
            if not result.valid:
                schema_validations["materials"] = result
        
        for i, m in enumerate(motion):
            result = validate_motion(m, f"motion[{i}]")
            if not result.valid:
                schema_validations[f"motion_{i}"] = result
        
        if style_semantics:
            result = validate_style_semantics(style_semantics, "styleSemantics")
            if not result.valid:
                schema_validations["styleSemantics"] = result
    
    is_valid = token_validation.valid and len(schema_validations) == 0
    
    has_tokens = token_validation.token_count > 0
    has_components = len(components) > 0
    has_style = len(style_semantics) > 0
    is_partial = not (has_tokens and has_components and has_style)
    
    flags = {
        "hasTokens": has_tokens,
        "hasComponents": has_components,
        "hasLayers": len(layers) > 0,
        "hasStyleSemantics": has_style,
        "hasLighting": len(lighting) > 0,
        "hasMaterials": len(materials) > 0,
        "hasMotion": len(motion) > 0,
        "isPartial": is_partial,
        "aliasesResolved": resolve_aliases,
        "validated": validate,
    }
    
    validation_summary = {
        "tokensValid": token_validation.valid,
        "tokenCount": token_validation.token_count,
        "tokenErrors": len(token_validation.errors),
        "tokenWarnings": len(token_validation.warnings),
        "schemaErrors": sum(len(v.errors) for v in schema_validations.values()),
        "schemaVersion": SCHEMA_VERSION,
    }
    
    lineage_dict = lineage.to_dict() if lineage else {
        "pipelineVersion": PIPELINE_VERSION,
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    
    artifact = CanonicalStyleArtifact(
        style_id=style_id,
        version=PIPELINE_VERSION,
        created_at=datetime.utcnow().isoformat() + "Z",
        tokens=tokens,
        components=components,
        layers=layers,
        style_semantics=style_semantics,
        lighting=lighting,
        materials=materials,
        motion=motion,
        lineage=lineage_dict,
        validation=validation_summary,
        flags=flags,
    )
    
    return AssemblyResult(
        artifact=artifact,
        token_validation=token_validation,
        schema_validations=schema_validations,
        is_valid=is_valid,
        is_partial=is_partial,
    )


def merge_artifacts(
    base: CanonicalStyleArtifact,
    overlay: CanonicalStyleArtifact,
    merge_tokens: bool = True,
    merge_components: bool = True,
) -> CanonicalStyleArtifact:
    """
    Merge two style artifacts, with overlay taking precedence.
    Useful for combining partial results or applying overrides.
    """
    import copy
    
    merged_tokens = copy.deepcopy(base.tokens)
    if merge_tokens:
        def deep_merge(base: dict, overlay: dict):
            for key, value in overlay.items():
                if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                    deep_merge(base[key], value)
                else:
                    base[key] = copy.deepcopy(value)
        deep_merge(merged_tokens, overlay.tokens)
    
    merged_components = base.components.copy()
    if merge_components:
        overlay_ids = {c["id"] for c in overlay.components if "id" in c}
        merged_components = [c for c in merged_components if c.get("id") not in overlay_ids]
        merged_components.extend(overlay.components)
    
    return CanonicalStyleArtifact(
        style_id=base.style_id,
        version=PIPELINE_VERSION,
        created_at=datetime.utcnow().isoformat() + "Z",
        tokens=merged_tokens,
        components=merged_components,
        layers=overlay.layers if overlay.layers else base.layers,
        style_semantics=overlay.style_semantics if overlay.style_semantics else base.style_semantics,
        lighting=overlay.lighting if overlay.lighting else base.lighting,
        materials=overlay.materials if overlay.materials else base.materials,
        motion=overlay.motion if overlay.motion else base.motion,
        lineage={
            **base.lineage,
            "mergedFrom": overlay.style_id,
            "mergedAt": datetime.utcnow().isoformat() + "Z",
        },
        validation={},
        flags={**base.flags, **overlay.flags, "merged": True},
    )
