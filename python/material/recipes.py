"""
Material Recipe Library
Defines material recipes with signal profiles, layer topologies,
token suggestions, and interaction bindings.
"""

from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass, asdict
import time


MATERIAL_RECIPES: List[Dict[str, Any]] = [
    {
        "id": "glassmorphic_emissive",
        "label": "Glassmorphic (Emissive)",
        "description": "Frosted glass with internal glow and soft reflections",
        "signal_profile": {
            "translucency": [0.55, 1.0],
            "specular": [0.55, 1.0],
            "emission": [0.25, 1.0],
            "texture_grain": [0.0, 0.35],
            "anisotropy": [0.0, 0.35]
        },
        "layer_topology": [
            "shadow_ambient",
            "shadow_contact",
            "glass_body",
            "frost_noise",
            "reflection_ramp",
            "specular_highlight",
            "internal_glow",
            "bezel_optional"
        ],
        "material_tokens": {
            "material.type": {"$value": "glass", "$type": "string"},
            "material.finish": {"$value": "frosted", "$type": "string"},
            "material.translucency": {"$value": 0.7, "$type": "number"},
            "material.reflection.strength": {"$value": 0.6, "$type": "number"},
            "material.refraction.hint": {"$value": 0.2, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "frost_noise", "$type": "string"},
            "texture.grain": {"$value": 0.2, "$type": "number"},
            "texture.scale": {"$value": 0.6, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 0.35, "$type": "number"},
            "opacity.glowMax": {"$value": 0.9, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "value", "target": "material.emission.intensity", "curve": "easeOut"},
            {"input": "hover", "target": "shadow.elevation", "curve": "easeInOut"},
            {"input": "press", "target": "specular.intensity", "curve": "easeOut"}
        ]
    },
    {
        "id": "glassmorphic_subtle",
        "label": "Glassmorphic (Subtle)",
        "description": "Clean frosted glass with minimal glow",
        "signal_profile": {
            "translucency": [0.45, 0.85],
            "specular": [0.35, 0.75],
            "emission": [0.0, 0.25],
            "texture_grain": [0.0, 0.3],
            "anisotropy": [0.0, 0.3]
        },
        "layer_topology": [
            "shadow_soft",
            "glass_body",
            "frost_layer",
            "edge_highlight"
        ],
        "material_tokens": {
            "material.type": {"$value": "glass", "$type": "string"},
            "material.finish": {"$value": "frosted", "$type": "string"},
            "material.translucency": {"$value": 0.6, "$type": "number"},
            "material.reflection.strength": {"$value": 0.4, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "frost_subtle", "$type": "string"},
            "texture.grain": {"$value": 0.15, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 0.5, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "hover", "target": "opacity.surface", "curve": "easeInOut"}
        ]
    },
    {
        "id": "anodized_metal_brushed",
        "label": "Anodized Metal (Brushed)",
        "description": "Brushed aluminum or titanium with directional highlights",
        "signal_profile": {
            "translucency": [0.0, 0.2],
            "specular": [0.45, 0.95],
            "emission": [0.0, 0.2],
            "texture_grain": [0.1, 0.6],
            "anisotropy": [0.4, 1.0]
        },
        "layer_topology": [
            "shadow_ambient",
            "metal_base",
            "anisotropic_sheen",
            "edge_highlight",
            "engraving_optional"
        ],
        "material_tokens": {
            "material.type": {"$value": "metal", "$type": "string"},
            "material.finish": {"$value": "anodized", "$type": "string"},
            "material.anisotropy": {"$value": 0.7, "$type": "number"},
            "material.reflectivity": {"$value": 0.55, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "brushed", "$type": "string"},
            "texture.grain": {"$value": 0.35, "$type": "number"},
            "texture.directionality": {"$value": 0.8, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "hover", "target": "highlight.intensity", "curve": "linear"}
        ]
    },
    {
        "id": "polished_metal",
        "label": "Polished Metal",
        "description": "Mirror-like chrome or polished steel",
        "signal_profile": {
            "translucency": [0.0, 0.15],
            "specular": [0.7, 1.0],
            "emission": [0.0, 0.1],
            "texture_grain": [0.0, 0.15],
            "anisotropy": [0.0, 0.3]
        },
        "layer_topology": [
            "shadow_sharp",
            "metal_base",
            "reflection_map",
            "specular_peak"
        ],
        "material_tokens": {
            "material.type": {"$value": "metal", "$type": "string"},
            "material.finish": {"$value": "polished", "$type": "string"},
            "material.reflectivity": {"$value": 0.9, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "smooth", "$type": "string"},
            "texture.grain": {"$value": 0.05, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "hover", "target": "reflection.intensity", "curve": "easeOut"}
        ]
    },
    {
        "id": "soft_plastic_led_diffuse",
        "label": "Soft Plastic (LED Diffuse)",
        "description": "Soft-touch plastic with internal LED glow",
        "signal_profile": {
            "translucency": [0.1, 0.45],
            "specular": [0.15, 0.55],
            "emission": [0.2, 0.95],
            "texture_grain": [0.0, 0.4],
            "anisotropy": [0.0, 0.35]
        },
        "layer_topology": [
            "shadow_ambient",
            "shadow_contact",
            "plastic_body",
            "soft_specular",
            "internal_led_glow"
        ],
        "material_tokens": {
            "material.type": {"$value": "plastic", "$type": "string"},
            "material.finish": {"$value": "soft_touch", "$type": "string"},
            "material.emission.diffusion": {"$value": 0.85, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "micro_matte", "$type": "string"},
            "texture.grain": {"$value": 0.15, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 0.95, "$type": "number"},
            "opacity.glowMax": {"$value": 0.85, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "value", "target": "material.emission.intensity", "curve": "easeIn"}
        ]
    },
    {
        "id": "matte_plastic",
        "label": "Matte Plastic",
        "description": "Standard matte plastic surface",
        "signal_profile": {
            "translucency": [0.0, 0.2],
            "specular": [0.1, 0.4],
            "emission": [0.0, 0.15],
            "texture_grain": [0.05, 0.35],
            "anisotropy": [0.0, 0.25]
        },
        "layer_topology": [
            "shadow_soft",
            "plastic_body",
            "diffuse_highlight"
        ],
        "material_tokens": {
            "material.type": {"$value": "plastic", "$type": "string"},
            "material.finish": {"$value": "matte", "$type": "string"},
            "material.reflectivity": {"$value": 0.2, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "matte", "$type": "string"},
            "texture.grain": {"$value": 0.2, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "press", "target": "shadow.depth", "curve": "easeOut"}
        ]
    },
    {
        "id": "glossy_plastic",
        "label": "Glossy Plastic",
        "description": "High-gloss plastic with sharp reflections",
        "signal_profile": {
            "translucency": [0.0, 0.15],
            "specular": [0.5, 0.9],
            "emission": [0.0, 0.1],
            "texture_grain": [0.0, 0.15],
            "anisotropy": [0.0, 0.2]
        },
        "layer_topology": [
            "shadow_medium",
            "plastic_body",
            "gloss_layer",
            "specular_highlight"
        ],
        "material_tokens": {
            "material.type": {"$value": "plastic", "$type": "string"},
            "material.finish": {"$value": "glossy", "$type": "string"},
            "material.reflectivity": {"$value": 0.65, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "smooth", "$type": "string"},
            "texture.grain": {"$value": 0.05, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "hover", "target": "specular.position", "curve": "linear"}
        ]
    },
    {
        "id": "neon_emissive",
        "label": "Neon Emissive",
        "description": "Bright neon-like glow with color saturation",
        "signal_profile": {
            "translucency": [0.2, 0.6],
            "specular": [0.3, 0.7],
            "emission": [0.6, 1.0],
            "texture_grain": [0.0, 0.2],
            "anisotropy": [0.0, 0.25]
        },
        "layer_topology": [
            "outer_glow",
            "core_glow",
            "tube_body",
            "internal_light"
        ],
        "material_tokens": {
            "material.type": {"$value": "emissive", "$type": "string"},
            "material.finish": {"$value": "neon", "$type": "string"},
            "material.emission.intensity": {"$value": 0.9, "$type": "number"},
            "material.emission.falloff": {"$value": 0.4, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "smooth", "$type": "string"},
            "texture.grain": {"$value": 0.05, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.core": {"$value": 1.0, "$type": "number"},
            "opacity.glow": {"$value": 0.7, "$type": "number"}
        },
        "interaction_hypotheses": [
            {"input": "value", "target": "emission.intensity", "curve": "linear"},
            {"input": "pulse", "target": "emission.intensity", "curve": "sine"}
        ]
    },
    {
        "id": "fabric_woven",
        "label": "Woven Fabric",
        "description": "Textile with visible weave pattern",
        "signal_profile": {
            "translucency": [0.0, 0.15],
            "specular": [0.05, 0.3],
            "emission": [0.0, 0.05],
            "texture_grain": [0.3, 0.8],
            "anisotropy": [0.2, 0.7]
        },
        "layer_topology": [
            "shadow_soft",
            "fabric_base",
            "weave_pattern",
            "fiber_highlights"
        ],
        "material_tokens": {
            "material.type": {"$value": "fabric", "$type": "string"},
            "material.finish": {"$value": "woven", "$type": "string"},
            "material.softness": {"$value": 0.7, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "woven", "$type": "string"},
            "texture.grain": {"$value": 0.5, "$type": "number"},
            "texture.pattern_scale": {"$value": 0.3, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": []
    },
    {
        "id": "wood_grain",
        "label": "Wood Grain",
        "description": "Natural wood with visible grain pattern",
        "signal_profile": {
            "translucency": [0.0, 0.1],
            "specular": [0.1, 0.45],
            "emission": [0.0, 0.05],
            "texture_grain": [0.25, 0.7],
            "anisotropy": [0.3, 0.8]
        },
        "layer_topology": [
            "shadow_soft",
            "wood_base",
            "grain_pattern",
            "finish_coat"
        ],
        "material_tokens": {
            "material.type": {"$value": "wood", "$type": "string"},
            "material.finish": {"$value": "natural", "$type": "string"},
            "material.grain_intensity": {"$value": 0.6, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "grain", "$type": "string"},
            "texture.grain": {"$value": 0.45, "$type": "number"},
            "texture.directionality": {"$value": 0.7, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": []
    },
    {
        "id": "ceramic_glaze",
        "label": "Ceramic Glaze",
        "description": "Smooth ceramic with glossy glaze",
        "signal_profile": {
            "translucency": [0.0, 0.2],
            "specular": [0.4, 0.85],
            "emission": [0.0, 0.1],
            "texture_grain": [0.0, 0.2],
            "anisotropy": [0.0, 0.15]
        },
        "layer_topology": [
            "shadow_soft",
            "ceramic_body",
            "glaze_layer",
            "specular_highlight"
        ],
        "material_tokens": {
            "material.type": {"$value": "ceramic", "$type": "string"},
            "material.finish": {"$value": "glazed", "$type": "string"},
            "material.reflectivity": {"$value": 0.6, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "smooth", "$type": "string"},
            "texture.grain": {"$value": 0.08, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": []
    },
    {
        "id": "concrete_matte",
        "label": "Concrete Matte",
        "description": "Raw concrete with subtle texture",
        "signal_profile": {
            "translucency": [0.0, 0.05],
            "specular": [0.0, 0.2],
            "emission": [0.0, 0.02],
            "texture_grain": [0.2, 0.55],
            "anisotropy": [0.0, 0.2]
        },
        "layer_topology": [
            "shadow_ambient",
            "concrete_base",
            "surface_texture"
        ],
        "material_tokens": {
            "material.type": {"$value": "concrete", "$type": "string"},
            "material.finish": {"$value": "raw", "$type": "string"},
            "material.roughness": {"$value": 0.8, "$type": "number"}
        },
        "texture_tokens": {
            "texture.kind": {"$value": "granular", "$type": "string"},
            "texture.grain": {"$value": 0.4, "$type": "number"}
        },
        "opacity_tokens": {
            "opacity.surface": {"$value": 1.0, "$type": "number"}
        },
        "interaction_hypotheses": []
    }
]


def score_recipe(recipe: Dict[str, Any], signals: Dict[str, float]) -> float:
    """
    Score how well signals match a recipe's profile.
    
    Args:
        recipe: Material recipe with signal_profile
        signals: Dict with keys matching profile (translucency, specular, etc.)
        
    Returns:
        Score between 0 and 1
    """
    profile = recipe.get("signal_profile", {})
    if not profile:
        return 0.0
    
    signal_mapping = {
        "translucency": "translucency_score",
        "specular": "specular_density",
        "emission": "emission_score",
        "texture_grain": "texture_grain",
        "anisotropy": "anisotropy"
    }
    
    scores = []
    weights = []
    
    for profile_key, signal_key in signal_mapping.items():
        if profile_key in profile:
            min_val, max_val = profile[profile_key]
            actual = signals.get(signal_key, 0.0)
            
            if min_val <= actual <= max_val:
                range_size = max_val - min_val
                if range_size > 0:
                    center = (min_val + max_val) / 2
                    distance_from_center = abs(actual - center)
                    score = 1.0 - (distance_from_center / (range_size / 2))
                else:
                    score = 1.0
            else:
                if actual < min_val:
                    distance = min_val - actual
                else:
                    distance = actual - max_val
                score = max(0, 1.0 - distance * 2)
            
            scores.append(score)
            weights.append(1.0)
    
    if not scores:
        return 0.0
    
    weighted_sum = sum(s * w for s, w in zip(scores, weights))
    total_weight = sum(weights)
    
    return weighted_sum / total_weight


def match_best_recipe(global_signals: Dict[str, Any],
                      per_component_signals: Optional[Dict[str, Dict[str, Any]]] = None,
                      texture_signals: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Match the best recipe for global and per-component signals.
    
    Args:
        global_signals: Material signals for full image
        per_component_signals: Optional per-component material signals
        texture_signals: Optional texture signals to merge with material
        
    Returns:
        Dictionary with best match, confidence, tokens, and per-component matches
    """
    start_time = time.time()
    
    merged_signals = dict(global_signals)
    if texture_signals:
        merged_signals.update(texture_signals)
    
    best_recipe = None
    best_score = 0.0
    all_scores = []
    
    for recipe in MATERIAL_RECIPES:
        score = score_recipe(recipe, merged_signals)
        all_scores.append({
            "id": recipe["id"],
            "label": recipe["label"],
            "score": round(score, 3)
        })
        if score > best_score:
            best_score = score
            best_recipe = recipe
    
    all_scores.sort(key=lambda x: -x["score"])
    
    component_matches = {}
    if per_component_signals:
        texture_per_comp = {}
        if texture_signals and "perComponent" in texture_signals:
            texture_per_comp = texture_signals.get("perComponent", {})
        
        for comp_id, comp_signals in per_component_signals.items():
            merged_comp = dict(comp_signals)
            if comp_id in texture_per_comp:
                merged_comp.update(texture_per_comp[comp_id])
            
            comp_best = None
            comp_best_score = 0.0
            
            for recipe in MATERIAL_RECIPES:
                score = score_recipe(recipe, merged_comp)
                if score > comp_best_score:
                    comp_best_score = score
                    comp_best = recipe
            
            component_matches[comp_id] = {
                "recipe_id": comp_best["id"] if comp_best else None,
                "label": comp_best["label"] if comp_best else "unknown",
                "confidence": round(comp_best_score, 3)
            }
    
    result = {
        "global": {
            "recipe_id": best_recipe["id"] if best_recipe else None,
            "label": best_recipe["label"] if best_recipe else "unknown",
            "description": best_recipe.get("description", "") if best_recipe else "",
            "confidence": round(best_score, 3),
            "layer_topology": best_recipe.get("layer_topology", []) if best_recipe else [],
            "material_tokens": best_recipe.get("material_tokens", {}) if best_recipe else {},
            "texture_tokens": best_recipe.get("texture_tokens", {}) if best_recipe else {},
            "opacity_tokens": best_recipe.get("opacity_tokens", {}) if best_recipe else {},
            "interaction_hypotheses": best_recipe.get("interaction_hypotheses", []) if best_recipe else []
        },
        "perComponent": component_matches,
        "all_matches": all_scores[:5],
        "timing_ms": round((time.time() - start_time) * 1000, 2)
    }
    
    return result


def get_recipe_by_id(recipe_id: str) -> Optional[Dict[str, Any]]:
    """Get a recipe by its ID."""
    for recipe in MATERIAL_RECIPES:
        if recipe["id"] == recipe_id:
            return recipe
    return None


def list_recipes() -> List[Dict[str, str]]:
    """List all available recipes with basic info."""
    return [
        {"id": r["id"], "label": r["label"], "description": r.get("description", "")}
        for r in MATERIAL_RECIPES
    ]


if __name__ == "__main__":
    print("Available Material Recipes:")
    for recipe in list_recipes():
        print(f"  - {recipe['id']}: {recipe['label']}")
    
    test_signals = {
        "translucency_score": 0.7,
        "specular_density": 0.65,
        "emission_score": 0.4,
        "texture_grain": 0.15,
        "anisotropy": 0.1
    }
    
    result = match_best_recipe(test_signals)
    import json
    print("\nTest match result:")
    print(json.dumps(result, indent=2))
