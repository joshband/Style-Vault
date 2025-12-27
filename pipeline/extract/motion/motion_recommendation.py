"""
Stage 8: Motion / Animation Recommendation

Heuristic-based engine that suggests micro-interactions per component type.
Outputs motion tokens with type, duration, easing, and trigger.
"""

from typing import List, Dict, Any
from pipeline.schemas import (
    MotionRecommendation, 
    MotionAnalysisResult, 
    ComponentType,
    DetectedRegion
)


MOTION_PRESETS = {
    ComponentType.BUTTON: [
        {
            "motion_type": "scale",
            "duration_ms": 120,
            "easing": "easeOut",
            "trigger": "hover",
            "scale_factor": 1.02
        },
        {
            "motion_type": "scale",
            "duration_ms": 80,
            "easing": "easeIn",
            "trigger": "press",
            "scale_factor": 0.98
        },
        {
            "motion_type": "opacity",
            "duration_ms": 200,
            "easing": "linear",
            "trigger": "disabled",
            "opacity": 0.5
        }
    ],
    ComponentType.INPUT: [
        {
            "motion_type": "border",
            "duration_ms": 150,
            "easing": "easeOut",
            "trigger": "focus"
        },
        {
            "motion_type": "label-translate",
            "duration_ms": 200,
            "easing": "easeOutCubic",
            "trigger": "focus"
        }
    ],
    ComponentType.CARD: [
        {
            "motion_type": "elevation",
            "duration_ms": 200,
            "easing": "easeOut",
            "trigger": "hover"
        },
        {
            "motion_type": "translateY",
            "duration_ms": 200,
            "easing": "easeOut",
            "trigger": "hover",
            "translate": -4
        }
    ],
    ComponentType.NAV: [
        {
            "motion_type": "opacity",
            "duration_ms": 300,
            "easing": "easeInOut",
            "trigger": "scroll-hide"
        },
        {
            "motion_type": "translateY",
            "duration_ms": 300,
            "easing": "easeOut",
            "trigger": "scroll-show"
        }
    ],
    ComponentType.TEXT_BLOCK: [
        {
            "motion_type": "fadeIn",
            "duration_ms": 400,
            "easing": "easeOut",
            "trigger": "viewport-enter"
        }
    ],
    ComponentType.IMAGE: [
        {
            "motion_type": "scale",
            "duration_ms": 300,
            "easing": "easeOut",
            "trigger": "hover",
            "scale_factor": 1.05
        },
        {
            "motion_type": "fadeIn",
            "duration_ms": 500,
            "easing": "easeOut",
            "trigger": "load"
        }
    ],
    ComponentType.ICON: [
        {
            "motion_type": "rotate",
            "duration_ms": 200,
            "easing": "easeInOut",
            "trigger": "click",
            "degrees": 15
        },
        {
            "motion_type": "scale",
            "duration_ms": 150,
            "easing": "easeOut",
            "trigger": "hover",
            "scale_factor": 1.1
        }
    ],
    ComponentType.UNKNOWN: [
        {
            "motion_type": "opacity",
            "duration_ms": 200,
            "easing": "easeInOut",
            "trigger": "hover"
        }
    ]
}


EASING_FUNCTIONS = {
    "linear": "linear",
    "easeIn": "cubic-bezier(0.4, 0, 1, 1)",
    "easeOut": "cubic-bezier(0, 0, 0.2, 1)",
    "easeInOut": "cubic-bezier(0.4, 0, 0.2, 1)",
    "easeOutCubic": "cubic-bezier(0.33, 1, 0.68, 1)",
    "easeInCubic": "cubic-bezier(0.32, 0, 0.67, 0)",
    "spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    "bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)"
}


def get_motion_for_component(
    component_id: str,
    component_type: ComponentType,
    style_mood: str = "neutral"
) -> List[MotionRecommendation]:
    """
    Get motion recommendations for a component.
    
    Args:
        component_id: Unique component identifier
        component_type: Type of component
        style_mood: Overall style mood (affects duration/easing)
    
    Returns:
        List of motion recommendations
    """
    presets = MOTION_PRESETS.get(component_type, MOTION_PRESETS[ComponentType.UNKNOWN])
    
    duration_multiplier = 1.0
    if style_mood in ["calm", "peaceful", "serene"]:
        duration_multiplier = 1.5
    elif style_mood in ["energetic", "vibrant", "bold"]:
        duration_multiplier = 0.7
    
    recommendations = []
    for preset in presets:
        adjusted_duration = int(preset["duration_ms"] * duration_multiplier)
        
        recommendations.append(MotionRecommendation(
            component_id=component_id,
            component_type=component_type.value,
            motion_type=preset["motion_type"],
            duration_ms=adjusted_duration,
            easing=preset["easing"],
            trigger=preset["trigger"]
        ))
    
    return recommendations


def recommend_motion(
    detected_regions: List[DetectedRegion],
    style_mood: str = "neutral"
) -> MotionAnalysisResult:
    """
    Generate motion recommendations for all detected components.
    
    Args:
        detected_regions: List of detected component regions
        style_mood: Overall style mood for the design
    
    Returns:
        MotionAnalysisResult with all recommendations
    """
    all_recommendations = []
    
    for region in detected_regions:
        component_recommendations = get_motion_for_component(
            component_id=region.id,
            component_type=region.component_type,
            style_mood=style_mood
        )
        all_recommendations.extend(component_recommendations)
    
    return MotionAnalysisResult(recommendations=all_recommendations)


def generate_motion_tokens(
    recommendations: List[MotionRecommendation]
) -> Dict[str, Any]:
    """
    Convert motion recommendations to W3C DTCG-adjacent motion tokens.
    
    Note: Motion tokens are NOT part of DTCG spec, so these use a custom format.
    """
    tokens = {
        "$type": "motion",
        "$description": "Motion/animation tokens for UI interactions",
        "motion": {}
    }
    
    grouped = {}
    for rec in recommendations:
        motion_key = f"{rec.motion_type}-{rec.trigger}"
        if motion_key not in grouped:
            grouped[motion_key] = rec
    
    for key, rec in grouped.items():
        safe_key = key.replace("-", "_")
        tokens["motion"][safe_key] = {
            "$type": "motion",
            "$value": {
                "type": rec.motion_type,
                "duration": f"{rec.duration_ms}ms",
                "easing": EASING_FUNCTIONS.get(rec.easing, rec.easing),
                "trigger": rec.trigger
            }
        }
    
    return tokens
