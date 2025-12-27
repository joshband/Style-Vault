"""
Stage 7: Lighting & Shadow Inference

Analyzes shadow direction, intensity, highlight spread, and contrast gradients
using image gradients and depth cues.
"""

from typing import Dict, Optional, Tuple
import math

try:
    import numpy as np
    from PIL import Image
    import cv2
except ImportError:
    np = None
    Image = None
    cv2 = None

from pipeline.schemas import LightingAnalysisResult, LightingDirection


def compute_gradient_direction(image: 'np.ndarray') -> Tuple[float, float]:
    """
    Compute dominant gradient direction using Sobel operators.
    Returns (angle_degrees, magnitude).
    """
    if cv2 is None:
        raise ImportError("OpenCV is required")
    
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image
    
    gray = gray.astype(np.float32) / 255.0
    
    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    
    magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
    
    threshold = np.percentile(magnitude, 90)
    strong_mask = magnitude > threshold
    
    if np.sum(strong_mask) < 10:
        return 0.0, 0.0
    
    avg_gx = np.mean(sobel_x[strong_mask])
    avg_gy = np.mean(sobel_y[strong_mask])
    
    angle = math.degrees(math.atan2(avg_gy, avg_gx))
    
    avg_magnitude = np.mean(magnitude[strong_mask])
    
    return angle, float(avg_magnitude)


def angle_to_direction(angle: float) -> LightingDirection:
    """Convert angle in degrees to lighting direction enum."""
    angle = angle % 360
    
    if angle < 0:
        angle += 360
    
    direction_map = [
        (337.5, 360, LightingDirection.RIGHT),
        (0, 22.5, LightingDirection.RIGHT),
        (22.5, 67.5, LightingDirection.BOTTOM_RIGHT),
        (67.5, 112.5, LightingDirection.BOTTOM),
        (112.5, 157.5, LightingDirection.BOTTOM_LEFT),
        (157.5, 202.5, LightingDirection.LEFT),
        (202.5, 247.5, LightingDirection.TOP_LEFT),
        (247.5, 292.5, LightingDirection.TOP),
        (292.5, 337.5, LightingDirection.TOP_RIGHT),
    ]
    
    for start, end, direction in direction_map:
        if start <= angle < end:
            return direction
    
    return LightingDirection.AMBIENT


def compute_shadow_intensity(image: 'np.ndarray') -> float:
    """
    Estimate shadow intensity based on dark region analysis.
    Returns value 0-1 where 1 = strong shadows.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image
    
    dark_threshold = 50
    dark_pixels = np.sum(gray < dark_threshold)
    total_pixels = gray.size
    
    dark_ratio = dark_pixels / total_pixels
    
    std_dev = np.std(gray)
    
    intensity = (dark_ratio * 0.5) + (std_dev / 255 * 0.5)
    
    return min(1.0, max(0.0, intensity * 2))


def compute_highlight_strength(image: 'np.ndarray') -> float:
    """
    Estimate highlight strength based on bright region analysis.
    Returns value 0-1 where 1 = strong highlights.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image
    
    bright_threshold = 200
    bright_pixels = np.sum(gray > bright_threshold)
    total_pixels = gray.size
    
    bright_ratio = bright_pixels / total_pixels
    
    very_bright = np.sum(gray > 240)
    saturation = very_bright / total_pixels
    
    strength = (bright_ratio * 0.6) + (saturation * 0.4)
    
    return min(1.0, max(0.0, strength * 3))


def compute_contrast_gradient(image: 'np.ndarray') -> float:
    """
    Compute overall contrast gradient in the image.
    Higher values indicate more dramatic lighting.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image
    
    p5 = np.percentile(gray, 5)
    p95 = np.percentile(gray, 95)
    
    contrast_range = (p95 - p5) / 255.0
    
    std_dev = np.std(gray) / 127.5
    
    return (contrast_range + std_dev) / 2


def estimate_key_light_position(
    direction: LightingDirection,
    shadow_intensity: float
) -> Tuple[float, float, float]:
    """
    Estimate 3D position of key light based on direction and intensity.
    Returns (x, y, z) normalized coordinates.
    """
    direction_vectors = {
        LightingDirection.TOP: (0.0, -1.0, 0.5),
        LightingDirection.TOP_LEFT: (-0.7, -0.7, 0.5),
        LightingDirection.TOP_RIGHT: (0.7, -0.7, 0.5),
        LightingDirection.LEFT: (-1.0, 0.0, 0.5),
        LightingDirection.RIGHT: (1.0, 0.0, 0.5),
        LightingDirection.BOTTOM: (0.0, 1.0, 0.5),
        LightingDirection.BOTTOM_LEFT: (-0.7, 0.7, 0.5),
        LightingDirection.BOTTOM_RIGHT: (0.7, 0.7, 0.5),
        LightingDirection.AMBIENT: (0.0, 0.0, 1.0),
    }
    
    base = direction_vectors.get(direction, (0.0, 0.0, 1.0))
    
    z_offset = (1 - shadow_intensity) * 0.5
    
    return (base[0], base[1], base[2] + z_offset)


def analyze_lighting(
    image_path: str,
    depth_map_path: Optional[str] = None
) -> LightingAnalysisResult:
    """
    Analyze lighting and shadows in an image.
    
    Args:
        image_path: Path to input image
        depth_map_path: Optional path to depth map for enhanced analysis
    
    Returns:
        LightingAnalysisResult with direction, intensities, and position
    """
    if np is None or Image is None or cv2 is None:
        raise ImportError("numpy, PIL, and OpenCV are required")
    
    image = np.array(Image.open(image_path).convert('RGB'))
    
    gradient_angle, gradient_magnitude = compute_gradient_direction(image)
    
    if gradient_magnitude < 0.05:
        direction = LightingDirection.AMBIENT
    else:
        light_angle = (gradient_angle + 180) % 360
        direction = angle_to_direction(light_angle)
    
    shadow_intensity = compute_shadow_intensity(image)
    highlight_strength = compute_highlight_strength(image)
    contrast_gradient = compute_contrast_gradient(image)
    
    key_light_pos = estimate_key_light_position(direction, shadow_intensity)
    
    return LightingAnalysisResult(
        direction=direction,
        shadow_intensity=round(shadow_intensity, 3),
        highlight_strength=round(highlight_strength, 3),
        contrast_gradient=round(contrast_gradient, 3),
        key_light_position=key_light_pos
    )
