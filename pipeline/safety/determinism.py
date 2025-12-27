"""
Determinism & Reproducibility

Ensures pipeline outputs are reproducible and tracks changes.
"""

from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass
import hashlib
import json
import functools


@dataclass
class DeterminismCheck:
    """Result of a determinism check."""
    is_deterministic: bool
    input_hash: str
    output_hash: str
    mismatch_fields: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "isDeterministic": self.is_deterministic,
            "inputHash": self.input_hash,
            "outputHash": self.output_hash,
            "mismatchFields": self.mismatch_fields,
        }


class DeterminismChecker:
    """Checks and ensures determinism of pipeline stages."""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
    
    def compute_hash(self, data: Any) -> str:
        """Compute a hash of any data structure."""
        if isinstance(data, (dict, list)):
            serialized = json.dumps(data, sort_keys=True, default=str)
        else:
            serialized = str(data)
        return hashlib.sha256(serialized.encode()).hexdigest()[:16]
    
    def check(
        self,
        stage_name: str,
        input_data: Any,
        output_data: Any
    ) -> DeterminismCheck:
        """
        Check if output is deterministic for given input.
        
        Compares output to previously cached output for the same input.
        """
        input_hash = self.compute_hash(input_data)
        output_hash = self.compute_hash(output_data)
        
        cache_key = f"{stage_name}:{input_hash}"
        
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            cached_output_hash = cached["output_hash"]
            
            if cached_output_hash != output_hash:
                mismatches = self._find_mismatches(
                    cached.get("output_sample", {}),
                    output_data if isinstance(output_data, dict) else {}
                )
                return DeterminismCheck(
                    is_deterministic=False,
                    input_hash=input_hash,
                    output_hash=output_hash,
                    mismatch_fields=mismatches
                )
        else:
            self._cache[cache_key] = {
                "input_hash": input_hash,
                "output_hash": output_hash,
                "output_sample": output_data if isinstance(output_data, dict) else {}
            }
        
        return DeterminismCheck(
            is_deterministic=True,
            input_hash=input_hash,
            output_hash=output_hash,
            mismatch_fields=[]
        )
    
    def _find_mismatches(
        self,
        expected: Dict[str, Any],
        actual: Dict[str, Any],
        prefix: str = ""
    ) -> List[str]:
        """Find which fields differ between expected and actual."""
        mismatches = []
        
        all_keys = set(expected.keys()) | set(actual.keys())
        
        for key in all_keys:
            full_key = f"{prefix}.{key}" if prefix else key
            
            if key not in expected:
                mismatches.append(f"+{full_key}")
            elif key not in actual:
                mismatches.append(f"-{full_key}")
            elif expected[key] != actual[key]:
                if isinstance(expected[key], dict) and isinstance(actual[key], dict):
                    mismatches.extend(
                        self._find_mismatches(expected[key], actual[key], full_key)
                    )
                else:
                    mismatches.append(full_key)
        
        return mismatches[:10]
    
    def clear_cache(self, stage_name: Optional[str] = None):
        """Clear determinism cache."""
        if stage_name:
            keys_to_remove = [
                k for k in self._cache.keys()
                if k.startswith(f"{stage_name}:")
            ]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            self._cache.clear()


@dataclass
class Checkpoint:
    """A checkpoint of pipeline state."""
    checkpoint_id: str
    stage_name: str
    input_hash: str
    output: Dict[str, Any]
    created_at: str


class CheckpointManager:
    """Manages checkpoints for debugging and recovery."""
    
    def __init__(self, max_checkpoints: int = 100):
        self.max_checkpoints = max_checkpoints
        self._checkpoints: Dict[str, Checkpoint] = {}
        self._order: List[str] = []
    
    def create(
        self,
        stage_name: str,
        input_hash: str,
        output: Dict[str, Any]
    ) -> str:
        """Create a checkpoint."""
        from datetime import datetime
        import uuid
        
        checkpoint_id = str(uuid.uuid4())[:8]
        
        checkpoint = Checkpoint(
            checkpoint_id=checkpoint_id,
            stage_name=stage_name,
            input_hash=input_hash,
            output=output,
            created_at=datetime.utcnow().isoformat() + "Z"
        )
        
        self._checkpoints[checkpoint_id] = checkpoint
        self._order.append(checkpoint_id)
        
        while len(self._order) > self.max_checkpoints:
            oldest = self._order.pop(0)
            del self._checkpoints[oldest]
        
        return checkpoint_id
    
    def get(self, checkpoint_id: str) -> Optional[Checkpoint]:
        """Get a checkpoint by ID."""
        return self._checkpoints.get(checkpoint_id)
    
    def get_by_stage(self, stage_name: str) -> List[Checkpoint]:
        """Get all checkpoints for a stage."""
        return [
            cp for cp in self._checkpoints.values()
            if cp.stage_name == stage_name
        ]
    
    def get_latest(self, stage_name: Optional[str] = None) -> Optional[Checkpoint]:
        """Get the latest checkpoint."""
        if not self._order:
            return None
        
        if stage_name:
            for cp_id in reversed(self._order):
                cp = self._checkpoints[cp_id]
                if cp.stage_name == stage_name:
                    return cp
            return None
        
        return self._checkpoints[self._order[-1]]


def ensure_deterministic(checker: DeterminismChecker, stage_name: str):
    """Decorator to ensure a function produces deterministic output."""
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(input_data, *args, **kwargs):
            output = func(input_data, *args, **kwargs)
            
            check_result = checker.check(stage_name, input_data, output)
            
            if not check_result.is_deterministic:
                import warnings
                warnings.warn(
                    f"Non-deterministic output detected in {stage_name}. "
                    f"Mismatched fields: {check_result.mismatch_fields}"
                )
            
            return output
        
        return wrapper
    return decorator


class SchemaVersionManager:
    """Manages schema versions for backward compatibility."""
    
    CURRENT_VERSION = "1.0.0"
    SUPPORTED_VERSIONS = ["1.0.0"]
    
    @classmethod
    def is_supported(cls, version: str) -> bool:
        """Check if a schema version is supported."""
        return version in cls.SUPPORTED_VERSIONS
    
    @classmethod
    def migrate(
        cls,
        data: Dict[str, Any],
        from_version: str,
        to_version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Migrate data from one schema version to another.
        
        Currently no migrations needed for v1.0.0.
        """
        to_version = to_version or cls.CURRENT_VERSION
        
        if from_version == to_version:
            return data
        
        if not cls.is_supported(from_version):
            raise ValueError(f"Unsupported schema version: {from_version}")
        
        return data
    
    @classmethod
    def add_version(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add schema version to data if not present."""
        if "_schemaVersion" not in data:
            data["_schemaVersion"] = cls.CURRENT_VERSION
        return data
