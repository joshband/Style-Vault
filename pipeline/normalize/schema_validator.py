"""
JSON Schema Validator for Non-Token Data

Validates components, layers, lighting, materials, motion, and semantic data
against versioned JSON schemas.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import re


SCHEMA_VERSION = "1.0.0"


COMPONENT_SCHEMA = {
    "type": "object",
    "required": ["id", "type", "bbox"],
    "properties": {
        "id": {"type": "string"},
        "type": {"type": "string", "enum": ["button", "input", "card", "nav", "text_block", "image", "icon", "unknown"]},
        "bbox": {
            "type": "object",
            "required": ["x", "y", "width", "height"],
            "properties": {
                "x": {"type": "number"},
                "y": {"type": "number"},
                "width": {"type": "number"},
                "height": {"type": "number"},
            }
        },
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "maskPath": {"type": "string"},
        "tokenBindings": {"type": "object"},
        "variants": {"type": "array"},
        "behaviorHints": {"type": "object"},
    }
}


LAYER_SCHEMA = {
    "type": "object",
    "required": ["name", "depthRange"],
    "properties": {
        "name": {"type": "string", "enum": ["foreground", "midground", "background"]},
        "depthRange": {
            "type": "array",
            "items": {"type": "number"},
            "minItems": 2,
            "maxItems": 2,
        },
        "maskPath": {"type": "string"},
    }
}


LIGHTING_SCHEMA = {
    "type": "object",
    "required": ["direction", "shadowIntensity"],
    "properties": {
        "direction": {
            "type": "string",
            "enum": ["top", "top_left", "top_right", "left", "right", "bottom", "bottom_left", "bottom_right", "ambient"]
        },
        "shadowIntensity": {"type": "number", "minimum": 0, "maximum": 1},
        "highlightStrength": {"type": "number", "minimum": 0, "maximum": 1},
        "contrastGradient": {"type": "number", "minimum": 0, "maximum": 1},
        "keyLightPosition": {
            "type": "array",
            "items": {"type": "number"},
            "minItems": 3,
            "maxItems": 3,
        },
    }
}


MATERIALS_SCHEMA = {
    "type": "object",
    "properties": {
        "materials": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "confidence": {"type": "number"},
                }
            }
        },
        "textures": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "properties": {
                    "roughness": {"type": "number"},
                    "directionality": {"type": "number"},
                }
            }
        },
    }
}


MOTION_SCHEMA = {
    "type": "object",
    "required": ["component", "motion"],
    "properties": {
        "component": {"type": "string"},
        "componentType": {"type": "string"},
        "motion": {
            "type": "object",
            "required": ["type", "duration", "easing", "trigger"],
            "properties": {
                "type": {"type": "string"},
                "duration": {"type": "number", "minimum": 0},
                "easing": {"type": "string"},
                "trigger": {"type": "string"},
            }
        }
    }
}


STYLE_SEMANTICS_SCHEMA = {
    "type": "object",
    "properties": {
        "styleTags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tag": {"type": "string"},
                    "confidence": {"type": "number"},
                    "category": {"type": "string"},
                }
            }
        },
        "mood": {
            "type": "object",
            "properties": {
                "primary": {"type": "string"},
                "valence": {"type": "number"},
                "arousal": {"type": "number"},
            }
        },
        "embedding": {
            "type": "array",
            "items": {"type": "number"},
        },
        "caption": {"type": "string"},
    }
}


@dataclass
class SchemaError:
    """Schema validation error."""
    path: str
    error_type: str
    message: str
    expected: Optional[Any] = None
    actual: Optional[Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "path": self.path,
            "errorType": self.error_type,
            "message": self.message,
        }
        if self.expected:
            result["expected"] = self.expected
        if self.actual:
            result["actual"] = self.actual
        return result


@dataclass
class SchemaValidationResult:
    """Result of schema validation."""
    valid: bool
    schema_version: str
    errors: List[SchemaError] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "schemaVersion": self.schema_version,
            "errors": [e.to_dict() for e in self.errors],
        }


def validate_type(value: Any, expected_type: str, path: str) -> List[SchemaError]:
    """Validate a value against an expected type."""
    errors = []
    
    type_mapping = {
        "string": str,
        "number": (int, float),
        "boolean": bool,
        "array": list,
        "object": dict,
        "null": type(None),
    }
    
    expected_python_type = type_mapping.get(expected_type)
    if expected_python_type and not isinstance(value, expected_python_type):
        errors.append(SchemaError(
            path=path,
            error_type="type_mismatch",
            message=f"Expected {expected_type}, got {type(value).__name__}",
            expected=expected_type,
            actual=type(value).__name__
        ))
    
    return errors


def validate_enum(value: Any, enum_values: List[Any], path: str) -> List[SchemaError]:
    """Validate that value is in enum list."""
    errors = []
    if value not in enum_values:
        errors.append(SchemaError(
            path=path,
            error_type="invalid_enum",
            message=f"Value '{value}' not in allowed values",
            expected=enum_values,
            actual=value
        ))
    return errors


def validate_number_range(
    value: Any,
    minimum: Optional[float] = None,
    maximum: Optional[float] = None,
    path: str = ""
) -> List[SchemaError]:
    """Validate number is within range."""
    errors = []
    if isinstance(value, (int, float)):
        if minimum is not None and value < minimum:
            errors.append(SchemaError(
                path=path,
                error_type="value_too_small",
                message=f"Value {value} is less than minimum {minimum}",
                expected=f">= {minimum}",
                actual=value
            ))
        if maximum is not None and value > maximum:
            errors.append(SchemaError(
                path=path,
                error_type="value_too_large",
                message=f"Value {value} is greater than maximum {maximum}",
                expected=f"<= {maximum}",
                actual=value
            ))
    return errors


def validate_against_schema(
    data: Any,
    schema: Dict[str, Any],
    path: str = ""
) -> List[SchemaError]:
    """Validate data against a JSON schema."""
    errors = []
    
    schema_type = schema.get("type")
    if schema_type:
        errors.extend(validate_type(data, schema_type, path))
        if errors:
            return errors
    
    if schema_type == "object" and isinstance(data, dict):
        required = schema.get("required", [])
        for req_field in required:
            if req_field not in data:
                errors.append(SchemaError(
                    path=f"{path}.{req_field}" if path else req_field,
                    error_type="missing_required",
                    message=f"Missing required field: {req_field}"
                ))
        
        properties = schema.get("properties", {})
        for prop_name, prop_schema in properties.items():
            if prop_name in data:
                prop_path = f"{path}.{prop_name}" if path else prop_name
                errors.extend(validate_against_schema(data[prop_name], prop_schema, prop_path))
        
        additional = schema.get("additionalProperties")
        if isinstance(additional, dict):
            for key, value in data.items():
                if key not in properties:
                    key_path = f"{path}.{key}" if path else key
                    errors.extend(validate_against_schema(value, additional, key_path))
    
    elif schema_type == "array" and isinstance(data, list):
        items_schema = schema.get("items")
        if items_schema:
            for i, item in enumerate(data):
                item_path = f"{path}[{i}]"
                errors.extend(validate_against_schema(item, items_schema, item_path))
        
        min_items = schema.get("minItems")
        max_items = schema.get("maxItems")
        if min_items and len(data) < min_items:
            errors.append(SchemaError(
                path=path,
                error_type="array_too_short",
                message=f"Array has {len(data)} items, minimum is {min_items}"
            ))
        if max_items and len(data) > max_items:
            errors.append(SchemaError(
                path=path,
                error_type="array_too_long",
                message=f"Array has {len(data)} items, maximum is {max_items}"
            ))
    
    if "enum" in schema:
        errors.extend(validate_enum(data, schema["enum"], path))
    
    if isinstance(data, (int, float)):
        errors.extend(validate_number_range(
            data,
            schema.get("minimum"),
            schema.get("maximum"),
            path
        ))
    
    return errors


def validate_component(component: Dict[str, Any], path: str = "") -> SchemaValidationResult:
    """Validate a component object."""
    errors = validate_against_schema(component, COMPONENT_SCHEMA, path)
    return SchemaValidationResult(
        valid=len(errors) == 0,
        schema_version=SCHEMA_VERSION,
        errors=errors
    )


def validate_layer(layer: Dict[str, Any], path: str = "") -> SchemaValidationResult:
    """Validate a layer object."""
    errors = validate_against_schema(layer, LAYER_SCHEMA, path)
    return SchemaValidationResult(
        valid=len(errors) == 0,
        schema_version=SCHEMA_VERSION,
        errors=errors
    )


def validate_lighting(lighting: Dict[str, Any], path: str = "") -> SchemaValidationResult:
    """Validate lighting data."""
    errors = validate_against_schema(lighting, LIGHTING_SCHEMA, path)
    return SchemaValidationResult(
        valid=len(errors) == 0,
        schema_version=SCHEMA_VERSION,
        errors=errors
    )


def validate_materials(materials: Dict[str, Any], path: str = "") -> SchemaValidationResult:
    """Validate materials data."""
    errors = validate_against_schema(materials, MATERIALS_SCHEMA, path)
    return SchemaValidationResult(
        valid=len(errors) == 0,
        schema_version=SCHEMA_VERSION,
        errors=errors
    )


def validate_motion(motion: Dict[str, Any], path: str = "") -> SchemaValidationResult:
    """Validate a motion recommendation."""
    errors = validate_against_schema(motion, MOTION_SCHEMA, path)
    return SchemaValidationResult(
        valid=len(errors) == 0,
        schema_version=SCHEMA_VERSION,
        errors=errors
    )


def validate_style_semantics(semantics: Dict[str, Any], path: str = "") -> SchemaValidationResult:
    """Validate style semantics data."""
    errors = validate_against_schema(semantics, STYLE_SEMANTICS_SCHEMA, path)
    return SchemaValidationResult(
        valid=len(errors) == 0,
        schema_version=SCHEMA_VERSION,
        errors=errors
    )
