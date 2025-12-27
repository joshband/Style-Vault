"""
Tests for DTCG Token Validator

Unit tests for W3C DTCG 2025.10 token validation.
"""

import pytest
from pipeline.normalize.dtcg_validator import (
    validate_dtcg_tokens,
    resolve_all_aliases,
    is_alias,
    extract_alias_path,
    validate_color_value,
    validate_dimension_value,
    DTCGTokenType,
)


class TestAliasDetection:
    """Tests for alias detection and resolution."""
    
    def test_is_alias_true(self):
        assert is_alias("{color.primary}") is True
        assert is_alias("{spacing.md}") is True
        assert is_alias("{deeply.nested.token}") is True
    
    def test_is_alias_false(self):
        assert is_alias("oklch(0.5 0.2 180)") is False
        assert is_alias("#ffffff") is False
        assert is_alias("16px") is False
        assert is_alias(123) is False
    
    def test_extract_alias_path(self):
        assert extract_alias_path("{color.primary}") == "color.primary"
        assert extract_alias_path("{spacing.md}") == "spacing.md"
        assert extract_alias_path("not-an-alias") is None


class TestColorValidation:
    """Tests for color value validation."""
    
    def test_valid_oklch(self):
        errors = validate_color_value("oklch(0.5 0.2 180)", "test")
        assert len(errors) == 0
    
    def test_valid_hex(self):
        errors = validate_color_value("#ffffff", "test")
        assert len(errors) == 0
    
    def test_valid_rgb(self):
        errors = validate_color_value("rgb(255, 255, 255)", "test")
        assert len(errors) == 0
    
    def test_invalid_color(self):
        errors = validate_color_value("not-a-color", "test")
        assert len(errors) == 1
        assert errors[0].error_type == "invalid_color"
    
    def test_alias_is_valid(self):
        errors = validate_color_value("{color.primary}", "test")
        assert len(errors) == 0


class TestDimensionValidation:
    """Tests for dimension value validation."""
    
    def test_valid_px(self):
        errors = validate_dimension_value("16px", "test")
        assert len(errors) == 0
    
    def test_valid_rem(self):
        errors = validate_dimension_value("1.5rem", "test")
        assert len(errors) == 0
    
    def test_valid_percent(self):
        errors = validate_dimension_value("100%", "test")
        assert len(errors) == 0
    
    def test_number_value(self):
        errors = validate_dimension_value(16, "test")
        assert len(errors) == 0


class TestTokenValidation:
    """Tests for complete token validation."""
    
    def test_valid_token_file(self):
        tokens = {
            "$schema": "https://design-tokens.org/schema.json",
            "color": {
                "primary": {
                    "$type": "color",
                    "$value": "oklch(0.5 0.2 180)",
                    "$description": "Primary color"
                }
            }
        }
        
        result = validate_dtcg_tokens(tokens)
        assert result.valid is True
        assert result.token_count == 1
        assert len(result.errors) == 0
    
    def test_missing_type(self):
        tokens = {
            "color": {
                "primary": {
                    "$value": "#ffffff"
                }
            }
        }
        
        result = validate_dtcg_tokens(tokens)
        assert result.valid is False
        assert any(e.error_type == "missing_type" for e in result.errors)
    
    def test_missing_value(self):
        tokens = {
            "color": {
                "primary": {
                    "$type": "color"
                }
            }
        }
        
        result = validate_dtcg_tokens(tokens)
        assert result.valid is False
        assert any(e.error_type == "missing_value" for e in result.errors)
    
    def test_invalid_type(self):
        tokens = {
            "color": {
                "primary": {
                    "$type": "invalid_type",
                    "$value": "#ffffff"
                }
            }
        }
        
        result = validate_dtcg_tokens(tokens)
        assert result.valid is False
        assert any(e.error_type == "invalid_type" for e in result.errors)
    
    def test_missing_description_warning(self):
        tokens = {
            "color": {
                "primary": {
                    "$type": "color",
                    "$value": "#ffffff"
                }
            }
        }
        
        result = validate_dtcg_tokens(tokens)
        assert any(w.error_type == "missing_description" for w in result.warnings)
    
    def test_unresolved_alias(self):
        tokens = {
            "color": {
                "secondary": {
                    "$type": "color",
                    "$value": "{color.nonexistent}"
                }
            }
        }
        
        result = validate_dtcg_tokens(tokens)
        assert result.valid is False
        assert any(e.error_type == "unresolved_alias" for e in result.errors)


class TestAliasResolution:
    """Tests for alias resolution."""
    
    def test_simple_alias_resolution(self):
        tokens = {
            "color": {
                "primary": {
                    "$type": "color",
                    "$value": "#ff0000"
                },
                "secondary": {
                    "$type": "color",
                    "$value": "{color.primary}"
                }
            }
        }
        
        resolved = resolve_all_aliases(tokens)
        assert resolved["color"]["secondary"]["$value"] == "#ff0000"
    
    def test_chained_alias_resolution(self):
        tokens = {
            "color": {
                "base": {
                    "$type": "color",
                    "$value": "#0000ff"
                },
                "primary": {
                    "$type": "color",
                    "$value": "{color.base}"
                },
                "secondary": {
                    "$type": "color",
                    "$value": "{color.primary}"
                }
            }
        }
        
        resolved = resolve_all_aliases(tokens)
        assert resolved["color"]["secondary"]["$value"] == "#0000ff"
    
    def test_non_alias_unchanged(self):
        tokens = {
            "spacing": {
                "md": {
                    "$type": "dimension",
                    "$value": "16px"
                }
            }
        }
        
        resolved = resolve_all_aliases(tokens)
        assert resolved["spacing"]["md"]["$value"] == "16px"


class TestTokenTypes:
    """Tests for token type enum."""
    
    def test_all_valid_types(self):
        expected_types = {
            "color", "dimension", "fontFamily", "fontWeight",
            "duration", "cubicBezier", "number", "strokeStyle",
            "border", "transition", "shadow", "gradient", "typography"
        }
        
        actual_types = {t.value for t in DTCGTokenType}
        assert expected_types == actual_types


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
