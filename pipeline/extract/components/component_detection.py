"""
Stage 3: Component Detection

Uses segmentation (SAM-like) to identify UI regions and classifies them
using CLIP-based embeddings or heuristic rules.
"""

import os
import uuid
from typing import List, Dict, Optional, Tuple

try:
    import numpy as np
    from PIL import Image
    import cv2
except ImportError:
    np = None
    Image = None
    cv2 = None

from pipeline.schemas import BoundingBox, DetectedRegion, ComponentDetectionResult, ComponentType


COMPONENT_HEURISTICS = {
    ComponentType.BUTTON: {
        "aspect_ratio": (1.5, 6.0),
        "area_range": (1000, 50000),
        "height_range": (20, 80),
    },
    ComponentType.INPUT: {
        "aspect_ratio": (3.0, 15.0),
        "area_range": (2000, 100000),
        "height_range": (25, 60),
    },
    ComponentType.CARD: {
        "aspect_ratio": (0.5, 2.0),
        "area_range": (10000, 500000),
        "height_range": (100, 600),
    },
    ComponentType.NAV: {
        "aspect_ratio": (5.0, 50.0),
        "area_range": (5000, 200000),
        "height_range": (40, 120),
    },
    ComponentType.ICON: {
        "aspect_ratio": (0.8, 1.2),
        "area_range": (100, 5000),
        "height_range": (16, 64),
    },
}


def segment_regions(image_path: str, min_area: int = 500) -> List[Tuple[BoundingBox, 'np.ndarray']]:
    """
    Segment image into distinct regions.
    Returns bounding boxes and binary masks.
    
    Note: For production, replace with FastSAM or SAM-based segmentation.
    """
    if cv2 is None or np is None:
        raise ImportError("OpenCV and numpy are required")
    
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    edges = cv2.Canny(gray, 30, 100)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edges, kernel, iterations=2)
    closed = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, kernel)
    
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    regions = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue
        
        x, y, w, h = cv2.boundingRect(contour)
        bbox = BoundingBox(x=x, y=y, width=w, height=h)
        
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.drawContours(mask, [contour], -1, 255, -1)
        
        regions.append((bbox, mask))
    
    return regions


def classify_by_heuristics(bbox: BoundingBox) -> Tuple[ComponentType, float]:
    """
    Classify component type based on geometric heuristics.
    Returns type and confidence score.
    """
    aspect_ratio = bbox.width / bbox.height if bbox.height > 0 else 0
    area = bbox.width * bbox.height
    
    best_match = ComponentType.UNKNOWN
    best_score = 0.0
    
    for comp_type, rules in COMPONENT_HEURISTICS.items():
        ar_min, ar_max = rules["aspect_ratio"]
        area_min, area_max = rules["area_range"]
        h_min, h_max = rules["height_range"]
        
        ar_score = 1.0 if ar_min <= aspect_ratio <= ar_max else 0.0
        area_score = 1.0 if area_min <= area <= area_max else 0.0
        h_score = 1.0 if h_min <= bbox.height <= h_max else 0.0
        
        total_score = (ar_score + area_score + h_score) / 3.0
        
        if total_score > best_score:
            best_score = total_score
            best_match = comp_type
    
    return best_match, round(best_score, 2)


def classify_with_clip(
    image: 'Image.Image',
    region_mask: 'np.ndarray',
    bbox: BoundingBox
) -> Tuple[ComponentType, float]:
    """
    Classify component type using CLIP embeddings.
    
    Note: Requires CLIP model to be loaded. Falls back to heuristics if unavailable.
    """
    try:
        import torch
        from transformers import CLIPProcessor, CLIPModel
        
        cropped = image.crop((bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height))
        
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        
        labels = [
            "a button UI element",
            "a text input field",
            "a card or container",
            "a navigation bar",
            "a text block or paragraph",
            "an image or photo",
            "an icon or symbol",
        ]
        
        inputs = processor(text=labels, images=cropped, return_tensors="pt", padding=True)
        
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits_per_image
            probs = logits.softmax(dim=1)
        
        best_idx = probs.argmax().item()
        confidence = probs[0, best_idx].item()
        
        type_mapping = [
            ComponentType.BUTTON,
            ComponentType.INPUT,
            ComponentType.CARD,
            ComponentType.NAV,
            ComponentType.TEXT_BLOCK,
            ComponentType.IMAGE,
            ComponentType.ICON,
        ]
        
        return type_mapping[best_idx], round(confidence, 2)
        
    except Exception:
        return classify_by_heuristics(bbox)


def save_mask(mask: 'np.ndarray', output_path: str) -> str:
    """Save binary mask as PNG."""
    img = Image.fromarray(mask)
    img.save(output_path)
    return output_path


def detect_components(
    image_path: str,
    output_dir: str,
    use_clip: bool = False,
    image_id: Optional[str] = None
) -> ComponentDetectionResult:
    """
    Detect UI components in an image.
    
    Args:
        image_path: Path to input image
        output_dir: Directory for mask outputs
        use_clip: Whether to use CLIP for classification
        image_id: Optional ID prefix for outputs
    
    Returns:
        ComponentDetectionResult with detected regions
    """
    if image_id is None:
        image_id = os.path.splitext(os.path.basename(image_path))[0]
    
    masks_dir = os.path.join(output_dir, "masks")
    os.makedirs(masks_dir, exist_ok=True)
    
    regions_data = segment_regions(image_path)
    
    if use_clip and Image is not None:
        image = Image.open(image_path).convert('RGB')
    else:
        image = None
    
    detected_regions = []
    
    for i, (bbox, mask) in enumerate(regions_data):
        region_id = f"{image_id}_region_{i}_{uuid.uuid4().hex[:6]}"
        
        if use_clip and image is not None:
            comp_type, confidence = classify_with_clip(image, mask, bbox)
        else:
            comp_type, confidence = classify_by_heuristics(bbox)
        
        mask_path = os.path.join(masks_dir, f"{region_id}.png")
        save_mask(mask, mask_path)
        
        detected_regions.append(DetectedRegion(
            id=region_id,
            bbox=bbox,
            mask_path=mask_path,
            component_type=comp_type,
            confidence=confidence
        ))
    
    return ComponentDetectionResult(regions=detected_regions)
