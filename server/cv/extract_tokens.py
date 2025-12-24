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


def encode_image_base64(img, max_size=256):
    """
    Encode an image as base64 JPEG for visualization.
    Resizes to max_size for bandwidth efficiency.
    """
    if img is None:
        return None
    
    h, w = img.shape[:2] if len(img.shape) >= 2 else (0, 0)
    if w > max_size or h > max_size:
        scale = max_size / max(w, h)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    
    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"


def create_color_palette_visual(colors_rgb, img_shape):
    """
    Create a horizontal palette bar showing extracted colors.
    """
    height = 60
    width = 256
    bar = np.zeros((height, width, 3), dtype=np.uint8)
    
    if len(colors_rgb) == 0:
        return bar
    
    stripe_width = width // len(colors_rgb)
    for i, color in enumerate(colors_rgb):
        x_start = i * stripe_width
        x_end = (i + 1) * stripe_width if i < len(colors_rgb) - 1 else width
        bar[:, x_start:x_end] = color
    
    return bar


def create_histogram_visual(data, title="", bins=50):
    """
    Create a simple histogram visualization.
    """
    height, width = 100, 256
    hist_img = np.ones((height, width, 3), dtype=np.uint8) * 40
    
    if len(data) == 0:
        return hist_img
    
    hist, bin_edges = np.histogram(data, bins=min(bins, len(data)))
    if hist.max() > 0:
        hist = (hist / hist.max() * (height - 10)).astype(int)
    
    bin_width = width // len(hist)
    for i, h in enumerate(hist):
        x1 = i * bin_width
        x2 = (i + 1) * bin_width
        y1 = height - h - 5
        y2 = height - 5
        cv2.rectangle(hist_img, (x1, y2), (x2, y1), (100, 180, 255), -1)
    
    return hist_img


def _percentile_normalize(x):
    """
    Normalize array to [0,1] using 2nd/98th percentile for robustness.
    """
    x = x.astype(np.float32)
    mn, mx = np.percentile(x, 2), np.percentile(x, 98)
    if mx - mn < 1e-6:
        return np.zeros_like(x)
    return np.clip((x - mn) / (mx - mn), 0, 1)


def heuristic_depth(image_bgr):
    """
    Estimate depth from a single image using multi-cue fusion.
    
    Combines three heuristic cues:
    1. Sharpness/focus - sharp areas appear closer
    2. Shadow near edges - shadows suggest depth layers
    3. Perspective prior - bottom of image typically closer
    
    Returns:
        depth: float32 HxW in [0..1] (1 = near/foreground)
        debug_maps: dict of intermediate cue visualizations
    """
    h, w = image_bgr.shape[:2]
    
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    
    lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    sharp = cv2.GaussianBlur(np.abs(lap), (0, 0), 1.0)
    sharp = _percentile_normalize(sharp)
    
    edges = cv2.Canny(gray, 80, 160)
    
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    shadow = blur < (np.mean(blur) * 0.7)
    shadow = shadow.astype(np.float32)
    
    kernel = np.ones((5, 5), np.uint8)
    edge_dilate = cv2.dilate(edges, kernel)
    shadow = shadow * (edge_dilate > 0)
    shadow = _percentile_normalize(shadow)
    
    y = np.linspace(1.0, 0.0, h, dtype=np.float32)
    persp = np.repeat(y[:, None], w, axis=1)
    
    depth = (
        0.45 * sharp +
        0.35 * shadow +
        0.20 * persp
    )
    depth = _percentile_normalize(depth)
    
    debug = {
        "sharpness": sharp,
        "shadow": shadow,
        "perspective": persp,
        "edges": edges
    }
    
    return depth, debug


def create_depth_visualization(depth_map, colormap=cv2.COLORMAP_PLASMA):
    """
    Convert depth map to colorized visualization.
    Plasma colormap: purple=far, yellow=near
    """
    depth_uint8 = (depth_map * 255).astype(np.uint8)
    return cv2.applyColorMap(depth_uint8, colormap)


# ------------------------------------------------------------
# Color Analysis Utilities (using coloraide)
# ------------------------------------------------------------

def analyze_color_harmony(colors):
    """
    Analyze color palette for harmony relationships.
    
    Detects: complementary, analogous, triadic, split-complementary,
    tetradic, monochromatic based on hue angle relationships.
    
    Args:
        colors: List of coloraide Color objects in OKLCH
    
    Returns:
        dict with harmony type, strength score, and relationships
    """
    if len(colors) < 2:
        return {"type": "monochromatic", "strength": 1.0, "relationships": []}
    
    chromatic = [c for c in colors if c['c'] > 0.02]
    if len(chromatic) < 2:
        return {"type": "achromatic", "strength": 1.0, "relationships": []}
    
    hues = []
    for c in chromatic:
        h = c['h']
        if h is not None and not np.isnan(h):
            hues.append(h % 360)
    
    if len(hues) < 2:
        return {"type": "monochromatic", "strength": 1.0, "relationships": []}
    
    hues = sorted(hues)
    hue_range = max(hues) - min(hues)
    if hue_range > 180:
        hue_range = 360 - hue_range
    
    relationships = []
    harmony_scores = {
        "monochromatic": 0,
        "analogous": 0,
        "complementary": 0,
        "split-complementary": 0,
        "triadic": 0,
        "tetradic": 0
    }
    
    for i, h1 in enumerate(hues):
        for h2 in hues[i+1:]:
            diff = abs(h1 - h2)
            if diff > 180:
                diff = 360 - diff
            
            if diff < 30:
                relationships.append({"type": "analogous", "hues": [h1, h2], "angle": diff})
                harmony_scores["analogous"] += 1
            elif 150 < diff < 210:
                relationships.append({"type": "complementary", "hues": [h1, h2], "angle": diff})
                harmony_scores["complementary"] += 1
            elif 110 < diff < 130:
                relationships.append({"type": "triadic", "hues": [h1, h2], "angle": diff})
                harmony_scores["triadic"] += 1
            elif 80 < diff < 100:
                relationships.append({"type": "tetradic", "hues": [h1, h2], "angle": diff})
                harmony_scores["tetradic"] += 1
    
    if hue_range < 15:
        harmony_type = "monochromatic"
        strength = 1.0 - (hue_range / 15)
    elif harmony_scores["complementary"] > 0 and harmony_scores["analogous"] > 0:
        harmony_type = "split-complementary"
        strength = 0.8
    elif harmony_scores["complementary"] >= harmony_scores["analogous"]:
        if harmony_scores["complementary"] > 0:
            harmony_type = "complementary"
            strength = min(1.0, harmony_scores["complementary"] / len(hues))
        else:
            harmony_type = "analogous"
            strength = 0.5
    elif harmony_scores["triadic"] >= 2:
        harmony_type = "triadic"
        strength = min(1.0, harmony_scores["triadic"] / 3)
    elif harmony_scores["tetradic"] >= 3:
        harmony_type = "tetradic"
        strength = min(1.0, harmony_scores["tetradic"] / 4)
    else:
        harmony_type = "analogous"
        strength = min(1.0, harmony_scores["analogous"] / max(1, len(hues) - 1))
    
    return {
        "type": harmony_type,
        "strength": round(strength, 2),
        "hueRange": round(hue_range, 1),
        "relationships": relationships[:5]
    }


def calculate_contrast_ratio(color1, color2):
    """
    Calculate WCAG 2.1 contrast ratio between two colors.
    
    Args:
        color1, color2: coloraide Color objects
    
    Returns:
        float contrast ratio (1:1 to 21:1)
    """
    def relative_luminance(c):
        rgb = c.convert("srgb")
        r, g, b = rgb['red'], rgb['green'], rgb['blue']
        
        def linearize(v):
            if v <= 0.03928:
                return v / 12.92
            return ((v + 0.055) / 1.055) ** 2.4
        
        r = linearize(max(0, min(1, r)))
        g = linearize(max(0, min(1, g)))
        b = linearize(max(0, min(1, b)))
        
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    
    l1 = relative_luminance(color1)
    l2 = relative_luminance(color2)
    
    lighter = max(l1, l2)
    darker = min(l1, l2)
    
    return (lighter + 0.05) / (darker + 0.05)


def analyze_contrast_pairs(colors):
    """
    Analyze WCAG contrast ratios between all color pairs.
    
    Returns matrix of contrast ratios and accessibility flags.
    """
    if len(colors) < 2:
        return {"pairs": [], "accessibilityScore": 1.0}
    
    pairs = []
    aa_pass = 0
    aaa_pass = 0
    total_pairs = 0
    
    for i, c1 in enumerate(colors):
        for j, c2 in enumerate(colors[i+1:], i+1):
            ratio = calculate_contrast_ratio(c1, c2)
            
            aa_normal = ratio >= 4.5
            aa_large = ratio >= 3.0
            aaa_normal = ratio >= 7.0
            aaa_large = ratio >= 4.5
            
            pairs.append({
                "color1Index": i,
                "color2Index": j,
                "ratio": round(ratio, 2),
                "wcag": {
                    "AA_normal": aa_normal,
                    "AA_large": aa_large,
                    "AAA_normal": aaa_normal,
                    "AAA_large": aaa_large
                }
            })
            
            total_pairs += 1
            if aa_normal:
                aa_pass += 1
            if aaa_normal:
                aaa_pass += 1
    
    accessibility_score = aa_pass / total_pairs if total_pairs > 0 else 0
    
    return {
        "pairs": pairs,
        "summary": {
            "totalPairs": total_pairs,
            "aaPassCount": aa_pass,
            "aaaPassCount": aaa_pass,
            "accessibilityScore": round(accessibility_score, 2)
        }
    }


def analyze_color_temperature(colors):
    """
    Classify color palette temperature as warm, cool, or neutral.
    
    Uses hue angle: 0-60 and 300-360 = warm, 120-240 = cool
    """
    if len(colors) == 0:
        return {"temperature": "neutral", "warmRatio": 0.5, "dominantTone": "neutral"}
    
    warm_weight = 0
    cool_weight = 0
    neutral_weight = 0
    total_weight = 0
    
    for c in colors:
        chroma = c['c']
        if chroma < 0.02:
            neutral_weight += 1
            total_weight += 1
            continue
        
        hue = c['h']
        if hue is None or np.isnan(hue):
            neutral_weight += 1
            total_weight += 1
            continue
        
        hue = hue % 360
        weight = chroma
        
        if hue <= 60 or hue >= 300:
            warm_weight += weight
        elif 120 <= hue <= 240:
            cool_weight += weight
        else:
            warm_dist = min(abs(hue - 60), abs(hue - 300))
            cool_dist = min(abs(hue - 120), abs(hue - 240))
            if warm_dist < cool_dist:
                warm_weight += weight * 0.5
            else:
                cool_weight += weight * 0.5
        
        total_weight += weight
    
    if total_weight == 0:
        return {"temperature": "neutral", "warmRatio": 0.5, "dominantTone": "neutral"}
    
    warm_ratio = warm_weight / total_weight
    cool_ratio = cool_weight / total_weight
    
    if warm_ratio > 0.6:
        temperature = "warm"
        dominant = "warm"
    elif cool_ratio > 0.6:
        temperature = "cool"
        dominant = "cool"
    elif abs(warm_ratio - cool_ratio) < 0.2:
        temperature = "neutral"
        dominant = "balanced"
    elif warm_ratio > cool_ratio:
        temperature = "warm-neutral"
        dominant = "warm"
    else:
        temperature = "cool-neutral"
        dominant = "cool"
    
    return {
        "temperature": temperature,
        "warmRatio": round(warm_ratio, 2),
        "coolRatio": round(cool_ratio, 2),
        "dominantTone": dominant
    }


def create_harmony_wheel_visual(colors, size=256):
    """
    Create a color wheel visualization showing palette positions and harmony lines.
    """
    img = np.ones((size, size, 3), dtype=np.uint8) * 40
    center = size // 2
    radius = size // 2 - 20
    
    for angle in range(0, 360, 1):
        rad = np.radians(angle)
        for r in range(radius - 30, radius):
            x = int(center + r * np.cos(rad))
            y = int(center - r * np.sin(rad))
            if 0 <= x < size and 0 <= y < size:
                hue_color = Color(f"oklch(0.7 0.15 {angle})").convert("srgb")
                img[y, x] = [
                    max(0, min(255, int(hue_color['blue'] * 255))),
                    max(0, min(255, int(hue_color['green'] * 255))),
                    max(0, min(255, int(hue_color['red'] * 255)))
                ]
    
    color_positions = []
    for c in colors:
        if c['c'] < 0.02:
            continue
        hue = c['h']
        if hue is None or np.isnan(hue):
            continue
        
        rad = np.radians(hue)
        marker_r = radius - 15
        x = int(center + marker_r * np.cos(rad))
        y = int(center - marker_r * np.sin(rad))
        color_positions.append((x, y, hue))
        
        rgb = c.convert("srgb")
        color_bgr = (
            max(0, min(255, int(rgb['blue'] * 255))),
            max(0, min(255, int(rgb['green'] * 255))),
            max(0, min(255, int(rgb['red'] * 255)))
        )
        cv2.circle(img, (x, y), 8, color_bgr, -1)
        cv2.circle(img, (x, y), 8, (255, 255, 255), 2)
    
    if len(color_positions) >= 2:
        for i in range(len(color_positions)):
            x1, y1, h1 = color_positions[i]
            x2, y2, h2 = color_positions[(i + 1) % len(color_positions)]
            
            diff = abs(h1 - h2)
            if diff > 180:
                diff = 360 - diff
            
            if 150 < diff < 210:
                cv2.line(img, (x1, y1), (x2, y2), (100, 100, 255), 1)
    
    return img


def create_contrast_matrix_visual(colors, contrasts):
    """
    Create a visual matrix showing contrast ratios between colors.
    """
    n = len(colors)
    if n < 2:
        return np.ones((100, 100, 3), dtype=np.uint8) * 40
    
    cell_size = min(40, 256 // n)
    size = n * cell_size
    img = np.ones((size, size, 3), dtype=np.uint8) * 40
    
    for i, c in enumerate(colors):
        rgb = c.convert("srgb")
        color_bgr = (
            max(0, min(255, int(rgb['blue'] * 255))),
            max(0, min(255, int(rgb['green'] * 255))),
            max(0, min(255, int(rgb['red'] * 255)))
        )
        cv2.rectangle(img, (i * cell_size, 0), ((i + 1) * cell_size, cell_size // 3), color_bgr, -1)
        cv2.rectangle(img, (0, i * cell_size), (cell_size // 3, (i + 1) * cell_size), color_bgr, -1)
    
    for pair in contrasts.get("pairs", []):
        i, j = pair["color1Index"], pair["color2Index"]
        ratio = pair["ratio"]
        
        if ratio >= 7:
            cell_color = (80, 180, 80)
        elif ratio >= 4.5:
            cell_color = (80, 180, 180)
        elif ratio >= 3:
            cell_color = (80, 140, 200)
        else:
            cell_color = (80, 80, 120)
        
        x1 = j * cell_size + cell_size // 3
        y1 = i * cell_size + cell_size // 3
        x2 = (j + 1) * cell_size
        y2 = (i + 1) * cell_size
        cv2.rectangle(img, (x1, y1), (x2, y2), cell_color, -1)
    
    return img


# ------------------------------------------------------------
# Color Tokens
# ------------------------------------------------------------

def extract_colors(img, k=12):
    """
    Extract dominant perceptual colors with harmony, contrast, and temperature analysis.

    Strategy:
    - Downscale
    - K-means clustering in RGB
    - Convert to OKLCH
    - Deduplicate by Delta-E
    - Analyze harmony relationships
    - Calculate WCAG contrast ratios
    - Determine color temperature
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
    
    unique_8 = unique[:8]
    
    harmony = analyze_color_harmony(unique_8)
    contrasts = analyze_contrast_pairs(unique_8)
    temperature = analyze_color_temperature(unique_8)

    result = []
    for c in unique_8:
        hue = c['h']
        if hue is None or (isinstance(hue, float) and np.isnan(hue)):
            hue = 0
        result.append({
            "space": "oklch",
            "l": round(c['l'], 3),
            "c": round(c['c'], 3),
            "h": round(hue, 1)
        })
    return {
        "colors": result,
        "analysis": {
            "harmony": harmony,
            "contrast": contrasts,
            "temperature": temperature
        }
    }


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
    
    color_result = extract_colors(img_resized)

    return {
        "color": color_result["colors"],
        "colorAnalysis": color_result["analysis"],
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
            if name == "color":
                results["color"] = result["colors"]
                results["colorAnalysis"] = result["analysis"]
            else:
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


# ------------------------------------------------------------
# Walkthrough-enabled extractors with visualizations
# ------------------------------------------------------------

def extract_colors_with_debug(img, k=12):
    """
    Extract colors with intermediate visualizations for walkthrough.
    Includes harmony analysis, WCAG contrast ratios, and temperature classification.
    """
    img_small = resize_for_speed(img)
    pixels = img_small.reshape(-1, 3).astype(np.float32)

    _, labels, centers = cv2.kmeans(
        pixels, k, None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0),
        3, cv2.KMEANS_PP_CENTERS
    )

    counts = np.bincount(labels.flatten())
    ranked = centers[np.argsort(-counts)]
    
    cluster_map = labels.reshape(img_small.shape[:2])
    cluster_vis = np.zeros_like(img_small)
    for i in range(k):
        cluster_vis[cluster_map == i] = ranked[min(i, len(ranked)-1)]
    
    colors_rgb = [(int(c[2]), int(c[1]), int(c[0])) for c in ranked[:8]]
    palette_bar = create_color_palette_visual(
        [(c[2], c[1], c[0]) for c in ranked[:8]],  
        img_small.shape
    )

    colors = []
    for c in ranked:
        col = Color(f"rgb({int(c[2])},{int(c[1])},{int(c[0])})").convert("oklch")
        colors.append(col)

    unique = []
    for c in colors:
        if not any(c.delta_e(u) < 3 for u in unique):
            unique.append(c)
    
    unique_8 = unique[:8]
    
    harmony = analyze_color_harmony(unique_8)
    contrasts = analyze_contrast_pairs(unique_8)
    temperature = analyze_color_temperature(unique_8)
    
    harmony_wheel = create_harmony_wheel_visual(unique_8)
    contrast_matrix = create_contrast_matrix_visual(unique_8, contrasts)

    result = []
    for c in unique_8:
        hue = c['h']
        if hue is None or (isinstance(hue, float) and np.isnan(hue)):
            hue = 0
        result.append({
            "space": "oklch",
            "l": round(c['l'], 3),
            "c": round(c['c'], 3),
            "h": round(hue, 1)
        })
    
    return {
        "tokens": result,
        "analysis": {
            "harmony": harmony,
            "contrast": contrasts,
            "temperature": temperature
        },
        "debug": {
            "visuals": [
                {"label": "Color Clusters", "description": "Image recolored using only the detected color clusters", "image": encode_image_base64(cluster_vis)},
                {"label": "Extracted Palette", "description": "The final color palette after deduplication", "image": encode_image_base64(palette_bar)},
                {"label": "Harmony Wheel", "description": f"Color positions on the wheel - {harmony['type']} harmony detected", "image": encode_image_base64(harmony_wheel)},
                {"label": "Contrast Matrix", "description": f"WCAG contrast ratios - {contrasts['summary']['aaPassCount']}/{contrasts['summary']['totalPairs']} pairs pass AA", "image": encode_image_base64(contrast_matrix)},
            ],
            "steps": [
                "We shrink the image to speed up processing",
                "K-means clustering groups similar pixels into color families",
                "We count how often each color appears and rank by popularity",
                "Colors are converted to OKLCH (a perceptual color space)",
                "Very similar colors (Delta-E < 3) are merged to avoid duplicates",
                "The top 8 unique colors become your palette",
                f"HARMONY: Hue angles are analyzed - detected '{harmony['type']}' with {harmony['strength']*100:.0f}% strength",
                f"CONTRAST: All {contrasts['summary']['totalPairs']} color pairs checked for WCAG compliance",
                f"TEMPERATURE: Palette is '{temperature['temperature']}' (warm ratio: {temperature['warmRatio']*100:.0f}%)"
            ]
        }
    }


def extract_spacing_with_debug(img):
    """
    Extract spacing with intermediate visualizations.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    bbox_vis = img.copy()
    gaps = []
    boxes = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 100]
    
    for x, y, w, h in boxes:
        cv2.rectangle(bbox_vis, (x, y), (x + w, y + h), (0, 255, 0), 1)
    
    boxes.sort(key=lambda b: (b[1], b[0]))
    for i in range(len(boxes) - 1):
        x1, y1, w1, h1 = boxes[i]
        x2, y2, w2, h2 = boxes[i + 1]
        hgap = max(0, x2 - (x1 + w1))
        vgap = max(0, y2 - (y1 + h1))
        if 2 < hgap < 100:
            gaps.append(hgap)
        if 2 < vgap < 100:
            gaps.append(vgap)
    
    gap_hist = create_histogram_visual(gaps, "Spacing Distribution")
    
    snap = [4, 8, 12, 16, 20, 24, 32, 48, 64]
    result = quantize_values(gaps[:100], snap) if gaps else [8, 16, 24]
    
    return {
        "tokens": result,
        "debug": {
            "visuals": [
                {"label": "Edge Detection", "description": "Edges found using Canny algorithm", "image": encode_image_base64(edges)},
                {"label": "Bounding Boxes", "description": "Detected elements with their boundaries", "image": encode_image_base64(bbox_vis)},
                {"label": "Spacing Histogram", "description": "Distribution of gaps between elements", "image": encode_image_base64(gap_hist)},
            ],
            "steps": [
                "We find edges in the image using the Canny edge detector",
                "White/light areas are identified as potential element boundaries",
                "Contours are traced to find distinct elements",
                "We measure horizontal and vertical gaps between elements",
                "Gap sizes are snapped to common design system values (4, 8, 16, etc.)",
                "Repeated patterns suggest your spacing scale"
            ]
        }
    }


def extract_border_radius_with_debug(img):
    """
    Extract border radius with intermediate visualizations.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    contour_vis = img.copy()
    cv2.drawContours(contour_vis, contours, -1, (0, 255, 0), 1)
    
    corner_vis = img.copy()
    radii = []
    
    for contour in contours:
        if len(contour) < 8:
            continue
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        for i in range(len(approx)):
            p1 = approx[i - 1][0]
            p2 = approx[i][0]
            p3 = approx[(i + 1) % len(approx)][0]
            
            cv2.circle(corner_vis, tuple(p2), 3, (255, 0, 0), -1)
            
            v1 = np.array(p1) - np.array(p2)
            v2 = np.array(p3) - np.array(p2)
            
            dot = np.dot(v1, v2)
            mag = np.linalg.norm(v1) * np.linalg.norm(v2)
            if mag > 0:
                angle = np.arccos(np.clip(dot / mag, -1, 1))
                if 1.2 < angle < 2.0:
                    r = min(np.linalg.norm(v1), np.linalg.norm(v2)) * 0.3
                    radii.append(r)
    
    snap = [0, 2, 4, 8, 12, 16, 24, 32]
    result = quantize_values(radii[:50], snap) if radii else [0, 4, 8]
    
    return {
        "tokens": result,
        "debug": {
            "visuals": [
                {"label": "Canny Edges", "description": "Edge detection highlights shape boundaries", "image": encode_image_base64(edges)},
                {"label": "Contours", "description": "Traced outlines of detected shapes", "image": encode_image_base64(contour_vis)},
                {"label": "Corner Points", "description": "Detected corners where radius is measured", "image": encode_image_base64(corner_vis)},
            ],
            "steps": [
                "Edge detection finds shape boundaries",
                "Contours trace the outline of each shape",
                "We simplify contours to find corner points",
                "The angle at each corner indicates roundness",
                "Sharper corners suggest smaller radius, softer corners suggest larger",
                "Common radii are snapped to design-friendly values"
            ]
        }
    }


def extract_grid_with_debug(img):
    """
    Extract grid with projection profile visualizations.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    h_proj = np.sum(edges, axis=0)
    v_proj = np.sum(edges, axis=1)
    
    h_proj_vis = np.ones((100, len(h_proj), 3), dtype=np.uint8) * 40
    v_proj_vis = np.ones((len(v_proj), 100, 3), dtype=np.uint8) * 40
    
    if h_proj.max() > 0:
        h_norm = (h_proj / h_proj.max() * 90).astype(int)
        for x, val in enumerate(h_norm):
            cv2.line(h_proj_vis, (x, 99), (x, 99 - val), (100, 180, 255), 1)
    
    if v_proj.max() > 0:
        v_norm = (v_proj / v_proj.max() * 90).astype(int)
        for y, val in enumerate(v_norm):
            cv2.line(v_proj_vis, (0, y), (val, y), (255, 180, 100), 1)
    
    h_proj_vis = cv2.resize(h_proj_vis, (256, 100))
    v_proj_vis = cv2.resize(v_proj_vis, (100, 256))
    v_proj_vis = cv2.rotate(v_proj_vis, cv2.ROTATE_90_COUNTERCLOCKWISE)
    
    h_peaks = []
    threshold = np.mean(h_proj) + np.std(h_proj)
    for i in range(1, len(h_proj) - 1):
        if h_proj[i] > threshold and h_proj[i] > h_proj[i-1] and h_proj[i] > h_proj[i+1]:
            h_peaks.append(i)
    
    h_gaps = [h_peaks[i+1] - h_peaks[i] for i in range(len(h_peaks)-1)] if len(h_peaks) > 1 else []
    
    result = {
        "columns": 12 if len(h_peaks) >= 12 else max(1, len(h_peaks)),
        "gutter": int(np.median(h_gaps)) if h_gaps else 16
    }
    
    return {
        "tokens": result,
        "debug": {
            "visuals": [
                {"label": "Edge Map", "description": "Edges used for grid detection", "image": encode_image_base64(edges)},
                {"label": "Horizontal Projection", "description": "Vertical lines create peaks here - columns", "image": encode_image_base64(h_proj_vis)},
                {"label": "Vertical Projection", "description": "Horizontal lines create peaks here - rows", "image": encode_image_base64(v_proj_vis)},
            ],
            "steps": [
                "Edge detection highlights structural lines",
                "Horizontal projection sums edges in each column",
                "Peaks in horizontal projection indicate vertical grid lines",
                "Vertical projection sums edges in each row",
                "The spacing between peaks suggests column/gutter sizes",
                "We estimate grid structure from these patterns"
            ]
        }
    }


def extract_shadows_with_debug(img):
    """
    Extract shadow/elevation with enhanced multi-cue depth estimation.
    
    Uses three complementary approaches:
    1. Gradient-based shadow detection (traditional)
    2. Multi-cue heuristic depth (sharpness + shadow + perspective)
    3. Luminance distribution analysis
    
    Returns tokens plus comprehensive debug visualizations.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel = lab[:, :, 0].astype(np.float32)
    h, w = img.shape[:2]
    
    depth_map, depth_debug = heuristic_depth(img)
    
    grad_x = cv2.Sobel(l_channel, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(l_channel, cv2.CV_32F, 0, 1, ksize=3)
    
    laplacian = cv2.Laplacian(l_channel, cv2.CV_32F)
    strength = float(np.mean(np.abs(laplacian)))
    
    avg_depth = float(np.mean(depth_map))
    depth_variance = float(np.var(depth_map))
    
    if depth_variance < 0.02:
        level = 0
    elif depth_variance < 0.05:
        level = 1
    elif depth_variance < 0.12:
        level = 2
    else:
        level = 3
    
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    threshold = np.percentile(magnitude, 90)
    strong_grads = magnitude > threshold
    
    if np.sum(strong_grads) > 0:
        avg_grad_x = float(np.mean(grad_x[strong_grads]))
        avg_grad_y = float(np.mean(grad_y[strong_grads]))
        angle = float(np.degrees(np.arctan2(avg_grad_y, avg_grad_x)))
        
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
        angle = 0.0
    
    mag_norm = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    mag_color = cv2.applyColorMap(mag_norm, cv2.COLORMAP_INFERNO)
    
    arrow_vis = img.copy()
    center = (w // 2, h // 2)
    arrow_len = min(w, h) // 4
    rad_angle = np.radians(angle)
    end_x = int(center[0] + arrow_len * np.cos(rad_angle))
    end_y = int(center[1] + arrow_len * np.sin(rad_angle))
    cv2.arrowedLine(arrow_vis, center, (end_x, end_y), (255, 255, 0), 3, tipLength=0.3)
    
    edges = cv2.Canny(l_channel.astype(np.uint8), 50, 150)
    dist_transform = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 5)
    blur_samples = dist_transform[dist_transform > 0]
    if len(blur_samples) > 0:
        blur_radius = float(round(np.median(blur_samples), 1))
    else:
        blur_radius = 0.0
    blur_radius = min(blur_radius, 24.0)
    
    hist = cv2.calcHist([l_channel.astype(np.uint8)], [0], None, [256], [0, 256])
    hist = hist.flatten() / hist.sum()
    
    dark_ratio = float(np.sum(hist[:85]))
    mid_ratio = float(np.sum(hist[85:170]))
    light_ratio = float(np.sum(hist[170:]))
    
    hist_vis = np.ones((100, 256, 3), dtype=np.uint8) * 40
    hist_norm = (hist / hist.max() * 90).astype(int)
    for x, val in enumerate(hist_norm):
        cv2.line(hist_vis, (x, 99), (x, 99 - val), (200, 200, 200), 1)
    
    contrast = float(np.std(l_channel))
    
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
            shadow_hue = shadow_color['h']
            if shadow_hue is None or np.isnan(shadow_hue):
                shadow_hue = 0
            shadow_color_data = {
                "space": "oklch",
                "l": round(float(shadow_color['l']), 3),
                "c": round(float(shadow_color['c']), 3),
                "h": round(float(shadow_hue), 1)
            }
        else:
            shadow_color_data = None
    else:
        shadow_color_data = None
    
    depth_vis = create_depth_visualization(depth_map)
    sharpness_vis = cv2.applyColorMap((depth_debug["sharpness"] * 255).astype(np.uint8), cv2.COLORMAP_HOT)
    shadow_cue_vis = cv2.applyColorMap((depth_debug["shadow"] * 255).astype(np.uint8), cv2.COLORMAP_BONE)
    perspective_vis = cv2.applyColorMap((depth_debug["perspective"] * 255).astype(np.uint8), cv2.COLORMAP_COOL)
    edge_vis = cv2.cvtColor(depth_debug["edges"], cv2.COLOR_GRAY2BGR)
    
    result = {
        "elevation": level,
        "shadowStrength": round(strength, 2),
        "direction": direction,
        "directionAngle": round(angle, 1),
        "blurRadius": blur_radius,
        "contrast": round(contrast, 1),
        "depthStyle": depth_style,
        "distribution": {
            "dark": round(dark_ratio, 2),
            "mid": round(mid_ratio, 2),
            "light": round(light_ratio, 2)
        },
        "shadowColor": shadow_color_data,
        "depthMetrics": {
            "averageDepth": round(avg_depth, 3),
            "depthVariance": round(depth_variance, 4),
            "hasDepthLayers": depth_variance > 0.03
        }
    }
    
    return {
        "tokens": result,
        "debug": {
            "visuals": [
                {"label": "Combined Depth Map", "description": "Final depth estimate: yellow=near, purple=far", "image": encode_image_base64(depth_vis)},
                {"label": "Sharpness Cue", "description": "Focus/sharpness map - sharp areas appear closer", "image": encode_image_base64(sharpness_vis)},
                {"label": "Shadow Cue", "description": "Shadow regions near edges suggest depth separation", "image": encode_image_base64(shadow_cue_vis)},
                {"label": "Perspective Prior", "description": "Bottom of image assumed closer (vertical gradient)", "image": encode_image_base64(perspective_vis)},
                {"label": "Edge Detection", "description": "Edges used for shadow proximity analysis", "image": encode_image_base64(edge_vis)},
                {"label": "Gradient Magnitude", "description": "Intensity of light/dark transitions", "image": encode_image_base64(mag_color)},
                {"label": "Shadow Direction", "description": "Arrow shows dominant light source direction", "image": encode_image_base64(arrow_vis)},
                {"label": "Luminance Histogram", "description": "Distribution of light and dark values", "image": encode_image_base64(hist_vis)},
            ],
            "steps": [
                "Three heuristic cues are combined for depth estimation:",
                "1. SHARPNESS (45%): We use Laplacian edge detection to find sharp/in-focus areas - these appear closer to the viewer",
                "2. SHADOW NEAR EDGES (35%): Dark regions adjacent to detected edges suggest shadows cast by elevated elements",
                "3. PERSPECTIVE PRIOR (20%): Bottom of image is assumed closer (common in photos/UI)",
                "The three maps are weighted and combined into a unified depth estimate",
                "We also analyze gradient direction to determine where light is coming from",
                "Luminance histogram reveals the overall dark/mid/light balance",
                "Depth variance indicates whether the image has distinct layers or is flat"
            ]
        }
    }


def extract_strokes_with_debug(img):
    """
    Extract stroke widths with skeleton and distance transform visualizations.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_OTSU)
    binary_inv = 255 - binary
    
    dist = cv2.distanceTransform(binary_inv, cv2.DIST_L2, 5)
    dist_norm = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    dist_color = cv2.applyColorMap(dist_norm, cv2.COLORMAP_JET)
    
    kernel = np.ones((3, 3), np.uint8)
    eroded = cv2.erode(binary_inv, kernel, iterations=1)
    skeleton = cv2.subtract(binary_inv, eroded)
    
    skeleton_vis = cv2.cvtColor(skeleton, cv2.COLOR_GRAY2BGR)
    skeleton_vis[skeleton > 0] = [0, 255, 255]
    
    overlay = img.copy()
    overlay[skeleton > 0] = [0, 255, 255]
    
    widths = dist[skeleton > 0]
    
    if len(widths) == 0 or np.max(widths) < 0.5:
        edges = cv2.Canny(gray, 50, 150)
        dilated = cv2.dilate(edges, kernel, iterations=2)
        dist_from_edges = cv2.distanceTransform(dilated, cv2.DIST_L2, 5)
        widths = dist_from_edges[dist_from_edges > 0]
    
    full_widths = [w * 2 for w in widths.tolist()[:200]] if len(widths) > 0 else [1]
    
    snap = [1, 2, 3, 4, 6, 8]
    result = quantize_values(full_widths, snap)
    
    return {
        "tokens": result,
        "debug": {
            "visuals": [
                {"label": "Binary Threshold", "description": "Image separated into foreground/background", "image": encode_image_base64(binary)},
                {"label": "Distance Transform", "description": "Distance from edges - brighter = thicker strokes", "image": encode_image_base64(dist_color)},
                {"label": "Skeleton Overlay", "description": "Center lines of strokes (yellow)", "image": encode_image_base64(overlay)},
            ],
            "steps": [
                "Otsu thresholding separates foreground from background",
                "Distance transform measures how far each pixel is from an edge",
                "Skeleton extraction finds the center line of shapes",
                "Stroke width = 2 × distance at skeleton points",
                "We sample stroke widths across the image",
                "Common widths are snapped to design system values"
            ]
        }
    }


def _run_extractor_with_debug(extractor_name, img_bytes, img_shape):
    """
    Worker function for parallel extraction with debug info.
    """
    img = np.frombuffer(img_bytes, dtype=np.uint8).reshape(img_shape)
    
    extractors = {
        "color": extract_colors_with_debug,
        "spacing": extract_spacing_with_debug,
        "borderRadius": extract_border_radius_with_debug,
        "grid": extract_grid_with_debug,
        "elevation": extract_shadows_with_debug,
        "strokeWidth": extract_strokes_with_debug,
    }
    
    extractor_fn = extractors[extractor_name]
    return extractor_name, extractor_fn(img)


def extract_design_tokens_with_walkthrough(img):
    """
    Full extraction with debug visualizations and explanations.
    Uses parallel processing for speed.
    """
    img_resized = resize_for_speed(img, 512)
    img_bytes = img_resized.tobytes()
    img_shape = img_resized.shape
    
    extractor_names = ["color", "spacing", "borderRadius", "grid", "elevation", "strokeWidth"]
    
    tokens = {}
    debug = {}
    color_analysis = None
    
    try:
        with ProcessPoolExecutor(max_workers=len(extractor_names)) as executor:
            futures = {
                executor.submit(_run_extractor_with_debug, name, img_bytes, img_shape): name
                for name in extractor_names
            }
            
            for future in as_completed(futures):
                name, result = future.result()
                tokens[name] = result["tokens"]
                debug[name] = result["debug"]
                if name == "color" and "analysis" in result:
                    color_analysis = result["analysis"]
    except Exception as e:
        for name in extractor_names:
            img_copy = np.frombuffer(img_bytes, dtype=np.uint8).reshape(img_shape)
            extractor = {
                "color": extract_colors_with_debug,
                "spacing": extract_spacing_with_debug,
                "borderRadius": extract_border_radius_with_debug,
                "grid": extract_grid_with_debug,
                "elevation": extract_shadows_with_debug,
                "strokeWidth": extract_strokes_with_debug,
            }[name]
            result = extractor(img_copy)
            tokens[name] = result["tokens"]
            debug[name] = result["debug"]
            if name == "color" and "analysis" in result:
                color_analysis = result["analysis"]
    
    tokens["colorAnalysis"] = color_analysis
    tokens["meta"] = {
        "method": "heuristic-cv",
        "confidence": "medium-high",
        "realtimeSafe": True,
        "parallel": True,
        "walkthrough": True
    }
    
    return {"tokens": tokens, "debug": debug}


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


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles numpy types."""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def main():
    """
    CLI entry point.
    Accepts either:
    - A file path as argument
    - Base64 data via stdin
    
    Flags:
    - --with-visuals: Include debug visualizations and step explanations
    """
    with_visuals = "--with-visuals" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    
    if len(args) > 0:
        file_path = args[0]
        img = load_image_from_file(file_path)
    else:
        data = sys.stdin.read()
        img = load_image_from_base64(data)

    if img is None:
        print(json.dumps({"error": "Failed to load image"}), file=sys.stderr)
        sys.exit(1)

    try:
        if with_visuals:
            result = extract_design_tokens_with_walkthrough(img)
            print(json.dumps(result, cls=NumpyEncoder))
        else:
            tokens = extract_design_tokens(img)
            print(json.dumps(tokens, cls=NumpyEncoder))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
