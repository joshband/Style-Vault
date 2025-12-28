"""
Typography Style Signal Extraction

Extracts visual signals from images that inform typography decisions.
Uses lightweight CV heuristics - no ML required.

Mirrors the functionality in server/cv/extract_typography_signals.py
but designed for pipeline integration.
"""

from typing import Dict, Any, Tuple
from dataclasses import dataclass

try:
    import numpy as np
    from PIL import Image
    import cv2
except ImportError:
    np = None
    Image = None
    cv2 = None


@dataclass
class StyleSignals:
    """Visual signals that inform typography decisions."""
    contrast: float              # 0-1: low to high contrast
    edge_sharpness: float        # 0-1: soft/blurry to sharp/crisp
    geometric_bias: float        # 0-1: organic to geometric
    visual_density: float        # 0-1: sparse to dense
    symmetry: float              # 0-1: asymmetric to symmetric
    material_bias: str           # 'paper', 'metal', 'glass', 'organic', 'digital', 'unknown'
    color_temperature: float     # 0-1: cool to warm
    luminance_range: float       # 0-1: narrow to wide tonal range
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "contrast": self.contrast,
            "edgeSharpness": self.edge_sharpness,
            "geometricBias": self.geometric_bias,
            "visualDensity": self.visual_density,
            "symmetry": self.symmetry,
            "materialBias": self.material_bias,
            "colorTemperature": self.color_temperature,
            "luminanceRange": self.luminance_range,
        }


def compute_contrast(img: 'np.ndarray') -> float:
    """Compute global contrast as normalized standard deviation of luminance."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    std = np.std(gray)
    return min(1.0, std / 80.0)


def compute_edge_sharpness(img: 'np.ndarray') -> float:
    """Compute edge sharpness using Laplacian variance."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = laplacian.var()
    return min(1.0, variance / 2000.0)


def compute_geometric_bias(img: 'np.ndarray') -> float:
    """
    Compute geometric vs organic bias.
    Higher = more geometric (straight lines, regular shapes)
    Lower = more organic (curves, irregular forms)
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    edges = cv2.Canny(gray, 50, 150)
    
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=50, 
                            minLineLength=30, maxLineGap=10)
    
    if lines is None:
        return 0.3
    
    line_count = len(lines)
    
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if len(contours) == 0:
        return 0.5
    
    regularity_scores = []
    for contour in contours[:20]:
        if len(contour) < 5:
            continue
        
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        regularity = min(1.0, len(approx) / 20.0)
        regularity_scores.append(1.0 - regularity)
    
    contour_regularity = np.mean(regularity_scores) if regularity_scores else 0.5
    
    line_density = min(1.0, line_count / 100.0)
    
    geometric_score = 0.4 * line_density + 0.6 * contour_regularity
    return float(geometric_score)


def compute_visual_density(img: 'np.ndarray') -> float:
    """Compute visual density based on edge coverage and contrast distribution."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    edges = cv2.Canny(gray, 30, 100)
    
    edge_ratio = np.sum(edges > 0) / edges.size
    
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
    dark_ratio = np.sum(binary == 0) / binary.size
    
    density = 0.6 * edge_ratio * 10 + 0.4 * abs(dark_ratio - 0.5) * 2
    return min(1.0, float(density))


def compute_symmetry(img: 'np.ndarray') -> float:
    """Compute bilateral symmetry score."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    
    h, w = gray.shape
    half_w = w // 2
    
    left = gray[:, :half_w]
    right = gray[:, -half_w:]
    right_flipped = cv2.flip(right, 1)
    
    if left.shape != right_flipped.shape:
        min_w = min(left.shape[1], right_flipped.shape[1])
        left = left[:, :min_w]
        right_flipped = right_flipped[:, :min_w]
    
    diff = np.abs(left.astype(float) - right_flipped.astype(float))
    similarity = 1.0 - (np.mean(diff) / 255.0)
    
    return float(similarity)


def detect_material_bias(img: 'np.ndarray') -> str:
    """
    Detect material bias from visual characteristics.
    Returns: 'paper', 'metal', 'glass', 'organic', 'digital', or 'unknown'
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    h, s, v = cv2.split(hsv)
    
    saturation_mean = np.mean(s)
    value_mean = np.mean(v)
    value_std = np.std(v)
    
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.sum(edges > 0) / edges.size
    
    if value_mean > 200 and saturation_mean < 30 and value_std < 30:
        return 'paper'
    
    if saturation_mean < 40 and value_std > 50 and value_mean > 100:
        specular_ratio = np.sum(v > 240) / v.size
        if specular_ratio > 0.05:
            return 'metal'
    
    if value_mean > 180 and saturation_mean < 50 and value_std < 40:
        if edge_density < 0.05:
            return 'glass'
    
    saturation_high = np.sum(s > 100) / s.size
    if saturation_high > 0.3:
        return 'organic'
    
    if edge_density > 0.15 and value_std < 60:
        return 'digital'
    
    return 'unknown'


def compute_color_temperature(img: 'np.ndarray') -> float:
    """
    Compute color temperature.
    0 = cool (blue), 1 = warm (yellow/red)
    """
    b, g, r = cv2.split(img)
    
    r_mean = np.mean(r)
    b_mean = np.mean(b)
    
    if r_mean + b_mean == 0:
        return 0.5
    
    warmth = r_mean / (r_mean + b_mean)
    return float(warmth)


def compute_luminance_range(img: 'np.ndarray') -> float:
    """Compute tonal range (luminance range) of image."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    
    percentile_5 = np.percentile(gray, 5)
    percentile_95 = np.percentile(gray, 95)
    
    tonal_range = (percentile_95 - percentile_5) / 255.0
    return float(tonal_range)


def extract_style_signals(image_path: str) -> StyleSignals:
    """
    Extract all typography-relevant visual signals from an image.
    
    Args:
        image_path: Path to input image
    
    Returns:
        StyleSignals with all extracted values
    """
    if cv2 is None or np is None:
        raise ImportError("OpenCV and numpy are required")
    
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Failed to load image: {image_path}")
    
    max_dim = 800
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    
    return StyleSignals(
        contrast=round(compute_contrast(img), 3),
        edge_sharpness=round(compute_edge_sharpness(img), 3),
        geometric_bias=round(compute_geometric_bias(img), 3),
        visual_density=round(compute_visual_density(img), 3),
        symmetry=round(compute_symmetry(img), 3),
        material_bias=detect_material_bias(img),
        color_temperature=round(compute_color_temperature(img), 3),
        luminance_range=round(compute_luminance_range(img), 3),
    )


def extract_style_signals_from_array(img: 'np.ndarray') -> StyleSignals:
    """Extract style signals from numpy array (BGR order)."""
    if cv2 is None or np is None:
        raise ImportError("OpenCV and numpy are required")
    
    max_dim = 800
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    
    return StyleSignals(
        contrast=round(compute_contrast(img), 3),
        edge_sharpness=round(compute_edge_sharpness(img), 3),
        geometric_bias=round(compute_geometric_bias(img), 3),
        visual_density=round(compute_visual_density(img), 3),
        symmetry=round(compute_symmetry(img), 3),
        material_bias=detect_material_bias(img),
        color_temperature=round(compute_color_temperature(img), 3),
        luminance_range=round(compute_luminance_range(img), 3),
    )
