"""
Component Detection Module
CV-first approach with optional AI classification for UI component detection.

Detects likely UI components (buttons, knobs, sliders, cards, panels, etc.)
and their bounding boxes using deterministic CV heuristics.
"""

import cv2
import numpy as np
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
import time


@dataclass
class ShapeFeatures:
    """Shape-based features for a component candidate."""
    roundness: float = 0.0
    radius_hint: int = 0
    rectangularity: float = 0.0
    aspect_ratio: float = 1.0
    symmetry_h: float = 0.0
    symmetry_v: float = 0.0
    solidity: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class VisualFeatures:
    """Visual characteristics of a component candidate."""
    has_text: bool = False
    has_icon: bool = False
    has_gradient: bool = False
    dominant_colors: List[str] = field(default_factory=list)
    edge_strength: float = 0.0
    internal_complexity: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ComponentCandidate:
    """A detected UI component candidate."""
    id: str
    bbox: Tuple[int, int, int, int]
    shape: ShapeFeatures
    visual: VisualFeatures
    label: str = "unknown"
    confidence: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "bbox": list(self.bbox),
            "shape": self.shape.to_dict(),
            "visual": self.visual.to_dict(),
            "label": self.label,
            "confidence": self.confidence
        }


def preprocess_image(image: np.ndarray, max_size: int = 1024) -> Tuple[np.ndarray, float]:
    """Resize image to max dimension while preserving aspect ratio."""
    h, w = image.shape[:2]
    scale = 1.0
    
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    return image, scale


def compute_edge_map(gray: np.ndarray) -> np.ndarray:
    """Generate edge map using Canny with adaptive thresholds."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    median = np.median(blurred)
    lower = int(max(0, 0.67 * median))
    upper = int(min(255, 1.33 * median))
    edges = cv2.Canny(blurred, lower, upper)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    return edges


def find_component_contours(edges: np.ndarray, gray: np.ndarray, 
                            min_area: int = 400, max_area_ratio: float = 0.5) -> List[np.ndarray]:
    """Find contours that likely represent UI components."""
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    img_area = gray.shape[0] * gray.shape[1]
    max_area = img_area * max_area_ratio
    
    filtered = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if min_area <= area <= max_area:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect = max(w, h) / (min(w, h) + 1e-6)
            if aspect < 10:
                filtered.append(cnt)
    
    return filtered


def compute_shape_features(contour: np.ndarray, gray: np.ndarray) -> ShapeFeatures:
    """Extract shape-based features from a contour."""
    x, y, w, h = cv2.boundingRect(contour)
    area = cv2.contourArea(contour)
    rect_area = w * h
    
    perimeter = cv2.arcLength(contour, True)
    circularity = 4 * np.pi * area / (perimeter * perimeter + 1e-6) if perimeter > 0 else 0
    
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    solidity = area / (hull_area + 1e-6) if hull_area > 0 else 0
    
    rectangularity = area / (rect_area + 1e-6)
    
    aspect_ratio = w / (h + 1e-6)
    
    epsilon = 0.02 * perimeter
    approx = cv2.approxPolyDP(contour, epsilon, True)
    
    radius_hint = 0
    if len(approx) >= 4 and len(approx) <= 8:
        if rectangularity > 0.8:
            min_dim = min(w, h)
            radius_hint = int(min_dim * (1 - rectangularity) * 0.5)
    
    roi = gray[y:y+h, x:x+w] if w > 0 and h > 0 else np.array([[0]])
    
    sym_h = 0.0
    sym_v = 0.0
    if roi.size > 0:
        flipped_h = cv2.flip(roi, 1)
        flipped_v = cv2.flip(roi, 0)
        
        diff_h = np.abs(roi.astype(float) - flipped_h.astype(float))
        diff_v = np.abs(roi.astype(float) - flipped_v.astype(float))
        
        sym_h = 1.0 - (np.mean(diff_h) / 255.0)
        sym_v = 1.0 - (np.mean(diff_v) / 255.0)
    
    return ShapeFeatures(
        roundness=float(circularity),
        radius_hint=radius_hint,
        rectangularity=float(rectangularity),
        aspect_ratio=float(aspect_ratio),
        symmetry_h=float(sym_h),
        symmetry_v=float(sym_v),
        solidity=float(solidity)
    )


def compute_visual_features(image: np.ndarray, gray: np.ndarray, 
                           bbox: Tuple[int, int, int, int]) -> VisualFeatures:
    """Extract visual characteristics from a component region."""
    x, y, w, h = bbox
    roi_color = image[y:y+h, x:x+w] if w > 0 and h > 0 else np.zeros((1, 1, 3), dtype=np.uint8)
    roi_gray = gray[y:y+h, x:x+w] if w > 0 and h > 0 else np.array([[0]], dtype=np.uint8)
    
    laplacian = cv2.Laplacian(roi_gray, cv2.CV_64F)
    edge_strength = float(np.std(laplacian))
    
    internal_complexity = float(np.std(roi_gray) / 255.0)
    
    has_gradient = False
    if roi_gray.shape[0] > 5 and roi_gray.shape[1] > 5:
        grad_y = np.gradient(roi_gray.astype(float), axis=0)
        grad_consistency = np.std(np.diff(np.mean(grad_y, axis=1)))
        has_gradient = grad_consistency < 2.0 and np.abs(np.mean(grad_y)) > 0.5
    
    dominant_colors = []
    if roi_color.size > 0:
        pixels = roi_color.reshape(-1, 3)
        if len(pixels) > 0:
            unique, counts = np.unique(pixels, axis=0, return_counts=True)
            top_indices = np.argsort(counts)[-3:][::-1]
            for idx in top_indices:
                if idx < len(unique):
                    b, g, r = unique[idx]
                    dominant_colors.append(f"#{r:02x}{g:02x}{b:02x}")
    
    has_text = internal_complexity > 0.25 and edge_strength > 30
    
    has_icon = False
    if w > 16 and h > 16:
        center_roi = roi_gray[h//4:3*h//4, w//4:3*w//4]
        if center_roi.size > 0:
            center_complexity = np.std(center_roi)
            edge_roi_top = roi_gray[0:h//4, :]
            edge_roi_bottom = roi_gray[3*h//4:, :]
            if edge_roi_top.size > 0 and edge_roi_bottom.size > 0:
                edge_complexity = (np.std(edge_roi_top) + np.std(edge_roi_bottom)) / 2
                has_icon = center_complexity > edge_complexity * 1.5
    
    return VisualFeatures(
        has_text=has_text,
        has_icon=has_icon,
        has_gradient=has_gradient,
        dominant_colors=dominant_colors[:3],
        edge_strength=edge_strength,
        internal_complexity=internal_complexity
    )


def classify_component_heuristic(shape: ShapeFeatures, visual: VisualFeatures, 
                                  bbox: Tuple[int, int, int, int]) -> Tuple[str, float]:
    """Classify component type using deterministic heuristics."""
    x, y, w, h = bbox
    aspect = w / (h + 1e-6)
    
    if shape.roundness > 0.85 and 0.8 < aspect < 1.2:
        return ("knob", 0.75)
    
    if shape.roundness > 0.7 and shape.rectangularity < 0.6:
        if w < 60 and h < 60:
            return ("badge", 0.65)
        return ("knob", 0.6)
    
    if shape.rectangularity > 0.85:
        if 2.5 < aspect < 8 and h < 60:
            if visual.has_text:
                return ("button", 0.8)
            return ("slider", 0.65)
        
        if 0.8 < aspect < 1.5 and w < 80 and h < 80:
            return ("toggle", 0.6)
        
        if w > 150 and h > 100:
            return ("card", 0.7)
        
        if aspect > 3:
            return ("panel", 0.6)
        
        if h > w * 2:
            return ("slider", 0.55)
    
    if shape.rectangularity > 0.7 and visual.has_text:
        if h < 50:
            return ("tab", 0.6)
        return ("button", 0.65)
    
    if visual.has_icon and not visual.has_text:
        if w < 60 and h < 60:
            return ("button", 0.55)
    
    if w > 200 or h > 150:
        return ("panel", 0.5)
    
    return ("unknown", 0.3)


def cluster_overlapping_components(candidates: List[ComponentCandidate], 
                                   iou_threshold: float = 0.5) -> List[ComponentCandidate]:
    """Merge overlapping component candidates."""
    if not candidates:
        return []
    
    def compute_iou(box1: Tuple[int, int, int, int], 
                    box2: Tuple[int, int, int, int]) -> float:
        x1, y1, w1, h1 = box1
        x2, y2, w2, h2 = box2
        
        xi1 = max(x1, x2)
        yi1 = max(y1, y2)
        xi2 = min(x1 + w1, x2 + w2)
        yi2 = min(y1 + h1, y2 + h2)
        
        if xi2 <= xi1 or yi2 <= yi1:
            return 0.0
        
        intersection = (xi2 - xi1) * (yi2 - yi1)
        union = w1 * h1 + w2 * h2 - intersection
        
        return intersection / (union + 1e-6)
    
    sorted_candidates = sorted(candidates, key=lambda c: -c.confidence)
    keep = []
    
    for candidate in sorted_candidates:
        should_keep = True
        for kept in keep:
            if compute_iou(candidate.bbox, kept.bbox) > iou_threshold:
                should_keep = False
                break
        if should_keep:
            keep.append(candidate)
    
    return keep


def detect_components(image: np.ndarray, 
                      max_size: int = 1024,
                      min_area: int = 400,
                      enable_classification: bool = True) -> Dict[str, Any]:
    """
    Main component detection pipeline.
    
    Args:
        image: BGR image as numpy array
        max_size: Maximum dimension for processing
        min_area: Minimum component area in pixels
        enable_classification: Whether to run heuristic classification
        
    Returns:
        Dictionary with candidates, timing, and metadata
    """
    start_time = time.time()
    timings = {}
    
    t0 = time.time()
    processed, scale = preprocess_image(image, max_size)
    timings["preprocess_ms"] = (time.time() - t0) * 1000
    
    if len(processed.shape) == 2:
        gray = processed
        color = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
    else:
        gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
        color = processed
    
    t0 = time.time()
    edges = compute_edge_map(gray)
    timings["edge_detection_ms"] = (time.time() - t0) * 1000
    
    t0 = time.time()
    contours = find_component_contours(edges, gray, min_area)
    timings["contour_finding_ms"] = (time.time() - t0) * 1000
    
    candidates = []
    t0 = time.time()
    
    for i, contour in enumerate(contours):
        x, y, w, h = cv2.boundingRect(contour)
        bbox = (x, y, w, h)
        
        shape = compute_shape_features(contour, gray)
        visual = compute_visual_features(color, gray, bbox)
        
        label = "unknown"
        confidence = 0.0
        
        if enable_classification:
            label, confidence = classify_component_heuristic(shape, visual, bbox)
        
        orig_bbox = (
            int(x / scale),
            int(y / scale),
            int(w / scale),
            int(h / scale)
        )
        
        candidate = ComponentCandidate(
            id=f"c{i}",
            bbox=orig_bbox,
            shape=shape,
            visual=visual,
            label=label,
            confidence=confidence
        )
        candidates.append(candidate)
    
    timings["feature_extraction_ms"] = (time.time() - t0) * 1000
    
    t0 = time.time()
    candidates = cluster_overlapping_components(candidates)
    
    for i, c in enumerate(candidates):
        c.id = f"c{i}"
    
    timings["clustering_ms"] = (time.time() - t0) * 1000
    
    total_time = (time.time() - start_time) * 1000
    timings["total_ms"] = total_time
    
    return {
        "candidates": [c.to_dict() for c in candidates],
        "count": len(candidates),
        "image_size": {"width": image.shape[1], "height": image.shape[0]},
        "processed_size": {"width": processed.shape[1], "height": processed.shape[0]},
        "scale": scale,
        "timings": timings,
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        img = cv2.imread(sys.argv[1])
        if img is not None:
            result = detect_components(img)
            import json
            print(json.dumps(result, indent=2))
        else:
            print(f"Could not load image: {sys.argv[1]}")
