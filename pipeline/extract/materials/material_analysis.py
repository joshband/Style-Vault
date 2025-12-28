"""
Stage 6: Layering, Material & Texture Analysis

Uses depth information and segmentation to infer layers,
texture descriptors (frequency analysis), and material classification.
"""

import os
import json
from typing import List, Dict, Any, Optional, Tuple

try:
    import numpy as np
    from PIL import Image
    import cv2
    from scipy import ndimage
except ImportError:
    np = None
    Image = None
    cv2 = None
    ndimage = None

from pipeline.schemas import LayerInfo, MaterialAnalysisResult, MaterialType


MATERIAL_TEXTURE_SIGNATURES = {
    MaterialType.GLOSSY: {"variance": (0.1, 0.4), "high_freq": (0.3, 1.0), "edges": (0.4, 1.0)},
    MaterialType.MATTE: {"variance": (0.0, 0.2), "high_freq": (0.0, 0.3), "edges": (0.0, 0.3)},
    MaterialType.METALLIC: {"variance": (0.2, 0.6), "high_freq": (0.4, 0.8), "edges": (0.3, 0.7)},
    MaterialType.FABRIC: {"variance": (0.1, 0.3), "high_freq": (0.5, 0.9), "edges": (0.1, 0.4)},
    MaterialType.GLASS: {"variance": (0.3, 0.7), "high_freq": (0.1, 0.4), "edges": (0.5, 1.0)},
    MaterialType.PAPER: {"variance": (0.05, 0.15), "high_freq": (0.2, 0.5), "edges": (0.1, 0.3)},
}


def compute_texture_features(region: 'np.ndarray') -> Dict[str, float]:
    """
    Compute texture features for a region.
    
    Returns variance, high-frequency content, and edge density.
    """
    if cv2 is None or np is None:
        raise ImportError("OpenCV and numpy are required")
    
    if len(region.shape) == 3:
        gray = cv2.cvtColor(region, cv2.COLOR_RGB2GRAY)
    else:
        gray = region
    
    gray = gray.astype(np.float32) / 255.0
    
    variance = float(np.var(gray))
    
    fft = np.fft.fft2(gray)
    fft_shift = np.fft.fftshift(fft)
    magnitude = np.abs(fft_shift)
    
    h, w = gray.shape
    cy, cx = h // 2, w // 2
    
    y, x = np.ogrid[:h, :w]
    center_dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    high_freq_mask = center_dist > min(h, w) // 4
    
    high_freq_energy = np.sum(magnitude[high_freq_mask])
    total_energy = np.sum(magnitude) + 1e-8
    high_freq_ratio = high_freq_energy / total_energy
    
    edges = cv2.Canny(np.uint8(gray * 255), 50, 150)
    edge_density = np.sum(edges > 0) / (h * w)
    
    return {
        "variance": min(1.0, variance * 10),
        "high_freq": min(1.0, high_freq_ratio),
        "edges": min(1.0, edge_density * 5)
    }


def classify_material(features: Dict[str, float]) -> Tuple[MaterialType, float]:
    """Classify material based on texture features."""
    best_match = MaterialType.UNKNOWN
    best_score = 0.0
    
    for material_type, signature in MATERIAL_TEXTURE_SIGNATURES.items():
        scores = []
        
        for feature_name, (low, high) in signature.items():
            value = features.get(feature_name, 0.5)
            if low <= value <= high:
                normalized = 1.0 - abs(value - (low + high) / 2) / ((high - low) / 2 + 0.01)
                scores.append(normalized)
            else:
                scores.append(0.0)
        
        avg_score = sum(scores) / len(scores) if scores else 0
        
        if avg_score > best_score:
            best_score = avg_score
            best_match = material_type
    
    return best_match, round(best_score, 3)


def segment_by_depth(
    depth_map: 'np.ndarray',
    num_layers: int = 3
) -> List[Tuple[str, Tuple[float, float], 'np.ndarray']]:
    """
    Segment image into layers based on depth.
    
    Returns list of (layer_name, depth_range, mask) tuples.
    """
    layer_names = ["foreground", "midground", "background"]
    if num_layers > 3:
        layer_names = [f"layer_{i}" for i in range(num_layers)]
    
    thresholds = np.linspace(0, 1, num_layers + 1)
    
    layers = []
    for i in range(num_layers):
        name = layer_names[i] if i < len(layer_names) else f"layer_{i}"
        low = thresholds[i]
        high = thresholds[i + 1]
        
        mask = ((depth_map >= low) & (depth_map < high)).astype(np.uint8) * 255
        
        layers.append((name, (low, high), mask))
    
    return layers


def analyze_materials(
    image_path: str,
    depth_map_path: Optional[str],
    output_dir: str,
    image_id: Optional[str] = None
) -> MaterialAnalysisResult:
    """
    Analyze image for layers, materials, and textures.
    
    Args:
        image_path: Path to input image
        depth_map_path: Path to depth map (optional)
        output_dir: Directory for layer mask outputs
        image_id: Optional ID for outputs
    
    Returns:
        MaterialAnalysisResult with layers, materials, and textures
    """
    if np is None or Image is None or cv2 is None:
        raise ImportError("numpy, PIL, and OpenCV are required")
    
    if image_id is None:
        image_id = os.path.splitext(os.path.basename(image_path))[0]
    
    os.makedirs(output_dir, exist_ok=True)
    
    image = np.array(Image.open(image_path).convert('RGB'))
    h, w = image.shape[:2]
    
    if depth_map_path and os.path.exists(depth_map_path):
        depth_img = Image.open(depth_map_path)
        depth = np.array(depth_img).astype(np.float32)
        if depth.max() > 1:
            depth = depth / depth.max()
        if depth.shape != (h, w):
            depth_pil = Image.fromarray((depth * 255).astype(np.uint8))
            depth_pil = depth_pil.resize((w, h), Image.Resampling.BILINEAR)
            depth = np.array(depth_pil).astype(np.float32) / 255.0
    else:
        y_gradient = np.linspace(0, 1, h).reshape(-1, 1)
        depth = np.tile(y_gradient, (1, w)).astype(np.float32)
    
    layer_data = segment_by_depth(depth, num_layers=3)
    
    layer_infos = []
    materials_by_layer = {}
    textures_by_layer = {}
    
    for name, depth_range, mask in layer_data:
        mask_path = os.path.join(output_dir, f"{image_id}_{name}_mask.png")
        Image.fromarray(mask).save(mask_path)
        
        layer_infos.append(LayerInfo(
            name=name,
            depth_range=depth_range,
            mask_path=mask_path
        ))
        
        masked_region = image.copy()
        masked_region[mask == 0] = 0
        
        if np.sum(mask > 0) > 100:
            features = compute_texture_features(masked_region)
            material_type, confidence = classify_material(features)
            
            materials_by_layer[name] = {
                "type": material_type.value,
                "confidence": confidence
            }
            textures_by_layer[name] = features
        else:
            materials_by_layer[name] = {"type": "unknown", "confidence": 0.0}
            textures_by_layer[name] = {"variance": 0, "high_freq": 0, "edges": 0}
    
    return MaterialAnalysisResult(
        layers=layer_infos,
        materials=materials_by_layer,
        textures=textures_by_layer
    )
