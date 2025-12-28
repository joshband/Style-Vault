"""
Tests for Canonical Assembler

Unit tests for final artifact assembly.
"""

import pytest
from pipeline.normalize.canonical_assembler import (
    assemble_canonical_artifact,
    merge_artifacts,
    generate_style_id,
    CanonicalStyleArtifact,
)


class TestGenerateStyleId:
    """Tests for style ID generation."""
    
    def test_generates_unique_ids(self):
        id1 = generate_style_id()
        id2 = generate_style_id()
        assert id1 != id2
    
    def test_id_length(self):
        style_id = generate_style_id()
        assert len(style_id) == 8


class TestAssembleCanonicalArtifact:
    """Tests for canonical artifact assembly."""
    
    def test_assemble_minimal(self):
        result = assemble_canonical_artifact(
            tokens={},
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[]
        )
        
        assert result.artifact is not None
        assert result.artifact.style_id is not None
    
    def test_assemble_with_data(self):
        tokens = {
            "$schema": "https://design-tokens.org/schema.json",
            "color": {
                "primary": {
                    "$type": "color",
                    "$value": "#ff0000",
                    "$description": "Primary color"
                }
            }
        }
        
        components = [
            {
                "id": "btn_1",
                "type": "button",
                "bbox": {"x": 0, "y": 0, "width": 100, "height": 40}
            }
        ]
        
        result = assemble_canonical_artifact(
            tokens=tokens,
            components=components,
            layers=[{"name": "foreground", "depthRange": [0, 0.3]}],
            style_semantics={"styleTags": [{"tag": "modern"}]},
            lighting={"direction": "top", "shadowIntensity": 0.5},
            materials={"materials": {}},
            motion=[]
        )
        
        assert result.is_valid is True
        assert result.is_partial is False
        assert result.artifact.flags["hasTokens"] is True
        assert result.artifact.flags["hasComponents"] is True
    
    def test_assemble_with_style_id(self):
        result = assemble_canonical_artifact(
            tokens={},
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            style_id="custom_id"
        )
        
        assert result.artifact.style_id == "custom_id"
    
    def test_assemble_with_validation(self):
        tokens = {
            "color": {
                "bad_token": {
                    "$value": "#fff"  # Missing $type
                }
            }
        }
        
        result = assemble_canonical_artifact(
            tokens=tokens,
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            validate=True
        )
        
        assert result.is_valid is False
        assert len(result.token_validation.errors) > 0
    
    def test_assemble_without_validation(self):
        tokens = {
            "color": {
                "bad_token": {
                    "$value": "#fff"  # Missing $type
                }
            }
        }
        
        result = assemble_canonical_artifact(
            tokens=tokens,
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            validate=False
        )
        
        assert result.is_valid is True
    
    def test_partial_artifact(self):
        result = assemble_canonical_artifact(
            tokens={},  # No tokens
            components=[],  # No components
            layers=[],
            style_semantics={},  # No semantics
            lighting={},
            materials={},
            motion=[]
        )
        
        assert result.is_partial is True
        assert result.artifact.flags["isPartial"] is True
    
    def test_artifact_to_dict(self):
        result = assemble_canonical_artifact(
            tokens={"$schema": "test"},
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[]
        )
        
        d = result.artifact.to_dict()
        
        assert "styleId" in d
        assert "version" in d
        assert "createdAt" in d
        assert "tokens" in d
        assert "components" in d
        assert "lineage" in d


class TestMergeArtifacts:
    """Tests for artifact merging."""
    
    def test_merge_tokens(self):
        base = CanonicalStyleArtifact(
            style_id="base",
            version="1.0",
            created_at="2024-01-01T00:00:00Z",
            tokens={"color": {"primary": {"$value": "#fff"}}},
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            lineage={}
        )
        
        overlay = CanonicalStyleArtifact(
            style_id="overlay",
            version="1.0",
            created_at="2024-01-01T00:00:00Z",
            tokens={"color": {"secondary": {"$value": "#000"}}},
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            lineage={}
        )
        
        merged = merge_artifacts(base, overlay)
        
        assert "primary" in merged.tokens["color"]
        assert "secondary" in merged.tokens["color"]
    
    def test_merge_components(self):
        base = CanonicalStyleArtifact(
            style_id="base",
            version="1.0",
            created_at="2024-01-01T00:00:00Z",
            tokens={},
            components=[{"id": "btn_1", "type": "button"}],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            lineage={}
        )
        
        overlay = CanonicalStyleArtifact(
            style_id="overlay",
            version="1.0",
            created_at="2024-01-01T00:00:00Z",
            tokens={},
            components=[{"id": "card_1", "type": "card"}],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            lineage={}
        )
        
        merged = merge_artifacts(base, overlay)
        
        assert len(merged.components) == 2
    
    def test_merge_flags(self):
        base = CanonicalStyleArtifact(
            style_id="base",
            version="1.0",
            created_at="",
            tokens={},
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            lineage={},
            flags={}
        )
        
        overlay = CanonicalStyleArtifact(
            style_id="overlay",
            version="1.0",
            created_at="",
            tokens={},
            components=[],
            layers=[],
            style_semantics={},
            lighting={},
            materials={},
            motion=[],
            lineage={},
            flags={}
        )
        
        merged = merge_artifacts(base, overlay)
        
        assert merged.flags.get("merged") is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
