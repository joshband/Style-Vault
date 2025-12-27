"""
Pipeline HTTP Server

A lightweight HTTP API server for the pipeline that can be called from Node.js.
Runs as a separate process with persistent job queue.
"""

import json
import asyncio
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
from typing import Dict, Any, Optional

from normalize.dtcg_validator import validate_dtcg_tokens
from normalize.canonical_assembler import assemble_canonical_artifact, generate_style_id
from api.job_queue import InMemoryJobQueue, JobStatus, JobPriority
from search.semantic_search import SemanticSearchEngine

job_queue = InMemoryJobQueue()
search_engine = SemanticSearchEngine()
loop = asyncio.new_event_loop()


def run_async(coro):
    """Run async coroutine in the event loop."""
    return loop.run_until_complete(coro)


class PipelineHandler(BaseHTTPRequestHandler):
    """HTTP request handler for pipeline operations."""
    
    def _send_json(self, data: Dict[str, Any], status: int = 200):
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def _read_body(self) -> Dict[str, Any]:
        """Read JSON body from request."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length)
        return json.loads(body.decode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        if path == "/health":
            self._handle_health()
        elif path == "/search":
            self._handle_search(query)
        elif path.startswith("/job/"):
            job_id = path.split("/job/")[1]
            self._handle_get_job(job_id)
        else:
            self._send_json({"error": "Not found"}, 404)
    
    def do_POST(self):
        """Handle POST requests."""
        parsed = urlparse(self.path)
        path = parsed.path
        
        try:
            body = self._read_body()
        except Exception as e:
            self._send_json({"error": f"Invalid JSON: {str(e)}"}, 400)
            return
        
        if path == "/validate":
            self._handle_validate(body)
        elif path == "/assemble":
            self._handle_assemble(body)
        elif path == "/ingest":
            self._handle_ingest(body)
        else:
            self._send_json({"error": "Not found"}, 404)
    
    def _handle_health(self):
        """Return health status."""
        self._send_json({
            "healthy": True,
            "version": "1.0.0",
            "activeJobs": len([j for j in run_async(job_queue.list_jobs()) if j.status == JobStatus.RUNNING]),
        })
    
    def _handle_validate(self, body: Dict[str, Any]):
        """Validate DTCG tokens."""
        tokens = body.get("tokens", {})
        
        if not tokens:
            self._send_json({"error": "tokens is required"}, 400)
            return
        
        result = validate_dtcg_tokens(tokens)
        self._send_json({
            "valid": result.valid,
            "tokenCount": result.token_count,
            "errors": [{"path": e.path, "message": e.message} for e in result.errors],
            "warnings": [{"path": w.path, "message": w.message} for w in result.warnings],
        })
    
    def _handle_assemble(self, body: Dict[str, Any]):
        """Assemble canonical artifact."""
        tokens = body.get("tokens", {})
        components = body.get("components", [])
        style_semantics = body.get("styleSemantics", {})
        style_id = body.get("styleId") or generate_style_id()
        
        if not tokens:
            self._send_json({"error": "tokens is required"}, 400)
            return
        
        try:
            result = assemble_canonical_artifact(
                tokens=tokens,
                components=components,
                layers=[],
                style_semantics=style_semantics,
                lighting={},
                materials={},
                motion=[],
                style_id=style_id,
            )
            
            self._send_json({
                "success": True,
                "styleId": style_id,
                "artifact": result.to_dict(),
            })
        except Exception as e:
            self._send_json({"error": str(e)}, 500)
    
    def _handle_ingest(self, body: Dict[str, Any]):
        """Start ingestion job."""
        image_base64 = body.get("imageBase64")
        style_id = body.get("styleId") or generate_style_id()
        
        if not image_base64:
            self._send_json({"error": "imageBase64 is required"}, 400)
            return
        
        try:
            job = run_async(job_queue.enqueue(
                job_type="token_extraction",
                input_data={
                    "styleId": style_id,
                    "hasImage": True,
                },
                priority=JobPriority.HIGH,
            ))
            
            self._send_json({
                "success": True,
                "jobId": job.id,
                "styleId": style_id,
                "status": "queued",
            })
        except Exception as e:
            self._send_json({"error": str(e)}, 500)
    
    def _handle_get_job(self, job_id: str):
        """Get job status."""
        job = run_async(job_queue.get_job(job_id))
        
        if not job:
            self._send_json({"error": "Job not found"}, 404)
            return
        
        self._send_json({
            "id": job.id,
            "status": job.status.value,
            "result": job.result,
            "error": job.error,
            "createdAt": job.created_at.isoformat() if job.created_at else None,
        })
    
    def _handle_search(self, query: Dict[str, list]):
        """Search styles."""
        q = query.get("q", [""])[0]
        limit = int(query.get("limit", ["10"])[0])
        
        if not q:
            self._send_json({"error": "q parameter is required"}, 400)
            return
        
        results = search_engine.search_styles(q, limit=limit)
        self._send_json({
            "query": q,
            "count": len(results),
            "results": [
                {"styleId": r.style_id, "score": r.score, "explanation": r.explanation}
                for r in results
            ],
        })
    
    def log_message(self, format: str, *args):
        """Suppress default logging."""
        pass


def run_server(port: int = 8765):
    """Run the pipeline HTTP server."""
    server = HTTPServer(("127.0.0.1", port), PipelineHandler)
    print(f"[Pipeline Server] Running on http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    run_server(port)
