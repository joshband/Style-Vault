"""
Stage 1A: Color Primitive Extraction

Extracts dominant colors using k-means clustering with frequency and spatial weighting.
Outputs raw palette data without color naming.
"""

from typing import List, Tuple, Optional
from dataclasses import dataclass
import math

try:
    import numpy as np
    from PIL import Image
    from scipy.cluster.vq import kmeans2, whiten
    from scipy.ndimage import center_of_mass
except ImportError:
    np = None
    Image = None

from pipeline.schemas import ColorPrimitive, ColorExtractionResult


def rgb_to_oklch(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """Convert RGB to OKLCH color space."""
    r_lin = ((r / 255) ** 2.4) if r / 255 > 0.04045 else (r / 255) / 12.92
    g_lin = ((g / 255) ** 2.4) if g / 255 > 0.04045 else (g / 255) / 12.92
    b_lin = ((b / 255) ** 2.4) if b / 255 > 0.04045 else (b / 255) / 12.92
    
    l_ = 0.4122214708 * r_lin + 0.5363325363 * g_lin + 0.0514459929 * b_lin
    m_ = 0.2119034982 * r_lin + 0.6806995451 * g_lin + 0.1073969566 * b_lin
    s_ = 0.0883024619 * r_lin + 0.2817188376 * g_lin + 0.6299787005 * b_lin
    
    l_root = l_ ** (1/3) if l_ > 0 else 0
    m_root = m_ ** (1/3) if m_ > 0 else 0
    s_root = s_ ** (1/3) if s_ > 0 else 0
    
    L = 0.2104542553 * l_root + 0.7936177850 * m_root - 0.0040720468 * s_root
    a = 1.9779984951 * l_root - 2.4285922050 * m_root + 0.4505937099 * s_root
    b_val = 0.0259040371 * l_root + 0.7827717662 * m_root - 0.8086757660 * s_root
    
    C = math.sqrt(a * a + b_val * b_val)
    H = math.degrees(math.atan2(b_val, a)) % 360
    
    return (round(L, 4), round(C, 4), round(H, 2))


def compute_spatial_weight(
    pixels: 'np.ndarray',
    cluster_labels: 'np.ndarray',
    cluster_idx: int,
    image_shape: Tuple[int, int]
) -> Tuple[float, Optional[Tuple[float, float]]]:
    """
    Compute spatial weight based on proximity to image center.
    Returns weight and centroid position.
    """
    h, w = image_shape
    center_y, center_x = h / 2, w / 2
    max_dist = math.sqrt(center_x ** 2 + center_y ** 2)
    
    mask = cluster_labels == cluster_idx
    if not np.any(mask):
        return 0.0, None
    
    indices = np.where(mask)[0]
    
    y_coords = indices // w
    x_coords = indices % w
    
    centroid_y = np.mean(y_coords)
    centroid_x = np.mean(x_coords)
    
    dist_to_center = math.sqrt((centroid_y - center_y) ** 2 + (centroid_x - center_x) ** 2)
    spatial_weight = 1.0 - (dist_to_center / max_dist)
    
    rel_centroid = (centroid_x / w, centroid_y / h)
    
    return round(spatial_weight, 4), rel_centroid


def extract_colors(
    image_path: str,
    num_colors: int = 8,
    sample_rate: float = 0.1
) -> ColorExtractionResult:
    """
    Extract dominant colors from an image using k-means clustering.
    
    Args:
        image_path: Path to the image file
        num_colors: Number of colors to extract
        sample_rate: Fraction of pixels to sample (for performance)
    
    Returns:
        ColorExtractionResult with palette and dominant color
    """
    if np is None or Image is None:
        raise ImportError("numpy, PIL, and scipy are required")
    
    image = Image.open(image_path).convert('RGB')
    img_array = np.array(image)
    h, w, _ = img_array.shape
    
    pixels = img_array.reshape(-1, 3).astype(float)
    
    if sample_rate < 1.0:
        num_samples = int(len(pixels) * sample_rate)
        indices = np.random.choice(len(pixels), num_samples, replace=False)
        sampled_pixels = pixels[indices]
    else:
        sampled_pixels = pixels
        indices = np.arange(len(pixels))
    
    whitened = whiten(sampled_pixels)
    
    try:
        centroids, labels = kmeans2(whitened, num_colors, minit='++')
    except Exception:
        centroids, labels = kmeans2(whitened, num_colors, minit='random')
    
    std_dev = np.std(sampled_pixels, axis=0)
    std_dev[std_dev == 0] = 1
    centroids_rgb = centroids * std_dev
    
    palette: List[ColorPrimitive] = []
    total_pixels = len(labels)
    
    for i in range(num_colors):
        cluster_mask = labels == i
        count = np.sum(cluster_mask)
        
        if count == 0:
            continue
        
        frequency = count / total_pixels
        
        rgb = tuple(int(c) for c in np.clip(centroids_rgb[i], 0, 255))
        oklch = rgb_to_oklch(*rgb)
        
        spatial_weight, centroid = compute_spatial_weight(
            sampled_pixels, labels, i, (h, w)
        )
        
        palette.append(ColorPrimitive(
            rgb=rgb,
            oklch=oklch,
            frequency=round(frequency, 4),
            spatial_weight=spatial_weight,
            centroid=centroid
        ))
    
    palette.sort(key=lambda c: c.frequency * c.spatial_weight, reverse=True)
    
    dominant = palette[0] if palette else ColorPrimitive(
        rgb=(128, 128, 128),
        oklch=(0.5, 0, 0),
        frequency=1.0,
        spatial_weight=1.0
    )
    
    return ColorExtractionResult(
        palette=palette,
        dominant_color=dominant,
        color_count=len(palette)
    )


def extract_colors_from_array(
    img_array: 'np.ndarray',
    num_colors: int = 8,
    sample_rate: float = 0.1
) -> ColorExtractionResult:
    """Extract colors from numpy array (H, W, 3) in RGB order."""
    if np is None:
        raise ImportError("numpy and scipy are required")
    
    h, w, _ = img_array.shape
    pixels = img_array.reshape(-1, 3).astype(float)
    
    if sample_rate < 1.0:
        num_samples = int(len(pixels) * sample_rate)
        indices = np.random.choice(len(pixels), num_samples, replace=False)
        sampled_pixels = pixels[indices]
    else:
        sampled_pixels = pixels
    
    whitened = whiten(sampled_pixels)
    
    try:
        centroids, labels = kmeans2(whitened, num_colors, minit='++')
    except Exception:
        centroids, labels = kmeans2(whitened, num_colors, minit='random')
    
    std_dev = np.std(sampled_pixels, axis=0)
    std_dev[std_dev == 0] = 1
    centroids_rgb = centroids * std_dev
    
    palette: List[ColorPrimitive] = []
    total_pixels = len(labels)
    
    for i in range(num_colors):
        cluster_mask = labels == i
        count = np.sum(cluster_mask)
        
        if count == 0:
            continue
        
        frequency = count / total_pixels
        rgb = tuple(int(c) for c in np.clip(centroids_rgb[i], 0, 255))
        oklch = rgb_to_oklch(*rgb)
        
        spatial_weight, centroid = compute_spatial_weight(
            sampled_pixels, labels, i, (h, w)
        )
        
        palette.append(ColorPrimitive(
            rgb=rgb,
            oklch=oklch,
            frequency=round(frequency, 4),
            spatial_weight=spatial_weight,
            centroid=centroid
        ))
    
    palette.sort(key=lambda c: c.frequency * c.spatial_weight, reverse=True)
    
    dominant = palette[0] if palette else ColorPrimitive(
        rgb=(128, 128, 128),
        oklch=(0.5, 0, 0),
        frequency=1.0,
        spatial_weight=1.0
    )
    
    return ColorExtractionResult(
        palette=palette,
        dominant_color=dominant,
        color_count=len(palette)
    )
