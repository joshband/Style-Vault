#!/usr/bin/env python3
"""
Typography Signal Extraction

Extracts visual signals from images that inform typography decisions.
Uses lightweight CV heuristics - no ML required.

Input: Base64 encoded image via stdin
Output: JSON with visual signals
"""

import sys
import json
import base64
import numpy as np
from io import BytesIO

try:
    import cv2
except ImportError:
    print(json.dumps({"error": "opencv-python-headless not installed"}))
    sys.exit(1)

def decode_image(base64_string: str) -> np.ndarray:
    """Decode base64 image to numpy array."""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    image_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError("Failed to decode image")
    
    return img

def compute_contrast(img: np.ndarray) -> float:
    """Compute global contrast as normalized standard deviation of luminance."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    std = np.std(gray)
    return min(1.0, std / 80.0)

def compute_edge_sharpness(img: np.ndarray) -> float:
    """Compute edge sharpness using Laplacian variance."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = laplacian.var()
    return min(1.0, variance / 2000.0)

def compute_geometric_bias(img: np.ndarray) -> float:
    """
    Compute geometric vs organic bias.
    Higher = more geometric (straight lines, regular shapes)
    Lower = more organic (curves, irregular forms)
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
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

def compute_visual_density(img: np.ndarray) -> float:
    """Compute visual density based on edge coverage and contrast distribution."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 30, 100)
    
    edge_ratio = np.sum(edges > 0) / edges.size
    
    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
    dark_ratio = np.sum(binary == 0) / binary.size
    
    density = 0.6 * edge_ratio * 10 + 0.4 * abs(dark_ratio - 0.5) * 2
    return min(1.0, float(density))

def compute_symmetry(img: np.ndarray) -> float:
    """Compute bilateral symmetry score."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
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

def detect_material_bias(img: np.ndarray) -> str:
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

def compute_color_temperature(img: np.ndarray) -> float:
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

def compute_luminance_range(img: np.ndarray) -> float:
    """Compute tonal range (luminance range) of image."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    percentile_5 = np.percentile(gray, 5)
    percentile_95 = np.percentile(gray, 95)
    
    tonal_range = (percentile_95 - percentile_5) / 255.0
    return float(tonal_range)

def extract_signals(img: np.ndarray) -> dict:
    """Extract all typography-relevant visual signals from image."""
    
    max_dim = 800
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    
    return {
        "contrast": compute_contrast(img),
        "edgeSharpness": compute_edge_sharpness(img),
        "geometricBias": compute_geometric_bias(img),
        "visualDensity": compute_visual_density(img),
        "symmetry": compute_symmetry(img),
        "materialBias": detect_material_bias(img),
        "colorTemperature": compute_color_temperature(img),
        "luminanceRange": compute_luminance_range(img),
    }

def main():
    try:
        input_data = sys.stdin.read().strip()
        
        if not input_data:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
        
        img = decode_image(input_data)
        signals = extract_signals(img)
        
        print(json.dumps(signals))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
