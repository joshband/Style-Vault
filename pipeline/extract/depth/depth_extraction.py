"""
Stage 2: Depth Estimation using Depth Anything V2

Produces normalized depth maps in 16-bit PNG and JSON float grid formats.
Module is designed to be swappable with alternative depth models.
"""

import os
import json
from typing import Dict, Any, Optional, Tuple, List
from abc import ABC, abstractmethod

try:
    import numpy as np
    from PIL import Image
except ImportError:
    np = None
    Image = None

from pipeline.schemas import DepthExtractionResult


class DepthModel(ABC):
    """Abstract base class for depth estimation models."""
    
    @abstractmethod
    def estimate_depth(self, image_path: str) -> 'np.ndarray':
        """
        Estimate depth from image.
        
        Args:
            image_path: Path to input image
            
        Returns:
            Normalized depth map as float32 array (0.0 = near, 1.0 = far)
        """
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model identifier."""
        pass


class DepthAnythingV2(DepthModel):
    """
    Depth Anything V2 model wrapper.
    
    For actual inference, this would load the model from HuggingFace or local weights.
    Currently implemented as a placeholder that generates synthetic depth.
    
    To enable real inference:
    1. Install: pip install transformers torch
    2. Replace estimate_depth with actual model inference
    """
    
    def __init__(self, model_size: str = "small"):
        """
        Initialize Depth Anything V2.
        
        Args:
            model_size: One of 'small', 'base', 'large', 'giant'
        """
        self.model_size = model_size
        self._model = None
        self._processor = None
    
    def _load_model(self):
        """Lazy load the model."""
        if self._model is not None:
            return
        
        try:
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation
            import torch
            
            model_id = f"depth-anything/Depth-Anything-V2-{self.model_size.capitalize()}-hf"
            
            self._processor = AutoImageProcessor.from_pretrained(model_id)
            self._model = AutoModelForDepthEstimation.from_pretrained(model_id)
            self._model.eval()
            
            if torch.cuda.is_available():
                self._model = self._model.cuda()
                
        except ImportError:
            print("Warning: transformers/torch not available, using synthetic depth")
            self._model = "synthetic"
    
    def estimate_depth(self, image_path: str) -> 'np.ndarray':
        """Estimate depth using Depth Anything V2."""
        if np is None or Image is None:
            raise ImportError("numpy and PIL are required")
        
        self._load_model()
        
        image = Image.open(image_path).convert('RGB')
        
        if self._model == "synthetic" or self._model is None:
            return self._generate_synthetic_depth(image)
        
        try:
            import torch
            
            inputs = self._processor(images=image, return_tensors="pt")
            
            if torch.cuda.is_available():
                inputs = {k: v.cuda() for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self._model(**inputs)
                depth = outputs.predicted_depth
            
            depth = depth.squeeze().cpu().numpy()
            
            depth_min = depth.min()
            depth_max = depth.max()
            if depth_max - depth_min > 0:
                depth = (depth - depth_min) / (depth_max - depth_min)
            else:
                depth = np.zeros_like(depth)
            
            target_size = (image.height, image.width)
            if depth.shape != target_size:
                depth_pil = Image.fromarray((depth * 255).astype(np.uint8))
                depth_pil = depth_pil.resize((image.width, image.height), Image.Resampling.BILINEAR)
                depth = np.array(depth_pil).astype(np.float32) / 255.0
            
            return depth.astype(np.float32)
            
        except Exception as e:
            print(f"Depth estimation failed: {e}, using synthetic depth")
            return self._generate_synthetic_depth(image)
    
    def _generate_synthetic_depth(self, image: 'Image.Image') -> 'np.ndarray':
        """Generate synthetic depth map based on image brightness gradient."""
        img_array = np.array(image.convert('L')).astype(np.float32) / 255.0
        
        h, w = img_array.shape
        y_gradient = np.linspace(0, 1, h).reshape(-1, 1)
        y_gradient = np.tile(y_gradient, (1, w))
        
        depth = 0.5 * img_array + 0.5 * y_gradient
        
        depth = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
        
        return depth.astype(np.float32)
    
    @property
    def model_name(self) -> str:
        return f"depth-anything-v2-{self.model_size}"


class MiDaSDepthModel(DepthModel):
    """
    MiDaS depth model (alternative to Depth Anything).
    Placeholder for model swappability demonstration.
    """
    
    def __init__(self, model_type: str = "DPT_Large"):
        self.model_type = model_type
        self._model = None
    
    def estimate_depth(self, image_path: str) -> 'np.ndarray':
        """Estimate depth using MiDaS."""
        if np is None or Image is None:
            raise ImportError("numpy and PIL are required")
        
        image = Image.open(image_path).convert('RGB')
        img_array = np.array(image.convert('L')).astype(np.float32) / 255.0
        
        h, w = img_array.shape
        center_y, center_x = h / 2, w / 2
        
        y, x = np.ogrid[:h, :w]
        radial = np.sqrt((x - center_x)**2 + (y - center_y)**2)
        radial = radial / radial.max()
        
        depth = 0.6 * img_array + 0.4 * radial
        depth = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
        
        return depth.astype(np.float32)
    
    @property
    def model_name(self) -> str:
        return f"midas-{self.model_type.lower()}"


def save_depth_as_16bit_png(depth: 'np.ndarray', output_path: str) -> str:
    """
    Save depth map as 16-bit PNG.
    
    Args:
        depth: Normalized depth array (0.0 to 1.0)
        output_path: Output file path
    
    Returns:
        Path to saved file
    """
    depth_16bit = (depth * 65535).astype(np.uint16)
    
    img = Image.fromarray(depth_16bit, mode='I;16')
    img.save(output_path)
    
    return output_path


def save_depth_as_json(
    depth: 'np.ndarray',
    output_path: str,
    downsample: int = 4
) -> str:
    """
    Save depth map as JSON float grid.
    
    Args:
        depth: Normalized depth array
        output_path: Output file path
        downsample: Downsampling factor for grid size
    
    Returns:
        Path to saved file
    """
    if downsample > 1:
        h, w = depth.shape
        new_h, new_w = h // downsample, w // downsample
        depth_pil = Image.fromarray((depth * 255).astype(np.uint8))
        depth_pil = depth_pil.resize((new_w, new_h), Image.Resampling.BILINEAR)
        depth = np.array(depth_pil).astype(np.float32) / 255.0
    
    grid = [[round(float(v), 4) for v in row] for row in depth]
    
    data = {
        "width": len(grid[0]) if grid else 0,
        "height": len(grid),
        "grid": grid
    }
    
    with open(output_path, 'w') as f:
        json.dump(data, f)
    
    return output_path


def compute_depth_stats(depth: 'np.ndarray') -> Dict[str, float]:
    """Compute statistics from depth map."""
    return {
        "min": float(depth.min()),
        "max": float(depth.max()),
        "mean": float(depth.mean()),
        "std": float(depth.std()),
        "median": float(np.median(depth))
    }


def extract_depth(
    image_path: str,
    output_dir: str,
    model: Optional[DepthModel] = None,
    image_id: Optional[str] = None
) -> DepthExtractionResult:
    """
    Extract depth map from an image.
    
    Args:
        image_path: Path to input image
        output_dir: Directory for output files
        model: Depth model to use (defaults to DepthAnythingV2)
        image_id: Optional ID for output files
    
    Returns:
        DepthExtractionResult with paths and statistics
    """
    if model is None:
        model = DepthAnythingV2(model_size="small")
    
    if image_id is None:
        image_id = os.path.splitext(os.path.basename(image_path))[0]
    
    os.makedirs(output_dir, exist_ok=True)
    
    depth = model.estimate_depth(image_path)
    
    png_path = os.path.join(output_dir, f"{image_id}_depth.png")
    json_path = os.path.join(output_dir, f"{image_id}_depth.json")
    
    save_depth_as_16bit_png(depth, png_path)
    save_depth_as_json(depth, json_path)
    
    stats = compute_depth_stats(depth)
    stats["model"] = model.model_name
    
    return DepthExtractionResult(
        depth_map_path=png_path,
        depth_json_path=json_path,
        depth_stats=stats
    )
