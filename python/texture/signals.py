"""
Texture Signal Extraction Module
Deterministic extraction of texture cues from images.

Computes grain, microcontrast, anisotropy, and pattern detection
using lightweight classic computer vision features.
"""

import cv2
import numpy as np
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Tuple, Optional
import time


@dataclass
class TextureSignals:
    """Texture-related signals extracted from an image region."""
    texture_grain: float = 0.0
    microcontrast: float = 0.0
    anisotropy: float = 0.0
    noise_type_hint: str = "none"
    pattern_period_hint: Optional[float] = None
    smoothness: float = 0.0
    regularity: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def compute_texture_grain(gray: np.ndarray) -> float:
    """
    Compute texture grain level using high-frequency energy.
    
    Uses FFT band energy and Laplacian energy analysis.
    """
    if gray.size == 0 or gray.shape[0] < 16 or gray.shape[1] < 16:
        return 0.0
    
    f_transform = np.fft.fft2(gray.astype(float))
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.abs(f_shift)
    
    h, w = magnitude.shape
    cy, cx = h // 2, w // 2
    
    total_energy = np.sum(magnitude)
    if total_energy == 0:
        return 0.0
    
    y, x = np.ogrid[:h, :w]
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    
    high_freq_mask = dist > min(cx, cy) * 0.3
    high_freq_energy = np.sum(magnitude[high_freq_mask])
    
    freq_ratio = high_freq_energy / total_energy
    
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    laplacian_var = np.var(laplacian)
    laplacian_normalized = min(laplacian_var / 1000, 1.0)
    
    grain = 0.6 * freq_ratio + 0.4 * laplacian_normalized
    
    return float(np.clip(grain, 0, 1))


def compute_microcontrast(gray: np.ndarray) -> float:
    """
    Compute local microcontrast using CLAHE delta proxy.
    """
    if gray.size == 0:
        return 0.0
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    delta = np.abs(enhanced.astype(float) - gray.astype(float))
    mean_delta = np.mean(delta)
    
    microcontrast = min(mean_delta / 30, 1.0)
    
    return float(np.clip(microcontrast, 0, 1))


def compute_anisotropy(gray: np.ndarray) -> float:
    """
    Compute texture anisotropy using oriented gradient analysis.
    
    High anisotropy suggests brushed metal or fabric-like textures.
    """
    if gray.size == 0 or gray.shape[0] < 8 or gray.shape[1] < 8:
        return 0.0
    
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    
    magnitude = np.sqrt(gx**2 + gy**2)
    angle = np.arctan2(gy, gx) * 180 / np.pi
    
    significant_mask = magnitude > np.percentile(magnitude, 50)
    
    if np.sum(significant_mask) < 10:
        return 0.0
    
    significant_angles = angle[significant_mask]
    
    hist, _ = np.histogram(significant_angles, bins=36, range=(-180, 180))
    hist = hist.astype(float) / (np.sum(hist) + 1e-6)
    
    max_concentration = np.max(hist)
    
    entropy = -np.sum(hist * np.log(hist + 1e-10))
    max_entropy = np.log(36)
    uniformity = entropy / max_entropy
    
    anisotropy = max_concentration * 3 * (1 - uniformity * 0.5)
    
    return float(np.clip(anisotropy, 0, 1))


def detect_noise_type(gray: np.ndarray) -> str:
    """
    Detect the type of noise/grain in the image.
    
    Returns one of: "none", "film_grain", "dither", "speckle", "patterned"
    """
    if gray.size == 0:
        return "none"
    
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    noise_var = np.var(laplacian)
    
    if noise_var < 50:
        return "none"
    
    local_std = cv2.blur((gray.astype(float) - cv2.blur(gray.astype(float), (5, 5)))**2, (5, 5))
    local_std = np.sqrt(local_std)
    std_of_std = np.std(local_std)
    
    f_transform = np.fft.fft2(gray.astype(float))
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.abs(f_shift)
    
    h, w = magnitude.shape
    cy, cx = h // 2, w // 2
    
    peak_mask = magnitude > np.percentile(magnitude, 99)
    peak_count = np.sum(peak_mask)
    
    if peak_count > 20:
        return "patterned"
    
    if std_of_std < 5:
        return "film_grain"
    
    hist, _ = np.histogram(gray.ravel(), bins=256, range=(0, 256))
    peaks = np.where(hist > np.mean(hist) * 3)[0]
    if len(peaks) < 10:
        return "dither"
    
    if noise_var > 500:
        return "speckle"
    
    return "film_grain"


def detect_pattern_period(gray: np.ndarray) -> Optional[float]:
    """
    Detect repeating pattern period using autocorrelation.
    
    Returns the detected period in pixels, or None if no clear pattern.
    """
    if gray.size == 0 or gray.shape[0] < 32 or gray.shape[1] < 32:
        return None
    
    h, w = gray.shape
    sample_size = min(128, min(h, w))
    
    cy, cx = h // 2, w // 2
    sample = gray[cy - sample_size//2:cy + sample_size//2,
                  cx - sample_size//2:cx + sample_size//2]
    
    if sample.size == 0:
        return None
    
    sample_float = sample.astype(float) - np.mean(sample)
    
    f = np.fft.fft2(sample_float)
    autocorr = np.fft.ifft2(f * np.conj(f)).real
    autocorr = np.fft.fftshift(autocorr)
    
    h_ac, w_ac = autocorr.shape
    cy_ac, cx_ac = h_ac // 2, w_ac // 2
    
    autocorr[cy_ac-2:cy_ac+3, cx_ac-2:cx_ac+3] = 0
    
    peak_threshold = np.max(autocorr) * 0.5
    peaks_y, peaks_x = np.where(autocorr > peak_threshold)
    
    if len(peaks_y) == 0:
        return None
    
    distances = np.sqrt((peaks_y - cy_ac)**2 + (peaks_x - cx_ac)**2)
    distances = distances[distances > 5]
    
    if len(distances) == 0:
        return None
    
    min_distance = np.min(distances)
    
    if min_distance < sample_size * 0.4:
        return float(min_distance)
    
    return None


def compute_smoothness(gray: np.ndarray) -> float:
    """Compute overall smoothness (inverse of texture complexity)."""
    if gray.size == 0:
        return 0.5
    
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    roughness = np.var(laplacian)
    
    smoothness = 1.0 - min(roughness / 2000, 1.0)
    
    return float(np.clip(smoothness, 0, 1))


def compute_regularity(gray: np.ndarray) -> float:
    """Compute texture regularity (uniformity of texture patterns)."""
    if gray.size == 0 or gray.shape[0] < 32 or gray.shape[1] < 32:
        return 0.5
    
    block_size = 16
    h, w = gray.shape
    
    blocks_y = h // block_size
    blocks_x = w // block_size
    
    if blocks_y < 2 or blocks_x < 2:
        return 0.5
    
    block_vars = []
    for i in range(blocks_y):
        for j in range(blocks_x):
            block = gray[i*block_size:(i+1)*block_size, 
                        j*block_size:(j+1)*block_size]
            block_vars.append(np.var(block))
    
    if len(block_vars) == 0:
        return 0.5
    
    block_var_std = np.std(block_vars)
    block_var_mean = np.mean(block_vars)
    
    if block_var_mean == 0:
        return 1.0
    
    cv = block_var_std / (block_var_mean + 1e-6)
    regularity = 1.0 - min(cv, 1.0)
    
    return float(np.clip(regularity, 0, 1))


def extract_region_texture(gray: np.ndarray,
                          bbox: Optional[Tuple[int, int, int, int]] = None) -> TextureSignals:
    """Extract texture signals for a specific region or full image."""
    if bbox is not None:
        x, y, w, h = bbox
        x = max(0, x)
        y = max(0, y)
        w = min(w, gray.shape[1] - x)
        h = min(h, gray.shape[0] - y)
        
        if w <= 0 or h <= 0:
            return TextureSignals()
        
        roi = gray[y:y+h, x:x+w]
    else:
        roi = gray
    
    return TextureSignals(
        texture_grain=compute_texture_grain(roi),
        microcontrast=compute_microcontrast(roi),
        anisotropy=compute_anisotropy(roi),
        noise_type_hint=detect_noise_type(roi),
        pattern_period_hint=detect_pattern_period(roi),
        smoothness=compute_smoothness(roi),
        regularity=compute_regularity(roi)
    )


def extract_texture_signals(image: np.ndarray,
                           components: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Main texture signal extraction pipeline.
    
    Args:
        image: BGR or grayscale image as numpy array
        components: Optional list of component candidates with bbox
        
    Returns:
        Dictionary with global and per-component texture signals
    """
    start_time = time.time()
    timings = {}
    
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    t0 = time.time()
    global_signals = extract_region_texture(gray)
    timings["global_texture_ms"] = (time.time() - t0) * 1000
    
    per_component = {}
    if components:
        t0 = time.time()
        for comp in components:
            comp_id = comp.get("id", "unknown")
            bbox = comp.get("bbox")
            if bbox and len(bbox) == 4:
                bbox_tuple = tuple(bbox)
                signals = extract_region_texture(gray, bbox_tuple)
                per_component[comp_id] = signals.to_dict()
        timings["component_texture_ms"] = (time.time() - t0) * 1000
    
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
            result = extract_texture_signals(img)
            print(json.dumps(result, indent=2))
        else:
            print(f"Could not load image: {sys.argv[1]}")
