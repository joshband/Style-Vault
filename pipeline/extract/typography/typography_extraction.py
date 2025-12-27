"""
Stage 1C: Typography Primitive Extraction

Detects text regions, estimates font sizes, and captures hierarchy.
Uses morphological operations and optional OCR for text detection.
"""

from typing import List, Tuple, Optional

try:
    import numpy as np
    from PIL import Image
    import cv2
except ImportError:
    np = None
    Image = None
    cv2 = None

from pipeline.schemas import BoundingBox, TypographyPrimitive, TypographyExtractionResult


def detect_text_regions(image_path: str) -> List[Tuple[BoundingBox, float]]:
    """
    Detect potential text regions using morphological operations.
    Returns bounding boxes with estimated text height.
    """
    if cv2 is None:
        raise ImportError("OpenCV is required for typography extraction")
    
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 1))
    horizontal_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_h)
    
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 15))
    vertical_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_v)
    
    text_mask = binary - horizontal_lines - vertical_lines
    text_mask = np.clip(text_mask, 0, 255).astype(np.uint8)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 3))
    dilated = cv2.dilate(text_mask, kernel, iterations=2)
    
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    regions = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        
        aspect_ratio = w / h if h > 0 else 0
        if w > 20 and h > 8 and aspect_ratio > 1.5:
            bbox = BoundingBox(x=x, y=y, width=w, height=h)
            
            estimated_size = h * 0.75
            regions.append((bbox, estimated_size))
    
    return regions


def compute_hierarchy(regions: List[Tuple[BoundingBox, float]]) -> List[TypographyPrimitive]:
    """
    Assign hierarchy levels based on estimated font size.
    Larger text = higher hierarchy (lower number).
    """
    if not regions:
        return []
    
    sorted_regions = sorted(regions, key=lambda r: r[1], reverse=True)
    
    max_size = sorted_regions[0][1]
    
    size_groups = []
    current_group = [sorted_regions[0][1]]
    tolerance = max_size * 0.15
    
    for _, size in sorted_regions[1:]:
        if abs(size - current_group[-1]) <= tolerance:
            current_group.append(size)
        else:
            size_groups.append(np.mean(current_group))
            current_group = [size]
    size_groups.append(np.mean(current_group))
    
    primitives = []
    for bbox, size in regions:
        level = 1
        for i, group_size in enumerate(size_groups):
            if abs(size - group_size) <= tolerance:
                level = i + 1
                break
        
        relative_scale = size / max_size if max_size > 0 else 1.0
        
        primitives.append(TypographyPrimitive(
            bbox=bbox,
            estimated_size=round(size, 1),
            hierarchy_level=level,
            relative_scale=round(relative_scale, 3)
        ))
    
    return primitives


def extract_typography(image_path: str) -> TypographyExtractionResult:
    """
    Extract typography primitives from an image.
    
    Args:
        image_path: Path to the image file
    
    Returns:
        TypographyExtractionResult with text regions and size hierarchy
    """
    regions = detect_text_regions(image_path)
    primitives = compute_hierarchy(regions)
    
    sizes = sorted(set(p.estimated_size for p in primitives), reverse=True)
    
    return TypographyExtractionResult(
        text_regions=primitives,
        size_hierarchy=sizes
    )
