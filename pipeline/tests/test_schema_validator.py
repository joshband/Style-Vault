"""
Tests for Schema Validator

Unit tests for non-token data schema validation.
"""

import pytest
from pipeline.normalize.schema_validator import (
    validate_component,
    validate_layer,
    validate_lighting,
    validate_materials,
    validate_motion,
    validate_style_semantics,
    SCHEMA_VERSION,
)


class TestComponentValidation:
    """Tests for component schema validation."""
    
    def test_valid_component(self):
        component = {
            "id": "btn_1",
            "type": "button",
            "bbox": {"x": 10, "y": 20, "width": 100, "height": 40},
            "confidence": 0.95
        }
        
        result = validate_component(component)
        assert result.valid is True
        assert len(result.errors) == 0
    
    def test_missing_required_id(self):
        component = {
            "type": "button",
            "bbox": {"x": 10, "y": 20, "width": 100, "height": 40}
        }
        
        result = validate_component(component)
        assert result.valid is False
        assert any("id" in e.message for e in result.errors)
    
    def test_invalid_type_enum(self):
        component = {
            "id": "comp_1",
            "type": "invalid_type",
            "bbox": {"x": 10, "y": 20, "width": 100, "height": 40}
        }
        
        result = validate_component(component)
        assert result.valid is False
        assert any(e.error_type == "invalid_enum" for e in result.errors)
    
    def test_missing_bbox_field(self):
        component = {
            "id": "btn_1",
            "type": "button",
            "bbox": {"x": 10, "y": 20}  # Missing width and height
        }
        
        result = validate_component(component)
        assert result.valid is False
    
    def test_confidence_out_of_range(self):
        component = {
            "id": "btn_1",
            "type": "button",
            "bbox": {"x": 10, "y": 20, "width": 100, "height": 40},
            "confidence": 1.5  # Out of range
        }
        
        result = validate_component(component)
        assert result.valid is False


class TestLayerValidation:
    """Tests for layer schema validation."""
    
    def test_valid_layer(self):
        layer = {
            "name": "foreground",
            "depthRange": [0.0, 0.3]
        }
        
        result = validate_layer(layer)
        assert result.valid is True
    
    def test_invalid_layer_name(self):
        layer = {
            "name": "invalid_layer",
            "depthRange": [0.0, 0.3]
        }
        
        result = validate_layer(layer)
        assert result.valid is False
    
    def test_missing_depth_range(self):
        layer = {
            "name": "foreground"
        }
        
        result = validate_layer(layer)
        assert result.valid is False


class TestLightingValidation:
    """Tests for lighting schema validation."""
    
    def test_valid_lighting(self):
        lighting = {
            "direction": "top_left",
            "shadowIntensity": 0.5,
            "highlightStrength": 0.3
        }
        
        result = validate_lighting(lighting)
        assert result.valid is True
    
    def test_invalid_direction(self):
        lighting = {
            "direction": "invalid_direction",
            "shadowIntensity": 0.5
        }
        
        result = validate_lighting(lighting)
        assert result.valid is False


class TestMaterialsValidation:
    """Tests for materials schema validation."""
    
    def test_valid_materials(self):
        materials = {
            "materials": {
                "surface_1": {
                    "type": "glossy",
                    "confidence": 0.8
                }
            },
            "textures": {}
        }
        
        result = validate_materials(materials)
        assert result.valid is True


class TestMotionValidation:
    """Tests for motion schema validation."""
    
    def test_valid_motion(self):
        motion = {
            "component": "btn_1",
            "componentType": "button",
            "motion": {
                "type": "scale",
                "duration": 200,
                "easing": "ease-out",
                "trigger": "hover"
            }
        }
        
        result = validate_motion(motion)
        assert result.valid is True
    
    def test_missing_motion_field(self):
        motion = {
            "component": "btn_1",
            "motion": {
                "type": "scale",
                "duration": 200
                # Missing easing and trigger
            }
        }
        
        result = validate_motion(motion)
        assert result.valid is False
    
    def test_negative_duration(self):
        motion = {
            "component": "btn_1",
            "motion": {
                "type": "scale",
                "duration": -100,  # Invalid
                "easing": "ease-out",
                "trigger": "hover"
            }
        }
        
        result = validate_motion(motion)
        assert result.valid is False


class TestStyleSemanticsValidation:
    """Tests for style semantics schema validation."""
    
    def test_valid_semantics(self):
        semantics = {
            "styleTags": [
                {"tag": "modern", "confidence": 0.9, "category": "era"}
            ],
            "mood": {
                "primary": "professional",
                "valence": 0.6,
                "arousal": 0.4
            },
            "caption": "A modern, professional UI design"
        }
        
        result = validate_style_semantics(semantics)
        assert result.valid is True
    
    def test_schema_version(self):
        result = validate_component({"id": "test", "type": "button", "bbox": {"x": 0, "y": 0, "width": 10, "height": 10}})
        assert result.schema_version == SCHEMA_VERSION


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
