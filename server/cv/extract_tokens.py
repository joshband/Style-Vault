#!/usr/bin/env python3
"""
Lightweight Design Token Extraction
W3C DTCG 2025.10 - Heuristic / CV-based
------------------------------------

Goals:
- Near-realtime (CPU only)
- Deterministic + explainable
- Suitable for Replit / serverless
- Produces design-token-ready primitives

Dependencies:
- opencv-python-headless
- numpy
- scipy
- coloraide

This file intentionally avoids:
- Deep learning
- Heavy OCR
- GPU dependencies
"""

import sys
import json
import base64
import time
import cv2
import numpy as np
from scipy.spatial.distance import cdist
from coloraide import Color
from concurrent.futures import ProcessPoolExecutor, as_completed
from functools import partial


# ------------------------------------------------------------
# Utility helpers
# ------------------------------------------------------------

def resize_for_speed(img, max_width=256):
    """
    Downscale image to reduce computation cost.
    UI screenshots retain structure at low resolutions.
    """
    h, w = img.shape[:2]
    if w <= max_width:
        return img
    scale = max_width / w
    return cv2.resize(img, (int(w * scale), int(h * scale)))


def quantize_values(values, snap_points):
    """
    Snap continuous measurements (px, radius, opacity)
    to a small discrete scale typical of design systems.
    """
    if not values:
        return []
    snapped = []
    for v in values:
        closest = min(snap_points, key=lambda x: abs(x - v))
        snapped.append(closest)
    return sorted(list(set(snapped)))


# ------------------------------------------------------------
# Color Tokens
# ------------------------------------------------------------

def extract_colors(img, k=12):
    """
    Extract dominant perceptual colors.

    Strategy:
    - Downscale
    - K-means clustering in RGB
    - Convert to OKLCH
    - Deduplicate by Delta-E
    """
    img_small = resize_for_speed(img)
    pixels = img_small.reshape(-1, 3).astype(np.float32)

    _, labels, centers = cv2.kmeans(
        pixels,
        k,
        None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0),
        3,
        cv2.KMEANS_PP_CENTERS
    )

    counts = np.bincount(labels.flatten())
    ranked = centers[np.argsort(-counts)]

    colors = []
    for c in ranked:
        col = Color(f"rgb({int(c[2])},{int(c[1])},{int(c[0])})").convert("oklch")
        colors.append(col)

    unique = []
    for c in colors:
        if not any(c.delta_e(u) < 3 for u in unique):
            unique.append(c)

    result = []
    for c in unique[:8]:
        hue = c['h']
        if hue is None or (isinstance(hue, float) and np.isnan(hue)):
            hue = 0
        result.append({
            "space": "oklch",
            "l": round(c['l'], 3),
            "c": round(c['c'], 3),
            "h": round(hue, 1)
        })
    return result


# ------------------------------------------------------------
# Spacing Tokens
# ------------------------------------------------------------

def extract_spacing(img):
    """
    Infer spacing scale from bounding box deltas.

    Strategy:
    - Threshold + connected components
    - Compute distances between box edges
    - Cluster into common spacing values
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_OTSU)

    num, _, stats, _ = cv2.connectedComponentsWithStats(bw)
    boxes = stats[1:, :4]

    deltas = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            dx = abs(a[0] - b[0])
            dy = abs(a[1] - b[1])
            if 2 < dx < 200:
                deltas.append(dx)
            if 2 < dy < 200:
                deltas.append(dy)

    snap = [4, 8, 12, 16, 24, 32, 48, 64]
    return quantize_values(deltas[:100], snap)


# ------------------------------------------------------------
# Border Radius Tokens
# ------------------------------------------------------------

def extract_border_radius(img):
    """
    Estimate border radius from contour curvature.

    Strategy:
    - Find contours
    - Approximate polygon
    - Measure curvature at corners
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 160)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    radii = []
    for cnt in contours:
        if cv2.contourArea(cnt) < 200:
            continue

        approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
        if len(approx) >= 4:
            peri = cv2.arcLength(cnt, True)
            radius = peri / (2 * np.pi)
            radii.append(radius)

    snap = [0, 4, 6, 8, 12, 16, 24, 32]
    return quantize_values(radii[:50], snap)


# ------------------------------------------------------------
# Grid Tokens
# ------------------------------------------------------------

def extract_grid(img):
    """
    Detect grid structure via projection histograms.

    Strategy:
    - Sum pixels vertically/horizontally
    - Peaks = rows / columns
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    proj_x = gray.mean(axis=0)
    proj_y = gray.mean(axis=1)

    cols = np.sum(np.abs(np.diff(proj_x)) > 20)
    rows = np.sum(np.abs(np.diff(proj_y)) > 20)

    return {
        "columns": max(1, int(cols)),
        "rows": max(1, int(rows))
    }


# ------------------------------------------------------------
# Shadow / Elevation Tokens
# ------------------------------------------------------------

def extract_shadows(img):
    """
    Enhanced shadow and depth detection.

    Strategy:
    - Analyze luminance gradients for shadow strength
    - Detect shadow direction from gradient orientation
    - Estimate blur radius from edge softness
    - Analyze contrast distribution for depth layers
    - Extract shadow color from dark regions
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel = lab[:, :, 0].astype(np.float32)
    
    grad_x = cv2.Sobel(l_channel, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(l_channel, cv2.CV_32F, 0, 1, ksize=3)
    
    laplacian = cv2.Laplacian(l_channel, cv2.CV_32F)
    strength = np.mean(np.abs(laplacian))
    
    if strength < 2:
        level = 0
    elif strength < 5:
        level = 1
    elif strength < 12:
        level = 2
    else:
        level = 3
    
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    threshold = np.percentile(magnitude, 90)
    strong_grads = magnitude > threshold
    
    if np.sum(strong_grads) > 0:
        avg_grad_x = np.mean(grad_x[strong_grads])
        avg_grad_y = np.mean(grad_y[strong_grads])
        angle = np.degrees(np.arctan2(avg_grad_y, avg_grad_x))
        
        if -22.5 <= angle < 22.5:
            direction = "right"
        elif 22.5 <= angle < 67.5:
            direction = "bottom-right"
        elif 67.5 <= angle < 112.5:
            direction = "bottom"
        elif 112.5 <= angle < 157.5:
            direction = "bottom-left"
        elif angle >= 157.5 or angle < -157.5:
            direction = "left"
        elif -157.5 <= angle < -112.5:
            direction = "top-left"
        elif -112.5 <= angle < -67.5:
            direction = "top"
        else:
            direction = "top-right"
    else:
        direction = "ambient"
        angle = 0
    
    edges = cv2.Canny(l_channel.astype(np.uint8), 50, 150)
    dist_transform = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 5)
    blur_samples = dist_transform[dist_transform > 0]
    if len(blur_samples) > 0:
        blur_radius = round(float(np.median(blur_samples)), 1)
    else:
        blur_radius = 0
    
    blur_radius = min(blur_radius, 24)
    
    hist = cv2.calcHist([l_channel.astype(np.uint8)], [0], None, [256], [0, 256])
    hist = hist.flatten() / hist.sum()
    
    dark_ratio = np.sum(hist[:85])
    mid_ratio = np.sum(hist[85:170])
    light_ratio = np.sum(hist[170:])
    
    contrast = np.std(l_channel)
    
    if dark_ratio > 0.4 and light_ratio > 0.2:
        depth_style = "high-contrast"
    elif dark_ratio > 0.5:
        depth_style = "dark-dominant"
    elif light_ratio > 0.5:
        depth_style = "light-dominant"
    elif mid_ratio > 0.6:
        depth_style = "flat"
    else:
        depth_style = "balanced"
    
    dark_mask = l_channel < 50
    if np.sum(dark_mask) > 100:
        dark_pixels = img[dark_mask]
        if len(dark_pixels) > 0:
            avg_dark = np.mean(dark_pixels, axis=0)
            shadow_color = Color(f"rgb({int(avg_dark[2])},{int(avg_dark[1])},{int(avg_dark[0])})").convert("oklch")
            shadow_color_data = {
                "space": "oklch",
                "l": round(shadow_color['l'], 3),
                "c": round(shadow_color['c'], 3),
                "h": round(shadow_color['h'] if shadow_color['h'] and not np.isnan(shadow_color['h']) else 0, 1)
            }
        else:
            shadow_color_data = None
    else:
        shadow_color_data = None

    return {
        "elevation": level,
        "shadowStrength": round(float(strength), 2),
        "direction": direction,
        "directionAngle": round(float(angle), 1),
        "blurRadius": blur_radius,
        "contrast": round(float(contrast), 1),
        "depthStyle": depth_style,
        "distribution": {
            "dark": round(float(dark_ratio), 2),
            "mid": round(float(mid_ratio), 2),
            "light": round(float(light_ratio), 2)
        },
        "shadowColor": shadow_color_data
    }


# ------------------------------------------------------------
# Stroke Tokens
# ------------------------------------------------------------

def extract_strokes(img):
    """
    Estimate stroke widths from edges using skeleton-based analysis.

    Strategy:
    - Threshold to binary
    - Compute distance transform on the foreground
    - Sample at skeleton/ridge points to get stroke half-widths
    - Double to get full stroke width
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_OTSU)
    
    binary_inv = 255 - binary
    
    dist = cv2.distanceTransform(binary_inv, cv2.DIST_L2, 5)
    
    kernel = np.ones((3, 3), np.uint8)
    eroded = cv2.erode(binary_inv, kernel, iterations=1)
    skeleton = cv2.subtract(binary_inv, eroded)
    
    widths = dist[skeleton > 0]
    
    if len(widths) == 0 or np.max(widths) < 0.5:
        edges = cv2.Canny(gray, 50, 150)
        dilated = cv2.dilate(edges, kernel, iterations=2)
        dist_from_edges = cv2.distanceTransform(dilated, cv2.DIST_L2, 5)
        widths = dist_from_edges[dist_from_edges > 0]
    
    if len(widths) == 0:
        return [1]
    
    full_widths = [w * 2 for w in widths.tolist()[:200]]
    
    snap = [1, 2, 3, 4, 6, 8]
    return quantize_values(full_widths, snap)


# ------------------------------------------------------------
# Parallel extraction wrappers
# ------------------------------------------------------------

def _run_extractor(extractor_name, img_bytes, img_shape):
    """
    Worker function for parallel extraction.
    Reconstructs image from bytes and runs the specified extractor.
    """
    img = np.frombuffer(img_bytes, dtype=np.uint8).reshape(img_shape)
    
    extractors = {
        "color": extract_colors,
        "spacing": extract_spacing,
        "borderRadius": extract_border_radius,
        "grid": extract_grid,
        "elevation": extract_shadows,
        "strokeWidth": extract_strokes,
    }
    
    extractor_fn = extractors[extractor_name]
    return extractor_name, extractor_fn(img)


# ------------------------------------------------------------
# Master extractor
# ------------------------------------------------------------

def extract_design_tokens_sequential(img):
    """
    Sequential extraction pass (fallback).
    """
    img_resized = resize_for_speed(img, 512)

    return {
        "color": extract_colors(img_resized),
        "spacing": extract_spacing(img_resized),
        "borderRadius": extract_border_radius(img_resized),
        "grid": extract_grid(img_resized),
        "elevation": extract_shadows(img_resized),
        "strokeWidth": extract_strokes(img_resized),
        "meta": {
            "method": "heuristic-cv",
            "confidence": "medium-high",
            "realtimeSafe": True,
            "parallel": False
        }
    }


def extract_design_tokens_parallel(img):
    """
    Parallel extraction using multiprocessing.
    Runs all extractors concurrently for faster execution.
    """
    img_resized = resize_for_speed(img, 512)
    
    img_bytes = img_resized.tobytes()
    img_shape = img_resized.shape
    
    extractor_names = ["color", "spacing", "borderRadius", "grid", "elevation", "strokeWidth"]
    
    results = {}
    
    with ProcessPoolExecutor(max_workers=len(extractor_names)) as executor:
        futures = {
            executor.submit(_run_extractor, name, img_bytes, img_shape): name
            for name in extractor_names
        }
        
        for future in as_completed(futures):
            name, result = future.result()
            results[name] = result
    
    results["meta"] = {
        "method": "heuristic-cv",
        "confidence": "medium-high",
        "realtimeSafe": True,
        "parallel": True
    }
    
    return results


def extract_design_tokens(img):
    """
    Full lightweight extraction pass.
    Uses parallel processing when available, falls back to sequential.
    """
    try:
        return extract_design_tokens_parallel(img)
    except Exception as e:
        return extract_design_tokens_sequential(img)


def load_image_from_base64(data_url):
    """
    Load image from base64 data URL.
    """
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    
    img_data = base64.b64decode(data_url)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img


def load_image_from_file(file_path):
    """
    Load image from file path.
    """
    return cv2.imread(file_path)


def main():
    """
    CLI entry point.
    Accepts either:
    - A file path as argument
    - Base64 data via stdin
    """
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        img = load_image_from_file(file_path)
    else:
        data = sys.stdin.read()
        img = load_image_from_base64(data)

    if img is None:
        print(json.dumps({"error": "Failed to load image"}), file=sys.stderr)
        sys.exit(1)

    try:
        tokens = extract_design_tokens(img)
        print(json.dumps(tokens))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
