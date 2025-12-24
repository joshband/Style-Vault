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
import cv2
import numpy as np
from scipy.spatial.distance import cdist
from coloraide import Color


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
    Heuristic shadow detection.

    Strategy:
    - Analyze luminance falloff
    - Detect dark halos around shapes
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l = lab[:, :, 0].astype(np.float32)

    grad = cv2.Laplacian(l, cv2.CV_32F)
    strength = np.mean(np.abs(grad))

    if strength < 2:
        level = 0
    elif strength < 5:
        level = 1
    else:
        level = 2

    return {
        "elevation": level,
        "shadowStrength": round(float(strength), 2)
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
# Master extractor
# ------------------------------------------------------------

def extract_design_tokens(img):
    """
    Full lightweight extraction pass.
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
            "realtimeSafe": True
        }
    }


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
