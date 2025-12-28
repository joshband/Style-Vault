"""
Stage 1B: Geometry & Layout Primitive Extraction

Detects bounding boxes, alignment patterns, spacing distances, and grid rhythm.
Uses edge detection and contour analysis.
"""

from typing import List, Dict, Optional, Tuple
from collections import Counter

try:
    import numpy as np
    from PIL import Image
    import cv2
except ImportError:
    np = None
    Image = None
    cv2 = None

from pipeline.schemas import BoundingBox, LayoutExtractionResult


def detect_edges(image_path: str) -> 'np.ndarray':
    """Detect edges using Canny edge detection."""
    if cv2 is None:
        raise ImportError("OpenCV is required for layout extraction")
    
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    blurred = cv2.GaussianBlur(img, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    return edges


def find_contours(edges: 'np.ndarray') -> List[BoundingBox]:
    """Find contours and extract bounding boxes."""
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    bboxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w > 10 and h > 10:
            bboxes.append(BoundingBox(x=x, y=y, width=w, height=h))
    
    return bboxes


def detect_alignments(bboxes: List[BoundingBox]) -> Dict[str, List[int]]:
    """Detect horizontal and vertical alignment patterns."""
    left_edges = [b.x for b in bboxes]
    right_edges = [b.x + b.width for b in bboxes]
    top_edges = [b.y for b in bboxes]
    bottom_edges = [b.y + b.height for b in bboxes]
    center_x = [b.x + b.width // 2 for b in bboxes]
    center_y = [b.y + b.height // 2 for b in bboxes]
    
    def find_common_values(values: List[int], tolerance: int = 5) -> List[int]:
        """Find values that appear multiple times within tolerance."""
        if not values:
            return []
        
        sorted_vals = sorted(values)
        groups = []
        current_group = [sorted_vals[0]]
        
        for val in sorted_vals[1:]:
            if val - current_group[-1] <= tolerance:
                current_group.append(val)
            else:
                if len(current_group) >= 2:
                    groups.append(int(np.mean(current_group)))
                current_group = [val]
        
        if len(current_group) >= 2:
            groups.append(int(np.mean(current_group)))
        
        return groups
    
    return {
        "left": find_common_values(left_edges),
        "right": find_common_values(right_edges),
        "top": find_common_values(top_edges),
        "bottom": find_common_values(bottom_edges),
        "centerX": find_common_values(center_x),
        "centerY": find_common_values(center_y),
    }


def detect_spacing(bboxes: List[BoundingBox]) -> List[int]:
    """Detect repeated spacing distances between elements."""
    if len(bboxes) < 2:
        return []
    
    horizontal_gaps = []
    vertical_gaps = []
    
    sorted_by_x = sorted(bboxes, key=lambda b: b.x)
    for i in range(len(sorted_by_x) - 1):
        gap = sorted_by_x[i + 1].x - (sorted_by_x[i].x + sorted_by_x[i].width)
        if gap > 0:
            horizontal_gaps.append(gap)
    
    sorted_by_y = sorted(bboxes, key=lambda b: b.y)
    for i in range(len(sorted_by_y) - 1):
        gap = sorted_by_y[i + 1].y - (sorted_by_y[i].y + sorted_by_y[i].height)
        if gap > 0:
            vertical_gaps.append(gap)
    
    all_gaps = horizontal_gaps + vertical_gaps
    
    gap_counts = Counter(all_gaps)
    repeated_gaps = [gap for gap, count in gap_counts.items() if count >= 2]
    
    return sorted(set(repeated_gaps))


def detect_grid_rhythm(
    bboxes: List[BoundingBox],
    image_width: int,
    image_height: int
) -> Optional[Dict[str, int]]:
    """Infer grid structure if present."""
    if len(bboxes) < 4:
        return None
    
    widths = [b.width for b in bboxes]
    heights = [b.height for b in bboxes]
    
    width_counts = Counter(widths)
    height_counts = Counter(heights)
    
    common_width = width_counts.most_common(1)[0][0] if width_counts else None
    common_height = height_counts.most_common(1)[0][0] if height_counts else None
    
    if common_width is None:
        return None
    
    x_positions = sorted(set(b.x for b in bboxes if abs(b.width - common_width) < 10))
    
    if len(x_positions) < 2:
        return None
    
    x_gaps = [x_positions[i + 1] - x_positions[i] for i in range(len(x_positions) - 1)]
    
    if len(set(x_gaps)) <= 2:
        column_width = int(np.mean(x_gaps)) if x_gaps else common_width
        num_columns = len(x_positions)
        
        return {
            "columns": num_columns,
            "columnWidth": column_width,
            "gutterWidth": column_width - common_width if column_width > common_width else 0
        }
    
    return None


def extract_layout(image_path: str) -> LayoutExtractionResult:
    """
    Extract layout primitives from an image.
    
    Args:
        image_path: Path to the image file
    
    Returns:
        LayoutExtractionResult with bounding boxes, alignments, spacing, and grid info
    """
    if cv2 is None or np is None:
        raise ImportError("OpenCV and numpy are required")
    
    img = cv2.imread(image_path)
    h, w = img.shape[:2]
    
    edges = detect_edges(image_path)
    bboxes = find_contours(edges)
    
    alignments = detect_alignments(bboxes)
    spacing = detect_spacing(bboxes)
    grid = detect_grid_rhythm(bboxes, w, h)
    
    return LayoutExtractionResult(
        bounding_boxes=bboxes,
        alignments=alignments,
        spacing_distances=spacing,
        grid_rhythm=grid
    )
