"""
Pipeline Orchestrator

Coordinates full pipeline execution across stages.
Handles async job creation, stage sequencing, and result aggregation.
"""

from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
import asyncio

from pipeline.normalize import (
    LineageTracker,
    assemble_canonical_artifact,
    CanonicalStyleArtifact,
)
from .job_queue import Job, JobStatus, JobPriority, create_job, InMemoryJobQueue, JobProcessor


@dataclass
class PipelineConfig:
    """Configuration for pipeline execution."""
    stages: List[str] = field(default_factory=lambda: [
        "ingest",
        "color_extraction",
        "layout_extraction",
        "typography_extraction",
        "depth_estimation",
        "component_detection",
        "style_inference",
        "material_analysis",
        "lighting_analysis",
        "motion_recommendation",
        "normalization",
    ])
    skip_stages: List[str] = field(default_factory=list)
    timeout_per_stage: int = 60
    max_retries: int = 3
    parallel_stages: bool = False


@dataclass
class StageResult:
    """Result from a single stage."""
    stage_name: str
    status: str
    duration_ms: int
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class PipelineRun:
    """Represents a single pipeline run."""
    run_id: str
    style_id: str
    config: PipelineConfig
    status: str = "pending"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    current_stage: Optional[str] = None
    stage_results: Dict[str, StageResult] = field(default_factory=dict)
    final_artifact: Optional[CanonicalStyleArtifact] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "runId": self.run_id,
            "styleId": self.style_id,
            "status": self.status,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
            "currentStage": self.current_stage,
            "stageResults": {k: v.__dict__ for k, v in self.stage_results.items()},
            "hasArtifact": self.final_artifact is not None,
        }


class PipelineOrchestrator:
    """Orchestrates pipeline execution."""
    
    def __init__(
        self,
        job_queue: Optional[InMemoryJobQueue] = None,
        stage_handlers: Optional[Dict[str, Callable]] = None
    ):
        self.job_queue = job_queue or InMemoryJobQueue()
        self.stage_handlers = stage_handlers or {}
        self.runs: Dict[str, PipelineRun] = {}
        self._processor: Optional[JobProcessor] = None
    
    def register_stage_handler(self, stage_name: str, handler: Callable):
        """Register a handler for a pipeline stage."""
        self.stage_handlers[stage_name] = handler
    
    async def start_pipeline(
        self,
        style_id: str,
        input_data: Dict[str, Any],
        config: Optional[PipelineConfig] = None
    ) -> str:
        """
        Start a new pipeline run.
        
        Args:
            style_id: ID for the resulting style
            input_data: Initial input (image path, base64, etc.)
            config: Pipeline configuration
        
        Returns:
            run_id for tracking the pipeline
        """
        import uuid
        
        run_id = str(uuid.uuid4())
        config = config or PipelineConfig()
        
        run = PipelineRun(
            run_id=run_id,
            style_id=style_id,
            config=config,
            status="running",
            started_at=datetime.utcnow().isoformat() + "Z",
        )
        self.runs[run_id] = run
        
        asyncio.create_task(self._execute_pipeline(run, input_data))
        
        return run_id
    
    async def _execute_pipeline(
        self,
        run: PipelineRun,
        input_data: Dict[str, Any]
    ):
        """Execute the pipeline stages."""
        lineage = LineageTracker(run.style_id, input_data.get("hash", "unknown"))
        stage_outputs: Dict[str, Any] = {"input": input_data}
        
        try:
            for stage_name in run.config.stages:
                if stage_name in run.config.skip_stages:
                    lineage.skip_stage(stage_name, "1.0", "skipped by config")
                    continue
                
                run.current_stage = stage_name
                
                handler = self.stage_handlers.get(stage_name)
                if not handler:
                    lineage.skip_stage(stage_name, "1.0", "no handler")
                    continue
                
                lineage.start_stage(stage_name, "1.0", stage_outputs)
                start_time = datetime.utcnow()
                
                try:
                    if asyncio.iscoroutinefunction(handler):
                        result = await asyncio.wait_for(
                            handler(stage_outputs),
                            timeout=run.config.timeout_per_stage
                        )
                    else:
                        result = handler(stage_outputs)
                    
                    duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                    
                    stage_outputs[stage_name] = result
                    
                    run.stage_results[stage_name] = StageResult(
                        stage_name=stage_name,
                        status="success",
                        duration_ms=duration_ms,
                        output=result
                    )
                    
                    lineage.end_stage(result, "success")
                    
                except asyncio.TimeoutError:
                    duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                    run.stage_results[stage_name] = StageResult(
                        stage_name=stage_name,
                        status="timeout",
                        duration_ms=duration_ms,
                        error=f"Stage timed out after {run.config.timeout_per_stage}s"
                    )
                    lineage.end_stage({}, "failed", "timeout")
                    
                except Exception as e:
                    duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                    run.stage_results[stage_name] = StageResult(
                        stage_name=stage_name,
                        status="error",
                        duration_ms=duration_ms,
                        error=str(e)
                    )
                    lineage.end_stage({}, "failed", str(e))
            
            artifact_result = assemble_canonical_artifact(
                tokens=stage_outputs.get("normalization", {}).get("tokens", {}),
                components=stage_outputs.get("component_detection", {}).get("components", []),
                layers=stage_outputs.get("material_analysis", {}).get("layers", []),
                style_semantics=stage_outputs.get("style_inference", {}),
                lighting=stage_outputs.get("lighting_analysis", {}),
                materials=stage_outputs.get("material_analysis", {}).get("materials", {}),
                motion=stage_outputs.get("motion_recommendation", {}).get("recommendations", []),
                lineage=lineage.get_lineage(),
                style_id=run.style_id,
            )
            
            run.final_artifact = artifact_result.artifact
            run.status = "completed"
            
        except Exception as e:
            run.status = "failed"
            run.stage_results["_pipeline"] = StageResult(
                stage_name="_pipeline",
                status="error",
                duration_ms=0,
                error=str(e)
            )
        
        run.completed_at = datetime.utcnow().isoformat() + "Z"
        run.current_stage = None
    
    async def get_run(self, run_id: str) -> Optional[PipelineRun]:
        """Get a pipeline run by ID."""
        return self.runs.get(run_id)
    
    async def get_run_status(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a pipeline run."""
        run = self.runs.get(run_id)
        if not run:
            return None
        return run.to_dict()
    
    async def cancel_run(self, run_id: str) -> bool:
        """Cancel a pipeline run."""
        run = self.runs.get(run_id)
        if run and run.status == "running":
            run.status = "cancelled"
            run.completed_at = datetime.utcnow().isoformat() + "Z"
            return True
        return False
    
    async def get_artifact(self, run_id: str) -> Optional[CanonicalStyleArtifact]:
        """Get the final artifact from a completed run."""
        run = self.runs.get(run_id)
        if run and run.final_artifact:
            return run.final_artifact
        return None


class PipelineJobHandlers:
    """Pre-built job handlers for pipeline stages."""
    
    @staticmethod
    async def ingest_handler(job: Job) -> Dict[str, Any]:
        """Handle image ingestion job."""
        payload = job.payload
        image_path = payload.get("imagePath")
        
        from pipeline.ingest import ingest_image
        result = ingest_image(image_path)
        
        return result.to_dict() if result else {}
    
    @staticmethod
    async def color_extraction_handler(job: Job) -> Dict[str, Any]:
        """Handle color extraction job."""
        payload = job.payload
        image_path = payload.get("imagePath")
        
        from pipeline.extract.color import extract_colors
        result = extract_colors(image_path)
        
        return result.to_dict() if result else {}
    
    @staticmethod
    async def full_pipeline_handler(job: Job) -> Dict[str, Any]:
        """Handle full pipeline execution job."""
        payload = job.payload
        image_path = payload.get("imagePath")
        style_id = payload.get("styleId")
        
        orchestrator = PipelineOrchestrator()
        run_id = await orchestrator.start_pipeline(
            style_id=style_id,
            input_data={"imagePath": image_path}
        )
        
        while True:
            run = await orchestrator.get_run(run_id)
            if run and run.status in ("completed", "failed", "cancelled"):
                break
            await asyncio.sleep(0.5)
        
        run = await orchestrator.get_run(run_id)
        if run and run.final_artifact:
            return run.final_artifact.to_dict()
        
        return {"error": "Pipeline failed", "run": run.to_dict() if run else None}
