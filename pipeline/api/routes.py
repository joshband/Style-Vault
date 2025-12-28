"""
API Routes

REST endpoints for pipeline operations.
Designed for GCP Cloud Run deployment.
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import json


@dataclass
class APIResponse:
    """Standard API response."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {"success": self.success}
        if self.data:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        return result
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())


class PipelineAPIRoutes:
    """
    API route handlers for the pipeline.
    
    Endpoints:
        POST /ingest/image - Ingest an image and start extraction
        POST /ingest/prompt - Create style from text prompt
        GET  /styles/:id - Get complete style artifact
        GET  /styles/:id/tokens - Get DTCG tokens only
        GET  /styles/:id/components - Get components only
        GET  /styles/:id/layers - Get layers only
        GET  /styles/:id/semantics - Get style semantics
        GET  /styles/:id/depth - Get depth data
        GET  /styles/:id/lighting - Get lighting data
        GET  /styles/:id/motion - Get motion recommendations
        GET  /jobs/:id - Get job status
    """
    
    def __init__(self, storage, orchestrator):
        self.storage = storage
        self.orchestrator = orchestrator
    
    async def ingest_image(self, request: Dict[str, Any]) -> APIResponse:
        """
        POST /ingest/image
        
        Accepts image data and starts pipeline extraction.
        
        Body:
            - imagePath: str (path to image)
            - imageBase64: str (base64 encoded image)
            - styleId: str (optional, auto-generated if not provided)
            - config: dict (optional pipeline configuration)
        
        Returns:
            - jobId: str (for polling)
            - styleId: str (to retrieve results)
        """
        image_path = request.get("imagePath")
        image_base64 = request.get("imageBase64")
        style_id = request.get("styleId")
        config = request.get("config")
        
        if not image_path and not image_base64:
            return APIResponse(
                success=False,
                error="Either imagePath or imageBase64 required"
            )
        
        from pipeline.normalize import generate_style_id
        if not style_id:
            style_id = generate_style_id()
        
        try:
            run_id = await self.orchestrator.start_pipeline(
                style_id=style_id,
                input_data={
                    "imagePath": image_path,
                    "imageBase64": image_base64,
                }
            )
            
            return APIResponse(
                success=True,
                data={
                    "jobId": run_id,
                    "styleId": style_id,
                    "status": "processing",
                }
            )
        except Exception as e:
            return APIResponse(success=False, error=str(e))
    
    async def ingest_prompt(self, request: Dict[str, Any]) -> APIResponse:
        """
        POST /ingest/prompt
        
        Creates a style from a text prompt using AI generation.
        
        Body:
            - prompt: str (style description)
            - styleId: str (optional)
        """
        prompt = request.get("prompt")
        style_id = request.get("styleId")
        
        if not prompt:
            return APIResponse(
                success=False,
                error="prompt is required"
            )
        
        from pipeline.normalize import generate_style_id
        if not style_id:
            style_id = generate_style_id()
        
        return APIResponse(
            success=True,
            data={
                "styleId": style_id,
                "status": "prompt_ingestion_not_implemented",
                "message": "Prompt-based style creation coming soon"
            }
        )
    
    async def get_style(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id
        
        Returns the complete style artifact.
        """
        artifact = await self.storage.get_style(style_id)
        
        if not artifact:
            return APIResponse(
                success=False,
                error=f"Style not found: {style_id}"
            )
        
        return APIResponse(success=True, data=artifact)
    
    async def get_style_tokens(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id/tokens
        
        Returns only the DTCG tokens.
        """
        artifact = await self.storage.get_style(style_id)
        
        if not artifact:
            return APIResponse(
                success=False,
                error=f"Style not found: {style_id}"
            )
        
        return APIResponse(
            success=True,
            data={"tokens": artifact.get("tokens", {})}
        )
    
    async def get_style_components(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id/components
        """
        artifact = await self.storage.get_style(style_id)
        
        if not artifact:
            return APIResponse(
                success=False,
                error=f"Style not found: {style_id}"
            )
        
        return APIResponse(
            success=True,
            data={"components": artifact.get("components", [])}
        )
    
    async def get_style_layers(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id/layers
        """
        artifact = await self.storage.get_style(style_id)
        
        if not artifact:
            return APIResponse(
                success=False,
                error=f"Style not found: {style_id}"
            )
        
        return APIResponse(
            success=True,
            data={"layers": artifact.get("layers", [])}
        )
    
    async def get_style_semantics(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id/semantics
        """
        artifact = await self.storage.get_style(style_id)
        
        if not artifact:
            return APIResponse(
                success=False,
                error=f"Style not found: {style_id}"
            )
        
        return APIResponse(
            success=True,
            data={"styleSemantics": artifact.get("styleSemantics", {})}
        )
    
    async def get_style_depth(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id/depth
        """
        depth_data = await self.storage.get_style_depth(style_id)
        
        if not depth_data:
            return APIResponse(
                success=False,
                error=f"Depth data not found for style: {style_id}"
            )
        
        return APIResponse(success=True, data=depth_data)
    
    async def get_style_lighting(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id/lighting
        """
        artifact = await self.storage.get_style(style_id)
        
        if not artifact:
            return APIResponse(
                success=False,
                error=f"Style not found: {style_id}"
            )
        
        return APIResponse(
            success=True,
            data={"lighting": artifact.get("lighting", {})}
        )
    
    async def get_style_motion(self, style_id: str) -> APIResponse:
        """
        GET /styles/:id/motion
        """
        artifact = await self.storage.get_style(style_id)
        
        if not artifact:
            return APIResponse(
                success=False,
                error=f"Style not found: {style_id}"
            )
        
        return APIResponse(
            success=True,
            data={"motion": artifact.get("motion", [])}
        )
    
    async def get_job_status(self, job_id: str) -> APIResponse:
        """
        GET /jobs/:id
        
        Returns the status of a pipeline job.
        """
        status = await self.orchestrator.get_run_status(job_id)
        
        if not status:
            return APIResponse(
                success=False,
                error=f"Job not found: {job_id}"
            )
        
        return APIResponse(success=True, data=status)


def create_flask_app(storage, orchestrator):
    """
    Create a Flask app with all routes configured.
    For GCP Cloud Run deployment.
    """
    try:
        from flask import Flask, request, jsonify
    except ImportError:
        return None
    
    app = Flask(__name__)
    routes = PipelineAPIRoutes(storage, orchestrator)
    
    import asyncio
    
    def run_async(coro):
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()
    
    @app.route("/ingest/image", methods=["POST"])
    def ingest_image():
        result = run_async(routes.ingest_image(request.json or {}))
        return jsonify(result.to_dict()), 200 if result.success else 400
    
    @app.route("/ingest/prompt", methods=["POST"])
    def ingest_prompt():
        result = run_async(routes.ingest_prompt(request.json or {}))
        return jsonify(result.to_dict()), 200 if result.success else 400
    
    @app.route("/styles/<style_id>", methods=["GET"])
    def get_style(style_id):
        result = run_async(routes.get_style(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/styles/<style_id>/tokens", methods=["GET"])
    def get_style_tokens(style_id):
        result = run_async(routes.get_style_tokens(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/styles/<style_id>/components", methods=["GET"])
    def get_style_components(style_id):
        result = run_async(routes.get_style_components(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/styles/<style_id>/layers", methods=["GET"])
    def get_style_layers(style_id):
        result = run_async(routes.get_style_layers(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/styles/<style_id>/semantics", methods=["GET"])
    def get_style_semantics(style_id):
        result = run_async(routes.get_style_semantics(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/styles/<style_id>/depth", methods=["GET"])
    def get_style_depth(style_id):
        result = run_async(routes.get_style_depth(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/styles/<style_id>/lighting", methods=["GET"])
    def get_style_lighting(style_id):
        result = run_async(routes.get_style_lighting(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/styles/<style_id>/motion", methods=["GET"])
    def get_style_motion(style_id):
        result = run_async(routes.get_style_motion(style_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/jobs/<job_id>", methods=["GET"])
    def get_job_status(job_id):
        result = run_async(routes.get_job_status(job_id))
        return jsonify(result.to_dict()), 200 if result.success else 404
    
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "healthy", "service": "visual-dna-pipeline"})
    
    return app
