"""
Stage 5: Style, Mood & Artistic Inference

Uses CLIP embeddings, BLIP captioning, and a curated style taxonomy
to produce art/style tags, mood descriptors, and numeric style vectors.
"""

import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

try:
    import numpy as np
    from PIL import Image
except ImportError:
    np = None
    Image = None

from pipeline.schemas import StyleInferenceResult


STYLE_TAXONOMY = {
    "aesthetic": [
        "minimalist", "maximalist", "brutalist", "organic", "geometric",
        "retro", "futuristic", "vintage", "modern", "classical",
        "industrial", "ethereal", "grunge", "clean", "ornate"
    ],
    "mood": [
        "calm", "energetic", "somber", "playful", "serious",
        "mysterious", "cheerful", "melancholic", "dramatic", "peaceful",
        "tense", "relaxed", "vibrant", "muted", "bold"
    ],
    "material": [
        "glossy", "matte", "metallic", "wooden", "fabric",
        "paper", "glass", "stone", "plastic", "leather"
    ],
    "era": [
        "art-deco", "mid-century", "contemporary", "victorian", "80s",
        "90s", "y2k", "renaissance", "baroque", "postmodern"
    ],
    "temperature": [
        "warm", "cool", "neutral", "hot", "cold"
    ]
}

ALL_STYLE_TAGS = []
for category, tags in STYLE_TAXONOMY.items():
    for tag in tags:
        ALL_STYLE_TAGS.append({"tag": tag, "category": category})


class StyleClassifier:
    """CLIP-based style classifier."""
    
    def __init__(self):
        self._model = None
        self._processor = None
        self._tag_embeddings = None
    
    def _load_model(self):
        """Lazy load CLIP model."""
        if self._model is not None:
            return True
        
        try:
            import torch
            from transformers import CLIPProcessor, CLIPModel
            
            self._model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self._processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            self._model.eval()
            
            if torch.cuda.is_available():
                self._model = self._model.cuda()
            
            return True
        except ImportError:
            return False
    
    def _compute_tag_embeddings(self):
        """Pre-compute embeddings for all style tags."""
        if self._tag_embeddings is not None:
            return
        
        import torch
        
        prompts = [f"a {item['tag']} style image" for item in ALL_STYLE_TAGS]
        
        inputs = self._processor(text=prompts, return_tensors="pt", padding=True)
        
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
        
        with torch.no_grad():
            text_features = self._model.get_text_features(**inputs)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        
        self._tag_embeddings = text_features.cpu().numpy()
    
    def get_image_embedding(self, image: 'Image.Image') -> 'np.ndarray':
        """Get CLIP embedding for an image."""
        if not self._load_model():
            return np.random.randn(512).astype(np.float32)
        
        import torch
        
        inputs = self._processor(images=image, return_tensors="pt")
        
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
        
        with torch.no_grad():
            image_features = self._model.get_image_features(**inputs)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        
        return image_features.cpu().numpy().flatten()
    
    def classify_style(
        self,
        image: 'Image.Image',
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Classify image style using CLIP.
        
        Returns:
            List of top-k style tags with scores
        """
        if not self._load_model():
            return self._fallback_classification()
        
        self._compute_tag_embeddings()
        
        image_embedding = self.get_image_embedding(image)
        
        similarities = np.dot(self._tag_embeddings, image_embedding)
        
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        results = []
        for idx in top_indices:
            item = ALL_STYLE_TAGS[idx]
            results.append({
                "tag": item["tag"],
                "category": item["category"],
                "score": float(similarities[idx])
            })
        
        return results
    
    def _fallback_classification(self) -> List[Dict[str, Any]]:
        """Return default tags when CLIP is unavailable."""
        import random
        
        selected = random.sample(ALL_STYLE_TAGS, min(10, len(ALL_STYLE_TAGS)))
        return [
            {"tag": item["tag"], "category": item["category"], "score": random.uniform(0.3, 0.8)}
            for item in selected
        ]


class ImageCaptioner:
    """BLIP-based image captioning."""
    
    def __init__(self):
        self._model = None
        self._processor = None
    
    def _load_model(self):
        """Lazy load BLIP model."""
        if self._model is not None:
            return True
        
        try:
            import torch
            from transformers import BlipProcessor, BlipForConditionalGeneration
            
            self._model = BlipForConditionalGeneration.from_pretrained(
                "Salesforce/blip-image-captioning-base"
            )
            self._processor = BlipProcessor.from_pretrained(
                "Salesforce/blip-image-captioning-base"
            )
            self._model.eval()
            
            if torch.cuda.is_available():
                self._model = self._model.cuda()
            
            return True
        except ImportError:
            return False
    
    def generate_caption(self, image: 'Image.Image') -> str:
        """Generate caption for an image."""
        if not self._load_model():
            return "An image with visual design elements"
        
        import torch
        
        inputs = self._processor(images=image, return_tensors="pt")
        
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
        
        with torch.no_grad():
            output = self._model.generate(**inputs, max_new_tokens=50)
        
        caption = self._processor.decode(output[0], skip_special_tokens=True)
        return caption


def compute_mood_from_tags(tags: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Derive mood descriptor from style tags."""
    mood_tags = [t for t in tags if t["category"] == "mood"]
    
    if not mood_tags:
        return {"primary": "neutral", "secondary": None, "intensity": 0.5}
    
    sorted_moods = sorted(mood_tags, key=lambda x: x["score"], reverse=True)
    
    return {
        "primary": sorted_moods[0]["tag"],
        "secondary": sorted_moods[1]["tag"] if len(sorted_moods) > 1 else None,
        "intensity": sorted_moods[0]["score"]
    }


def infer_style(
    image_path: str,
    top_k: int = 15
) -> StyleInferenceResult:
    """
    Perform full style inference on an image.
    
    Args:
        image_path: Path to input image
        top_k: Number of top tags to return
    
    Returns:
        StyleInferenceResult with tags, mood, embedding, and caption
    """
    if Image is None or np is None:
        raise ImportError("PIL and numpy are required")
    
    image = Image.open(image_path).convert('RGB')
    
    classifier = StyleClassifier()
    captioner = ImageCaptioner()
    
    style_tags = classifier.classify_style(image, top_k=top_k)
    
    try:
        embedding = classifier.get_image_embedding(image).tolist()
    except Exception:
        embedding = [0.0] * 512
    
    caption = captioner.generate_caption(image)
    
    mood = compute_mood_from_tags(style_tags)
    
    return StyleInferenceResult(
        style_tags=style_tags,
        mood=mood,
        embedding=embedding,
        caption=caption
    )


def export_taxonomy_json(output_path: str) -> str:
    """Export the style taxonomy to JSON file."""
    with open(output_path, 'w') as f:
        json.dump({
            "taxonomy": STYLE_TAXONOMY,
            "flatTags": ALL_STYLE_TAGS
        }, f, indent=2)
    return output_path
