"""
Final Assembly Stage

Coordinates all extraction stages and assembles the unified output.
DTCG tokens are kept separate from non-token data (components, layers, motion).
"""

import os
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass

from pipeline.schemas import (
    IngestResult,
    ColorExtractionResult,
    LayoutExtractionResult,
    TypographyExtractionResult,
    DepthExtractionResult,
    ComponentDetectionResult,
    StyleInferenceResult,
    MaterialAnalysisResult,
    LightingAnalysisResult,
    MotionAnalysisResult,
    UnifiedPipelineOutput,
)
from pipeline.normalize import (
    normalize_colors_to_dtcg,
    normalize_spacing_to_dtcg,
    normalize_typography_to_dtcg,
    normalize_shadows_to_dtcg,
    normalize_border_radius_to_dtcg,
    assemble_dtcg_tokens,
)
from pipeline.extract.motion import generate_motion_tokens


@dataclass
class PipelineResults:
    """Container for all stage results."""
    ingest: Optional[IngestResult] = None
    colors: Optional[ColorExtractionResult] = None
    layout: Optional[LayoutExtractionResult] = None
    typography: Optional[TypographyExtractionResult] = None
    depth: Optional[DepthExtractionResult] = None
    components: Optional[ComponentDetectionResult] = None
    style: Optional[StyleInferenceResult] = None
    materials: Optional[MaterialAnalysisResult] = None
    lighting: Optional[LightingAnalysisResult] = None
    motion: Optional[MotionAnalysisResult] = None


def assemble_tokens(results: PipelineResults) -> Dict[str, Any]:
    """Assemble DTCG-compliant tokens from extraction results."""
    color_tokens = {}
    spacing_tokens = {}
    typography_tokens = {}
    shadow_tokens = {}
    radius_tokens = {}
    
    if results.colors:
        color_tokens = normalize_colors_to_dtcg(results.colors)
    
    if results.layout:
        spacing_tokens = normalize_spacing_to_dtcg(results.layout)
    
    if results.typography:
        typography_tokens = normalize_typography_to_dtcg(results.typography)
    
    if results.lighting:
        shadow_tokens = normalize_shadows_to_dtcg(
            results.lighting.shadow_intensity,
            results.lighting.direction.value
        )
    
    avg_confidence = 0.5
    if results.components and results.components.regions:
        confidences = [r.confidence for r in results.components.regions]
        avg_confidence = sum(confidences) / len(confidences)
    radius_tokens = normalize_border_radius_to_dtcg(avg_confidence)
    
    metadata = {}
    if results.ingest:
        metadata["sourceImageId"] = results.ingest.image_id
        metadata["sourceHash"] = results.ingest.hash
    
    return assemble_dtcg_tokens(
        color_tokens=color_tokens,
        spacing_tokens=spacing_tokens,
        typography_tokens=typography_tokens,
        shadow_tokens=shadow_tokens,
        radius_tokens=radius_tokens,
        metadata=metadata
    )


def assemble_components(results: PipelineResults) -> list:
    """Assemble component schemas from detection results."""
    if not results.components:
        return []
    
    components = []
    for region in results.components.regions:
        component = {
            "id": region.id,
            "type": region.component_type.value,
            "bbox": region.bbox.to_dict(),
            "confidence": region.confidence,
            "maskPath": region.mask_path,
            "tokenBindings": {},
            "variants": [],
            "behaviorHints": {}
        }
        
        if results.colors and results.colors.palette:
            component["tokenBindings"]["backgroundColor"] = "{color.primary}"
            component["tokenBindings"]["textColor"] = "{color.secondary}"
        
        components.append(component)
    
    return components


def assemble_unified_output(
    results: PipelineResults,
    output_dir: Optional[str] = None
) -> UnifiedPipelineOutput:
    """
    Assemble all results into a unified output structure.
    
    Args:
        results: Container with all stage results
        output_dir: Optional directory to save output files
    
    Returns:
        UnifiedPipelineOutput with all assembled data
    """
    tokens = assemble_tokens(results)
    
    components = assemble_components(results)
    
    style_data = {}
    if results.style:
        style_data = results.style.to_dict()
    
    layers_data = []
    if results.materials:
        layers_data = [l.to_dict() for l in results.materials.layers]
    
    depth_data = {}
    if results.depth:
        depth_data = results.depth.to_dict()
    
    lighting_data = {}
    if results.lighting:
        lighting_data = results.lighting.to_dict()
    
    materials_data = {}
    if results.materials:
        materials_data = {
            "materials": results.materials.materials,
            "textures": results.materials.textures
        }
    
    motion_data = []
    if results.motion:
        motion_data = [r.to_dict() for r in results.motion.recommendations]
    
    image_id = results.ingest.image_id if results.ingest else "unknown"
    
    output = UnifiedPipelineOutput(
        image_id=image_id,
        tokens=tokens,
        components=components,
        style=style_data,
        layers=layers_data,
        depth=depth_data,
        lighting=lighting_data,
        materials=materials_data,
        motion=motion_data
    )
    
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        
        tokens_path = os.path.join(output_dir, f"{image_id}_tokens.json")
        with open(tokens_path, 'w') as f:
            json.dump(tokens, f, indent=2)
        
        full_path = os.path.join(output_dir, f"{image_id}_full.json")
        with open(full_path, 'w') as f:
            json.dump(output.to_dict(), f, indent=2)
        
        if results.motion:
            motion_tokens = generate_motion_tokens(results.motion.recommendations)
            motion_path = os.path.join(output_dir, f"{image_id}_motion.json")
            with open(motion_path, 'w') as f:
                json.dump(motion_tokens, f, indent=2)
    
    return output
