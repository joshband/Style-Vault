"""
Lineage & Provenance Tracking

Records which stage produced which data, pipeline version,
and intermediate artifacts for debugging and reproducibility.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
import json


PIPELINE_VERSION = "1.0.0"


@dataclass
class StageRecord:
    """Record of a single pipeline stage execution."""
    stage_name: str
    stage_version: str
    start_time: str
    end_time: str
    duration_ms: int
    input_hash: str
    output_hash: str
    status: str  # "success", "partial", "failed", "skipped"
    error: Optional[str] = None
    outputs: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "stageName": self.stage_name,
            "stageVersion": self.stage_version,
            "startTime": self.start_time,
            "endTime": self.end_time,
            "durationMs": self.duration_ms,
            "inputHash": self.input_hash,
            "outputHash": self.output_hash,
            "status": self.status,
            "outputs": self.outputs,
        }
        if self.error:
            result["error"] = self.error
        return result


@dataclass
class LineageRecord:
    """Complete lineage record for a style artifact."""
    style_id: str
    pipeline_version: str
    created_at: str
    source_image_hash: str
    stages: List[StageRecord]
    total_duration_ms: int
    model_versions: Dict[str, str]
    flags: Dict[str, bool]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "styleId": self.style_id,
            "pipelineVersion": self.pipeline_version,
            "createdAt": self.created_at,
            "sourceImageHash": self.source_image_hash,
            "stages": [s.to_dict() for s in self.stages],
            "totalDurationMs": self.total_duration_ms,
            "modelVersions": self.model_versions,
            "flags": self.flags,
        }


def compute_hash(data: Any) -> str:
    """Compute SHA-256 hash of data."""
    if isinstance(data, (dict, list)):
        data_str = json.dumps(data, sort_keys=True, default=str)
    elif isinstance(data, bytes):
        data_str = data
    else:
        data_str = str(data)
    
    if isinstance(data_str, str):
        data_str = data_str.encode('utf-8')
    
    return hashlib.sha256(data_str).hexdigest()[:16]


class LineageTracker:
    """Tracks lineage during pipeline execution."""
    
    def __init__(self, style_id: str, source_image_hash: str):
        self.style_id = style_id
        self.source_image_hash = source_image_hash
        self.stages: List[StageRecord] = []
        self.model_versions: Dict[str, str] = {}
        self.flags: Dict[str, bool] = {}
        self.created_at = datetime.utcnow().isoformat() + "Z"
        self._current_stage: Optional[Dict[str, Any]] = None
    
    def start_stage(self, stage_name: str, stage_version: str, input_data: Any):
        """Record start of a stage."""
        self._current_stage = {
            "stage_name": stage_name,
            "stage_version": stage_version,
            "start_time": datetime.utcnow().isoformat() + "Z",
            "input_hash": compute_hash(input_data),
        }
    
    def end_stage(
        self,
        output_data: Any,
        status: str = "success",
        error: Optional[str] = None,
        outputs: Optional[List[str]] = None
    ):
        """Record end of a stage."""
        if not self._current_stage:
            return
        
        end_time = datetime.utcnow().isoformat() + "Z"
        start = datetime.fromisoformat(self._current_stage["start_time"].rstrip("Z"))
        end = datetime.fromisoformat(end_time.rstrip("Z"))
        duration_ms = int((end - start).total_seconds() * 1000)
        
        record = StageRecord(
            stage_name=self._current_stage["stage_name"],
            stage_version=self._current_stage["stage_version"],
            start_time=self._current_stage["start_time"],
            end_time=end_time,
            duration_ms=duration_ms,
            input_hash=self._current_stage["input_hash"],
            output_hash=compute_hash(output_data),
            status=status,
            error=error,
            outputs=outputs or []
        )
        
        self.stages.append(record)
        self._current_stage = None
    
    def skip_stage(self, stage_name: str, stage_version: str, reason: str = ""):
        """Record a skipped stage."""
        now = datetime.utcnow().isoformat() + "Z"
        record = StageRecord(
            stage_name=stage_name,
            stage_version=stage_version,
            start_time=now,
            end_time=now,
            duration_ms=0,
            input_hash="",
            output_hash="",
            status="skipped",
            error=reason if reason else None
        )
        self.stages.append(record)
    
    def set_model_version(self, model_name: str, version: str):
        """Record a model version used."""
        self.model_versions[model_name] = version
    
    def set_flag(self, flag_name: str, value: bool):
        """Set a processing flag."""
        self.flags[flag_name] = value
    
    def get_lineage(self) -> LineageRecord:
        """Get the complete lineage record."""
        total_duration = sum(s.duration_ms for s in self.stages)
        
        return LineageRecord(
            style_id=self.style_id,
            pipeline_version=PIPELINE_VERSION,
            created_at=self.created_at,
            source_image_hash=self.source_image_hash,
            stages=self.stages,
            total_duration_ms=total_duration,
            model_versions=self.model_versions,
            flags=self.flags
        )


@dataclass
class IntermediateArtifact:
    """Reference to an intermediate artifact for debugging."""
    artifact_id: str
    stage_name: str
    artifact_type: str  # "mask", "depth_map", "embedding", "json"
    storage_path: str
    hash: str
    size_bytes: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "artifactId": self.artifact_id,
            "stageName": self.stage_name,
            "artifactType": self.artifact_type,
            "storagePath": self.storage_path,
            "hash": self.hash,
            "sizeBytes": self.size_bytes,
        }


class ArtifactRegistry:
    """Registry of intermediate artifacts."""
    
    def __init__(self, style_id: str):
        self.style_id = style_id
        self.artifacts: List[IntermediateArtifact] = []
    
    def register(
        self,
        stage_name: str,
        artifact_type: str,
        storage_path: str,
        data: bytes
    ) -> IntermediateArtifact:
        """Register an intermediate artifact."""
        artifact = IntermediateArtifact(
            artifact_id=f"{self.style_id}_{stage_name}_{len(self.artifacts)}",
            stage_name=stage_name,
            artifact_type=artifact_type,
            storage_path=storage_path,
            hash=compute_hash(data),
            size_bytes=len(data)
        )
        self.artifacts.append(artifact)
        return artifact
    
    def get_by_stage(self, stage_name: str) -> List[IntermediateArtifact]:
        """Get all artifacts from a stage."""
        return [a for a in self.artifacts if a.stage_name == stage_name]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "styleId": self.style_id,
            "artifacts": [a.to_dict() for a in self.artifacts]
        }
