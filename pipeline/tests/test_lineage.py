"""
Tests for Lineage Tracking

Unit tests for provenance and reproducibility tracking.
"""

import pytest
from pipeline.normalize.lineage import (
    LineageTracker,
    ArtifactRegistry,
    compute_hash,
    PIPELINE_VERSION,
)


class TestComputeHash:
    """Tests for hash computation."""
    
    def test_dict_hash(self):
        data = {"key": "value"}
        hash1 = compute_hash(data)
        hash2 = compute_hash(data)
        assert hash1 == hash2
        assert len(hash1) == 16
    
    def test_different_data_different_hash(self):
        hash1 = compute_hash({"a": 1})
        hash2 = compute_hash({"b": 2})
        assert hash1 != hash2
    
    def test_bytes_hash(self):
        data = b"binary data"
        hash_val = compute_hash(data)
        assert len(hash_val) == 16
    
    def test_string_hash(self):
        data = "string data"
        hash_val = compute_hash(data)
        assert len(hash_val) == 16


class TestLineageTracker:
    """Tests for lineage tracking."""
    
    def test_create_tracker(self):
        tracker = LineageTracker("style_123", "image_hash")
        assert tracker.style_id == "style_123"
        assert tracker.source_image_hash == "image_hash"
    
    def test_start_and_end_stage(self):
        tracker = LineageTracker("style_123", "image_hash")
        
        tracker.start_stage("color_extraction", "1.0", {"input": "test"})
        tracker.end_stage({"colors": ["#fff"]}, "success", outputs=["colors.json"])
        
        lineage = tracker.get_lineage()
        assert len(lineage.stages) == 1
        assert lineage.stages[0].stage_name == "color_extraction"
        assert lineage.stages[0].status == "success"
    
    def test_skip_stage(self):
        tracker = LineageTracker("style_123", "image_hash")
        
        tracker.skip_stage("depth_estimation", "1.0", "no model available")
        
        lineage = tracker.get_lineage()
        assert len(lineage.stages) == 1
        assert lineage.stages[0].status == "skipped"
    
    def test_set_model_version(self):
        tracker = LineageTracker("style_123", "image_hash")
        
        tracker.set_model_version("clip", "ViT-B/32")
        tracker.set_model_version("depth", "v2-base")
        
        lineage = tracker.get_lineage()
        assert lineage.model_versions["clip"] == "ViT-B/32"
        assert lineage.model_versions["depth"] == "v2-base"
    
    def test_set_flag(self):
        tracker = LineageTracker("style_123", "image_hash")
        
        tracker.set_flag("use_gpu", True)
        tracker.set_flag("debug_mode", False)
        
        lineage = tracker.get_lineage()
        assert lineage.flags["use_gpu"] is True
        assert lineage.flags["debug_mode"] is False
    
    def test_total_duration(self):
        tracker = LineageTracker("style_123", "image_hash")
        
        tracker.start_stage("stage1", "1.0", {})
        tracker.end_stage({}, "success")
        
        tracker.start_stage("stage2", "1.0", {})
        tracker.end_stage({}, "success")
        
        lineage = tracker.get_lineage()
        assert lineage.total_duration_ms >= 0
    
    def test_pipeline_version(self):
        tracker = LineageTracker("style_123", "image_hash")
        lineage = tracker.get_lineage()
        
        assert lineage.pipeline_version == PIPELINE_VERSION
    
    def test_lineage_to_dict(self):
        tracker = LineageTracker("style_123", "image_hash")
        tracker.start_stage("test", "1.0", {})
        tracker.end_stage({}, "success")
        
        lineage = tracker.get_lineage()
        d = lineage.to_dict()
        
        assert "styleId" in d
        assert "pipelineVersion" in d
        assert "stages" in d
        assert "modelVersions" in d


class TestArtifactRegistry:
    """Tests for intermediate artifact registry."""
    
    def test_register_artifact(self):
        registry = ArtifactRegistry("style_123")
        
        artifact = registry.register(
            stage_name="depth",
            artifact_type="depth_map",
            storage_path="/tmp/depth.png",
            data=b"fake image data"
        )
        
        assert artifact.stage_name == "depth"
        assert artifact.artifact_type == "depth_map"
        assert artifact.size_bytes == len(b"fake image data")
    
    def test_get_by_stage(self):
        registry = ArtifactRegistry("style_123")
        
        registry.register("depth", "depth_map", "/tmp/depth.png", b"depth")
        registry.register("color", "palette", "/tmp/palette.json", b"colors")
        registry.register("depth", "depth_json", "/tmp/depth.json", b"json")
        
        depth_artifacts = registry.get_by_stage("depth")
        assert len(depth_artifacts) == 2
        
        color_artifacts = registry.get_by_stage("color")
        assert len(color_artifacts) == 1
    
    def test_to_dict(self):
        registry = ArtifactRegistry("style_123")
        registry.register("test", "json", "/tmp/test.json", b"data")
        
        d = registry.to_dict()
        assert d["styleId"] == "style_123"
        assert len(d["artifacts"]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
