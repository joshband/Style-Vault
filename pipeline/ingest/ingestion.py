"""
Stage 0: Image Ingestion & Preprocessing

Accepts PNG/JPG/WebP images, normalizes color space, generates resized versions,
and produces a stable hash for caching/deduplication.
"""

import hashlib
import os
import uuid
from pathlib import Path
from typing import Dict, Optional
from io import BytesIO
import base64

try:
    from PIL import Image
    import numpy as np
except ImportError:
    Image = None
    np = None

from pipeline.schemas import IngestResult


SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.webp'}
DEFAULT_SIZES = {
    'thumbnail': (128, 128),
    'small': (256, 256),
    'medium': (512, 512),
    'large': (1024, 1024),
    'xlarge': (2048, 2048),
}


def compute_image_hash(image_data: bytes) -> str:
    """Compute stable SHA256 hash of image data."""
    return hashlib.sha256(image_data).hexdigest()[:16]


def load_image_from_base64(base64_data: str) -> 'Image.Image':
    """Load PIL Image from base64 string."""
    if Image is None:
        raise ImportError("PIL/Pillow is required for image processing")
    
    if base64_data.startswith('data:'):
        base64_data = base64_data.split(',', 1)[1]
    
    image_bytes = base64.b64decode(base64_data)
    return Image.open(BytesIO(image_bytes))


def load_image_from_path(path: str) -> 'Image.Image':
    """Load PIL Image from file path."""
    if Image is None:
        raise ImportError("PIL/Pillow is required for image processing")
    return Image.open(path)


def normalize_to_srgb(image: 'Image.Image') -> 'Image.Image':
    """Convert image to sRGB color space."""
    if image.mode == 'RGBA':
        background = Image.new('RGB', image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])
        image = background
    elif image.mode != 'RGB':
        image = image.convert('RGB')
    return image


def generate_resized_versions(
    image: 'Image.Image',
    output_dir: str,
    image_id: str,
    sizes: Optional[Dict[str, tuple]] = None
) -> Dict[str, str]:
    """Generate multiple resized versions of the image."""
    if sizes is None:
        sizes = DEFAULT_SIZES
    
    output_paths = {}
    os.makedirs(output_dir, exist_ok=True)
    
    for size_name, (max_w, max_h) in sizes.items():
        resized = image.copy()
        resized.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
        
        output_path = os.path.join(output_dir, f"{image_id}_{size_name}.png")
        resized.save(output_path, 'PNG')
        output_paths[size_name] = output_path
    
    return output_paths


def ingest_image(
    source: str,
    output_dir: str = "./pipeline_assets",
    image_id: Optional[str] = None,
    is_base64: bool = False
) -> IngestResult:
    """
    Ingest an image from path or base64, normalize, resize, and hash.
    
    Args:
        source: Either a file path or base64-encoded image data
        output_dir: Directory to store processed assets
        image_id: Optional custom ID (auto-generated if not provided)
        is_base64: Whether source is base64 data
    
    Returns:
        IngestResult with paths to all generated assets
    """
    if is_base64:
        image = load_image_from_base64(source)
        original_bytes = base64.b64decode(source.split(',', 1)[1] if source.startswith('data:') else source)
    else:
        image = load_image_from_path(source)
        with open(source, 'rb') as f:
            original_bytes = f.read()
    
    image_hash = compute_image_hash(original_bytes)
    
    if image_id is None:
        image_id = f"{image_hash}_{uuid.uuid4().hex[:8]}"
    
    image = normalize_to_srgb(image)
    
    asset_dir = os.path.join(output_dir, image_id)
    os.makedirs(asset_dir, exist_ok=True)
    
    original_path = os.path.join(asset_dir, f"{image_id}_original.png")
    image.save(original_path, 'PNG')
    
    sizes = generate_resized_versions(image, asset_dir, image_id)
    sizes['original'] = original_path
    
    return IngestResult(
        image_id=image_id,
        original_path=original_path,
        sizes=sizes,
        hash=image_hash,
        color_space="sRGB"
    )


def ingest_from_numpy(
    array: 'np.ndarray',
    output_dir: str = "./pipeline_assets",
    image_id: Optional[str] = None
) -> IngestResult:
    """Ingest image from numpy array (H, W, C) in RGB order."""
    if Image is None or np is None:
        raise ImportError("PIL and numpy are required")
    
    image = Image.fromarray(array.astype('uint8'), 'RGB')
    
    buffer = BytesIO()
    image.save(buffer, 'PNG')
    image_bytes = buffer.getvalue()
    
    image_hash = compute_image_hash(image_bytes)
    
    if image_id is None:
        image_id = f"{image_hash}_{uuid.uuid4().hex[:8]}"
    
    asset_dir = os.path.join(output_dir, image_id)
    os.makedirs(asset_dir, exist_ok=True)
    
    original_path = os.path.join(asset_dir, f"{image_id}_original.png")
    image.save(original_path, 'PNG')
    
    sizes = generate_resized_versions(image, asset_dir, image_id)
    sizes['original'] = original_path
    
    return IngestResult(
        image_id=image_id,
        original_path=original_path,
        sizes=sizes,
        hash=image_hash,
        color_space="sRGB"
    )
