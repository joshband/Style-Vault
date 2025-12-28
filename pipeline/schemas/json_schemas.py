"""
JSON Schema definitions for pipeline outputs.

These schemas can be used for validation of pipeline outputs.
"""

DTCG_TOKEN_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "W3C DTCG Design Token",
    "type": "object",
    "properties": {
        "$type": {
            "type": "string",
            "enum": ["color", "dimension", "fontFamily", "fontWeight", "duration", 
                     "cubicBezier", "number", "strokeStyle", "border", "transition",
                     "shadow", "gradient", "typography", "fontStyle"]
        },
        "$value": {},
        "$description": {"type": "string"},
        "$extensions": {"type": "object"}
    },
    "required": ["$value"]
}

COMPONENT_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Component Schema",
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "type": {
            "type": "string",
            "enum": ["button", "input", "card", "nav", "text_block", "image", "icon", "unknown"]
        },
        "semanticRole": {"type": "string"},
        "bbox": {
            "type": "object",
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "width": {"type": "integer"},
                "height": {"type": "integer"}
            },
            "required": ["x", "y", "width", "height"]
        },
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "maskPath": {"type": "string"},
        "tokenBindings": {
            "type": "object",
            "additionalProperties": {"type": "string"}
        },
        "variants": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "size": {"type": "string"},
                    "state": {"type": "string"}
                }
            }
        },
        "behaviorHints": {
            "type": "object",
            "properties": {
                "interactive": {"type": "boolean"},
                "focusable": {"type": "boolean"},
                "hover": {"type": "boolean"},
                "press": {"type": "boolean"}
            }
        }
    },
    "required": ["id", "type"]
}

LAYER_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Layer Schema",
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "depthRange": {
            "type": "array",
            "items": {"type": "number"},
            "minItems": 2,
            "maxItems": 2
        },
        "maskPath": {"type": "string"}
    },
    "required": ["name", "depthRange"]
}

MOTION_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Motion Token Schema",
    "type": "object",
    "properties": {
        "component": {"type": "string"},
        "componentType": {"type": "string"},
        "motion": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["scale", "opacity", "translateX", "translateY", "rotate",
                             "elevation", "border", "fadeIn", "label-translate"]
                },
                "duration": {"type": "integer", "minimum": 0},
                "easing": {"type": "string"},
                "trigger": {
                    "type": "string",
                    "enum": ["hover", "press", "focus", "click", "load", 
                             "viewport-enter", "scroll-hide", "scroll-show", "disabled"]
                }
            },
            "required": ["type", "duration", "easing", "trigger"]
        }
    },
    "required": ["component", "motion"]
}

STYLE_INFERENCE_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Style Inference Schema",
    "type": "object",
    "properties": {
        "styleTags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tag": {"type": "string"},
                    "category": {"type": "string"},
                    "score": {"type": "number", "minimum": 0, "maximum": 1}
                },
                "required": ["tag", "category", "score"]
            }
        },
        "mood": {
            "type": "object",
            "properties": {
                "primary": {"type": "string"},
                "secondary": {"type": ["string", "null"]},
                "intensity": {"type": "number", "minimum": 0, "maximum": 1}
            }
        },
        "embedding": {
            "type": "array",
            "items": {"type": "number"}
        },
        "caption": {"type": "string"}
    },
    "required": ["styleTags", "mood", "embedding"]
}

UNIFIED_OUTPUT_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Unified Pipeline Output",
    "type": "object",
    "properties": {
        "imageId": {"type": "string"},
        "tokens": {"type": "object"},
        "components": {
            "type": "array",
            "items": {"$ref": "#/definitions/component"}
        },
        "style": {"$ref": "#/definitions/styleInference"},
        "layers": {
            "type": "array",
            "items": {"$ref": "#/definitions/layer"}
        },
        "depth": {
            "type": "object",
            "properties": {
                "depthMapPath": {"type": "string"},
                "depthJsonPath": {"type": "string"},
                "depthStats": {"type": "object"}
            }
        },
        "lighting": {
            "type": "object",
            "properties": {
                "lighting": {
                    "type": "object",
                    "properties": {
                        "direction": {"type": "string"},
                        "shadowIntensity": {"type": "number"},
                        "highlightStrength": {"type": "number"},
                        "contrastGradient": {"type": "number"}
                    }
                }
            }
        },
        "materials": {"type": "object"},
        "motion": {
            "type": "array",
            "items": {"$ref": "#/definitions/motion"}
        }
    },
    "required": ["imageId", "tokens"],
    "definitions": {
        "component": COMPONENT_SCHEMA,
        "layer": LAYER_SCHEMA,
        "motion": MOTION_SCHEMA,
        "styleInference": STYLE_INFERENCE_SCHEMA
    }
}


def get_all_schemas():
    """Return all JSON schemas as a dictionary."""
    return {
        "dtcg_token": DTCG_TOKEN_SCHEMA,
        "component": COMPONENT_SCHEMA,
        "layer": LAYER_SCHEMA,
        "motion": MOTION_SCHEMA,
        "style_inference": STYLE_INFERENCE_SCHEMA,
        "unified_output": UNIFIED_OUTPUT_SCHEMA
    }
