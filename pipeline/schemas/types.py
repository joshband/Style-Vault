"""
Core type definitions for the Visual DNA extraction pipeline.
All stages produce structured output conforming to these schemas.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import json


class ComponentType(str, Enum):
    BUTTON = "button"
    INPUT = "input"
    CARD = "card"
    NAV = "nav"
    TEXT_BLOCK = "text_block"
    IMAGE = "image"
    ICON = "icon"
    UNKNOWN = "unknown"


class MaterialType(str, Enum):
    MATTE = "matte"
    GLOSSY = "glossy"
    METALLIC = "metallic"
    FABRIC = "fabric"
    GLASS = "glass"
    PAPER = "paper"
    UNKNOWN = "unknown"


class LightingDirection(str, Enum):
    TOP = "top"
    TOP_LEFT = "top_left"
    TOP_RIGHT = "top_right"
    LEFT = "left"
    RIGHT = "right"
    BOTTOM = "bottom"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_RIGHT = "bottom_right"
    AMBIENT = "ambient"


@dataclass
class IngestResult:
    """Stage 0: Ingestion output"""
    image_id: str
    original_path: str
    sizes: Dict[str, str]
    hash: str
    color_space: str = "sRGB"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "imageId": self.image_id,
            "originalPath": self.original_path,
            "sizes": self.sizes,
            "hash": self.hash,
            "colorSpace": self.color_space
        }


@dataclass
class ColorPrimitive:
    """Single color extracted from image"""
    rgb: Tuple[int, int, int]
    oklch: Tuple[float, float, float]
    frequency: float
    spatial_weight: float
    centroid: Optional[Tuple[float, float]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rgb": list(self.rgb),
            "oklch": {"l": self.oklch[0], "c": self.oklch[1], "h": self.oklch[2]},
            "frequency": self.frequency,
            "spatialWeight": self.spatial_weight,
            "centroid": list(self.centroid) if self.centroid else None
        }


@dataclass
class ColorExtractionResult:
    """Stage 1A: Color primitives output"""
    palette: List[ColorPrimitive]
    dominant_color: ColorPrimitive
    color_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "palette": [c.to_dict() for c in self.palette],
            "dominantColor": self.dominant_color.to_dict(),
            "colorCount": self.color_count
        }


@dataclass
class BoundingBox:
    """Axis-aligned bounding box"""
    x: int
    y: int
    width: int
    height: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {"x": self.x, "y": self.y, "width": self.width, "height": self.height}


@dataclass
class LayoutExtractionResult:
    """Stage 1B: Geometry & layout primitives output"""
    bounding_boxes: List[BoundingBox]
    alignments: Dict[str, List[int]]
    spacing_distances: List[int]
    grid_rhythm: Optional[Dict[str, int]]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "boundingBoxes": [b.to_dict() for b in self.bounding_boxes],
            "alignments": self.alignments,
            "spacingDistances": self.spacing_distances,
            "gridRhythm": self.grid_rhythm
        }


@dataclass
class TypographyPrimitive:
    """Detected text region with properties"""
    bbox: BoundingBox
    estimated_size: float
    hierarchy_level: int
    relative_scale: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "bbox": self.bbox.to_dict(),
            "estimatedSize": self.estimated_size,
            "hierarchyLevel": self.hierarchy_level,
            "relativeScale": self.relative_scale
        }


@dataclass
class TypographyExtractionResult:
    """Stage 1C: Typography primitives output"""
    text_regions: List[TypographyPrimitive]
    size_hierarchy: List[float]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "textRegions": [t.to_dict() for t in self.text_regions],
            "sizeHierarchy": self.size_hierarchy
        }


@dataclass
class DepthExtractionResult:
    """Stage 2: Depth estimation output"""
    depth_map_path: str
    depth_json_path: str
    depth_stats: Dict[str, float]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "depthMapPath": self.depth_map_path,
            "depthJsonPath": self.depth_json_path,
            "depthStats": self.depth_stats
        }


@dataclass
class DetectedRegion:
    """Stage 3: Detected component region"""
    id: str
    bbox: BoundingBox
    mask_path: str
    component_type: ComponentType
    confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "bbox": self.bbox.to_dict(),
            "maskPath": self.mask_path,
            "componentType": self.component_type.value,
            "confidence": self.confidence
        }


@dataclass
class ComponentDetectionResult:
    """Stage 3: Component detection output"""
    regions: List[DetectedRegion]
    
    def to_dict(self) -> Dict[str, Any]:
        return {"regions": [r.to_dict() for r in self.regions]}


@dataclass
class ComponentVariant:
    """Component variant definition"""
    name: str
    size: Optional[str] = None
    state: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "size": self.size, "state": self.state}


@dataclass
class ComponentSchema:
    """Stage 4: Component schema"""
    id: str
    name: str
    semantic_role: str
    token_bindings: Dict[str, str]
    variants: List[ComponentVariant]
    behavior_hints: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "semanticRole": self.semantic_role,
            "tokenBindings": self.token_bindings,
            "variants": [v.to_dict() for v in self.variants],
            "behaviorHints": self.behavior_hints
        }


@dataclass
class StyleInferenceResult:
    """Stage 5: Style/mood inference output"""
    style_tags: List[Dict[str, Any]]
    mood: Dict[str, Any]
    embedding: List[float]
    caption: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "styleTags": self.style_tags,
            "mood": self.mood,
            "embedding": self.embedding,
            "caption": self.caption
        }


@dataclass
class LayerInfo:
    """Layer in the image"""
    name: str
    depth_range: Tuple[float, float]
    mask_path: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "depthRange": list(self.depth_range),
            "maskPath": self.mask_path
        }


@dataclass
class MaterialAnalysisResult:
    """Stage 6: Layering & materials output"""
    layers: List[LayerInfo]
    materials: Dict[str, Dict[str, Any]]
    textures: Dict[str, Dict[str, float]]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "layers": [l.to_dict() for l in self.layers],
            "materials": self.materials,
            "textures": self.textures
        }


@dataclass
class LightingAnalysisResult:
    """Stage 7: Lighting & shadow inference output"""
    direction: LightingDirection
    shadow_intensity: float
    highlight_strength: float
    contrast_gradient: float
    key_light_position: Optional[Tuple[float, float, float]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "lighting": {
                "direction": self.direction.value,
                "shadowIntensity": self.shadow_intensity,
                "highlightStrength": self.highlight_strength,
                "contrastGradient": self.contrast_gradient,
                "keyLightPosition": list(self.key_light_position) if self.key_light_position else None
            }
        }


@dataclass
class MotionRecommendation:
    """Stage 8: Motion recommendation for a component"""
    component_id: str
    component_type: str
    motion_type: str
    duration_ms: int
    easing: str
    trigger: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "component": self.component_id,
            "componentType": self.component_type,
            "motion": {
                "type": self.motion_type,
                "duration": self.duration_ms,
                "easing": self.easing,
                "trigger": self.trigger
            }
        }


@dataclass
class MotionAnalysisResult:
    """Stage 8: Motion recommendations output"""
    recommendations: List[MotionRecommendation]
    
    def to_dict(self) -> Dict[str, Any]:
        return {"motionRecommendations": [r.to_dict() for r in self.recommendations]}


@dataclass
class UnifiedPipelineOutput:
    """Final assembled output from all stages"""
    image_id: str
    tokens: Dict[str, Any]
    components: List[Dict[str, Any]]
    style: Dict[str, Any]
    layers: List[Dict[str, Any]]
    depth: Dict[str, Any]
    lighting: Dict[str, Any]
    materials: Dict[str, Any]
    motion: List[Dict[str, Any]]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "imageId": self.image_id,
            "tokens": self.tokens,
            "components": self.components,
            "style": self.style,
            "layers": self.layers,
            "depth": self.depth,
            "lighting": self.lighting,
            "materials": self.materials,
            "motion": self.motion
        }
    
    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)
