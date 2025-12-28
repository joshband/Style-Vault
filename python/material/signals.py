"""
Material Signal Extraction Module
Deterministic extraction of material cues from images.

Computes translucency, specular density, emission, and shadow complexity
at both global and per-component levels.
"""

import cv2
import numpy as np
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Tuple, Optional
import time


@dataclass
class MaterialSignals:
    """Material-related signals extracted from an image region."""
    translucency_score: float = 0.0
    specular_density: float = 0.0
    emission_score: float = 0.0
    depth_shadow_complexity: float = 0.0
    reflectivity_hint: float = 0.0
    surface_roughness: float = 0.0
    
    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


def compute_translucency(gray: np.ndarray, edges: np.ndarray) -> float:
    """
    Estimate translucency based on edge softness and contrast attenuation.
    
    Higher values indicate more glass-like/translucent appearance.
    """
    if gray.size == 0:
        return 0.0
    
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    edge_sharpness = np.var(laplacian)
    
    max_sharpness = 5000
    sharpness_normalized = min(edge_sharpness / max_sharpness, 1.0)
    
    edge_mask = edges > 0
    if np.sum(edge_mask) > 10:
        kernel = np.ones((5, 5), np.float32) / 25
        blurred = cv2.filter2D(gray.astype(float), -1, kernel)
        edge_falloff = np.mean(np.abs(gray.astype(float) - blurred)[edge_mask])
        falloff_normalized = min(edge_falloff / 30, 1.0)
    else:
        falloff_normalized = 0.0
    
    global_std = np.std(gray)
    contrast_normalized = min(global_std / 80, 1.0)
    
    translucency = (
        0.4 * (1 - sharpness_normalized) +
        0.3 * falloff_normalized +
        0.3 * (1 - contrast_normalized)
    )
    
    return float(np.clip(translucency, 0, 1))


def compute_specular_density(gray: np.ndarray, image: np.ndarray) -> float:
    """
    Estimate specular highlight density.
    
    Counts high-luma pixels with strong gradients.
    """
    if gray.size == 0:
        return 0.0
    
    threshold = np.percentile(gray, 95)
    bright_mask = gray > threshold
    
    grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    gradient_mag = np.sqrt(grad_x**2 + grad_y**2)
    
    high_gradient_mask = gradient_mag > np.percentile(gradient_mag, 80)
    
    specular_pixels = np.logical_and(bright_mask, high_gradient_mask)
    specular_ratio = np.sum(specular_pixels) / (gray.size + 1e-6)
    
    specular_density = min(specular_ratio * 50, 1.0)
    
    if len(image.shape) == 3:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        saturation = hsv[:, :, 1]
        bright_saturation = np.mean(saturation[bright_mask]) if np.sum(bright_mask) > 0 else 128
        sat_factor = 1 - (bright_saturation / 255)
        specular_density = specular_density * (0.5 + 0.5 * sat_factor)
    
    return float(np.clip(specular_density, 0, 1))


def compute_emission_score(gray: np.ndarray, image: np.ndarray, 
                          edges: np.ndarray) -> float:
    """
    Estimate emission/glow presence.
    
    Detects halos (bright pixels bleeding beyond shape boundaries)
    and saturation spikes near edges.
    """
    if gray.size == 0 or edges.size == 0:
        return 0.0
    
    kernel = np.ones((15, 15), np.uint8)
    dilated_edges = cv2.dilate(edges, kernel, iterations=1)
    halo_region = np.logical_and(dilated_edges > 0, edges == 0)
    
    if np.sum(halo_region) > 0:
        halo_brightness = np.mean(gray[halo_region])
        overall_brightness = np.mean(gray)
        halo_factor = (halo_brightness - overall_brightness) / 128
        halo_factor = max(0, min(halo_factor, 1))
    else:
        halo_factor = 0.0
    
    if len(image.shape) == 3:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        saturation = hsv[:, :, 1]
        value = hsv[:, :, 2]
        
        high_sat_high_val = np.logical_and(saturation > 150, value > 200)
        emission_pixels = np.sum(high_sat_high_val) / (gray.size + 1e-6)
        saturation_factor = min(emission_pixels * 20, 1.0)
    else:
        saturation_factor = 0.0
    
    bright_threshold = np.percentile(gray, 90)
    very_bright = gray > bright_threshold
    bright_cluster_size = np.sum(very_bright) / (gray.size + 1e-6)
    brightness_factor = min(bright_cluster_size * 5, 1.0)
    
    emission = (
        0.4 * halo_factor +
        0.3 * saturation_factor +
        0.3 * brightness_factor
    )
    
    return float(np.clip(emission, 0, 1))


def compute_shadow_complexity(gray: np.ndarray) -> float:
    """
    Estimate shadow layer complexity.
    
    Analyzes shadow-like dark regions and their structure.
    """
    if gray.size == 0:
        return 0.0
    
    dark_threshold = np.percentile(gray, 20)
    dark_mask = gray < dark_threshold
    
    if np.sum(dark_mask) < 100:
        return 0.0
    
    dark_img = np.zeros_like(gray)
    dark_img[dark_mask] = 255
    
    contours, _ = cv2.findContours(dark_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    num_shadow_regions = len(contours)
    region_complexity = min(num_shadow_regions / 10, 1.0)
    
    layer_count = 0
    thresholds = [10, 20, 30, 40, 50]
    for t in thresholds:
        mask = gray < np.percentile(gray, t)
        if np.sum(mask) > 50:
            layer_count += 1
    layer_factor = layer_count / len(thresholds)
    
    dark_values = gray[dark_mask]
    gradient_in_shadow = np.std(dark_values) / 50
    gradient_factor = min(gradient_in_shadow, 1.0)
    
    complexity = (
        0.3 * region_complexity +
        0.4 * layer_factor +
        0.3 * gradient_factor
    )
    
    return float(np.clip(complexity, 0, 1))


def compute_reflectivity(gray: np.ndarray, image: np.ndarray) -> float:
    """Estimate surface reflectivity from highlight patterns."""
    if gray.size == 0:
        return 0.0
    
    threshold = np.percentile(gray, 92)
    bright_mask = gray > threshold
    
    if np.sum(bright_mask) < 10:
        return 0.0
    
    bright_coords = np.where(bright_mask)
    if len(bright_coords[0]) > 0:
        y_range = (np.max(bright_coords[0]) - np.min(bright_coords[0])) / gray.shape[0]
        x_range = (np.max(bright_coords[1]) - np.min(bright_coords[1])) / gray.shape[1]
        spread = (y_range + x_range) / 2
    else:
        spread = 0
    
    bright_concentration = np.sum(bright_mask) / (gray.size + 1e-6)
    
    reflectivity = 0.6 * (1 - spread) + 0.4 * min(bright_concentration * 10, 1)
    
    return float(np.clip(reflectivity, 0, 1))


def compute_surface_roughness(gray: np.ndarray) -> float:
    """Estimate surface roughness from texture variation."""
    if gray.size == 0:
        return 0.5
    
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    texture_energy = np.var(laplacian)
    
    roughness = min(texture_energy / 2000, 1.0)
    
    return float(np.clip(roughness, 0, 1))


def extract_region_signals(image: np.ndarray, gray: np.ndarray, 
                          edges: np.ndarray,
                          bbox: Optional[Tuple[int, int, int, int]] = None) -> MaterialSignals:
    """Extract material signals for a specific region or full image."""
    if bbox is not None:
        x, y, w, h = bbox
        x = max(0, x)
        y = max(0, y)
        w = min(w, image.shape[1] - x)
        h = min(h, image.shape[0] - y)
        
        if w <= 0 or h <= 0:
            return MaterialSignals()
        
        roi_image = image[y:y+h, x:x+w]
        roi_gray = gray[y:y+h, x:x+w]
        roi_edges = edges[y:y+h, x:x+w]
    else:
        roi_image = image
        roi_gray = gray
        roi_edges = edges
    
    return MaterialSignals(
        translucency_score=compute_translucency(roi_gray, roi_edges),
        specular_density=compute_specular_density(roi_gray, roi_image),
        emission_score=compute_emission_score(roi_gray, roi_image, roi_edges),
        depth_shadow_complexity=compute_shadow_complexity(roi_gray),
        reflectivity_hint=compute_reflectivity(roi_gray, roi_image),
        surface_roughness=compute_surface_roughness(roi_gray)
    )


def extract_material_signals(image: np.ndarray,
                             components: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Main material signal extraction pipeline.
    
    Args:
        image: BGR image as numpy array
        components: Optional list of component candidates with bbox
        
    Returns:
        Dictionary with global and per-component signals
    """
    start_time = time.time()
    timings = {}
    
    if len(image.shape) == 2:
        gray = image
        color = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    else:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        color = image
    
    t0 = time.time()
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    timings["preprocessing_ms"] = (time.time() - t0) * 1000
    
    t0 = time.time()
    global_signals = extract_region_signals(color, gray, edges)
    timings["global_signals_ms"] = (time.time() - t0) * 1000
    
    per_component = {}
    if components:
        t0 = time.time()
        for comp in components:
            comp_id = comp.get("id", "unknown")
            bbox = comp.get("bbox")
            if bbox and len(bbox) == 4:
                bbox_tuple = tuple(bbox)
                signals = extract_region_signals(color, gray, edges, bbox_tuple)
                per_component[comp_id] = signals.to_dict()
        timings["component_signals_ms"] = (time.time() - t0) * 1000
    
    total_time = (time.time() - start_time) * 1000
    timings["total_ms"] = total_time
    
    return {
        "global": global_signals.to_dict(),
        "perComponent": per_component,
        "timings": timings,
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) > 1:
        img = cv2.imread(sys.argv[1])
        if img is not None:
            result = extract_material_signals(img)
            print(json.dumps(result, indent=2))
        else:
            print(f"Could not load image: {sys.argv[1]}")
