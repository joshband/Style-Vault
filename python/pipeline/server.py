"""
Component + Material Intelligence Pipeline Server
Flask-based HTTP API for the Python CV pipeline.
"""

import os
import sys
import json
import base64
import tempfile
import time
from typing import Dict, Any, Optional
from flask import Flask, request, jsonify
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from components.detect import detect_components
from material.signals import extract_material_signals
from texture.signals import extract_texture_signals
from material.recipes import match_best_recipe, list_recipes, get_recipe_by_id

app = Flask(__name__)


def decode_image(data: Dict[str, Any]) -> Optional[np.ndarray]:
    """Decode image from request data (base64 or file path)."""
    if "base64" in data:
        try:
            img_data = base64.b64decode(data["base64"])
            nparr = np.frombuffer(img_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return image
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
            return None
    
    if "path" in data:
        try:
            image = cv2.imread(data["path"])
            return image
        except Exception as e:
            print(f"Error loading image from path: {e}")
            return None
    
    return None


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "component-material-pipeline",
        "version": "1.0.0"
    })


@app.route("/api/pipeline/components", methods=["POST"])
def detect_components_endpoint():
    """
    Detect UI components in an image.
    
    Request body:
        - base64: Base64-encoded image data
        - path: Path to image file (alternative to base64)
        - max_size: Max dimension for processing (default: 1024)
        - min_area: Minimum component area (default: 400)
        - enable_classification: Run heuristic classification (default: true)
    
    Returns:
        - candidates: List of detected component candidates
        - count: Number of candidates
        - timings: Processing time breakdown
    """
    start_time = time.time()
    
    try:
        data = request.get_json() or {}
        image = decode_image(data)
        
        if image is None:
            return jsonify({
                "error": "No valid image provided",
                "message": "Provide 'base64' or 'path' in request body"
            }), 400
        
        max_size = data.get("max_size", 1024)
        min_area = data.get("min_area", 400)
        enable_classification = data.get("enable_classification", True)
        
        result = detect_components(
            image,
            max_size=max_size,
            min_area=min_area,
            enable_classification=enable_classification
        )
        
        result["endpoint_time_ms"] = round((time.time() - start_time) * 1000, 2)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Component detection failed"
        }), 500


@app.route("/api/pipeline/material-signature", methods=["POST"])
def material_signature_endpoint():
    """
    Extract material signature from an image.
    
    Request body:
        - base64: Base64-encoded image data
        - path: Path to image file
        - components: Optional list of component candidates
    
    Returns:
        - material_signals: Global and per-component material signals
        - texture_signals: Global and per-component texture signals
        - recipe_match: Best matching material recipe
        - tokens: Derived DTCG tokens
        - timings: Processing time breakdown
    """
    start_time = time.time()
    
    try:
        data = request.get_json() or {}
        image = decode_image(data)
        
        if image is None:
            return jsonify({
                "error": "No valid image provided",
                "message": "Provide 'base64' or 'path' in request body"
            }), 400
        
        components = data.get("components", [])
        
        material_result = extract_material_signals(image, components)
        texture_result = extract_texture_signals(image, components)
        
        recipe_result = match_best_recipe(
            material_result["global"],
            material_result.get("perComponent"),
            texture_result
        )
        
        tokens = {
            **recipe_result["global"].get("material_tokens", {}),
            **recipe_result["global"].get("texture_tokens", {}),
            **recipe_result["global"].get("opacity_tokens", {})
        }
        
        result = {
            "material_signals": material_result,
            "texture_signals": texture_result,
            "recipe_match": recipe_result,
            "tokens": tokens,
            "interaction_bindings": recipe_result["global"].get("interaction_hypotheses", []),
            "layer_topology": recipe_result["global"].get("layer_topology", []),
            "timings": {
                "material_ms": material_result["timings"]["total_ms"],
                "texture_ms": texture_result["timings"]["total_ms"],
                "recipe_ms": recipe_result["timing_ms"],
                "total_ms": round((time.time() - start_time) * 1000, 2)
            },
            "version": "1.0.0"
        }
        
        return jsonify(result)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "message": "Material signature extraction failed"
        }), 500


@app.route("/api/pipeline/enrich-style", methods=["POST"])
def enrich_style_endpoint():
    """
    Full enrichment pipeline: components + materials + recipe matching.
    
    Request body:
        - base64: Base64-encoded image data
        - path: Path to image file
        - style_id: Optional style ID for tracking
    
    Returns:
        - components: Detected UI components
        - material_signature: Full material analysis
        - enriched_tokens: All derived tokens
        - lineage: Pipeline execution metadata
    """
    start_time = time.time()
    
    try:
        data = request.get_json() or {}
        image = decode_image(data)
        
        if image is None:
            return jsonify({
                "error": "No valid image provided",
                "message": "Provide 'base64' or 'path' in request body"
            }), 400
        
        style_id = data.get("style_id")
        
        stage_timings = {}
        
        t0 = time.time()
        components_result = detect_components(image)
        stage_timings["components_ms"] = round((time.time() - t0) * 1000, 2)
        
        components = components_result.get("candidates", [])
        
        t0 = time.time()
        material_result = extract_material_signals(image, components)
        stage_timings["material_ms"] = round((time.time() - t0) * 1000, 2)
        
        t0 = time.time()
        texture_result = extract_texture_signals(image, components)
        stage_timings["texture_ms"] = round((time.time() - t0) * 1000, 2)
        
        t0 = time.time()
        recipe_result = match_best_recipe(
            material_result["global"],
            material_result.get("perComponent"),
            texture_result
        )
        stage_timings["recipe_ms"] = round((time.time() - t0) * 1000, 2)
        
        enriched_tokens = {}
        
        for comp in components:
            comp_id = comp["id"]
            enriched_tokens[f"components.{comp_id}"] = {
                "$value": {
                    "bbox": comp["bbox"],
                    "type": comp["label"],
                    "confidence": comp["confidence"]
                },
                "$type": "object"
            }
        
        enriched_tokens.update(recipe_result["global"].get("material_tokens", {}))
        enriched_tokens.update(recipe_result["global"].get("texture_tokens", {}))
        enriched_tokens.update(recipe_result["global"].get("opacity_tokens", {}))
        
        for binding in recipe_result["global"].get("interaction_hypotheses", []):
            key = f"interaction.{binding['input']}.{binding['target'].replace('.', '_')}"
            enriched_tokens[key] = {
                "$value": binding,
                "$type": "object"
            }
        
        total_time = round((time.time() - start_time) * 1000, 2)
        stage_timings["total_ms"] = total_time
        
        result = {
            "components": {
                "candidates": components,
                "count": len(components)
            },
            "material_signature": {
                "signals": {
                    "global": material_result["global"],
                    "perComponent": material_result.get("perComponent", {})
                },
                "texture": {
                    "global": texture_result["global"],
                    "perComponent": texture_result.get("perComponent", {})
                },
                "recipe": {
                    "id": recipe_result["global"]["recipe_id"],
                    "label": recipe_result["global"]["label"],
                    "confidence": recipe_result["global"]["confidence"],
                    "description": recipe_result["global"]["description"]
                },
                "layer_topology": recipe_result["global"]["layer_topology"],
                "interaction_bindings": recipe_result["global"]["interaction_hypotheses"]
            },
            "enriched_tokens": enriched_tokens,
            "lineage": {
                "style_id": style_id,
                "pipeline_version": "1.0.0",
                "stages": ["components", "material", "texture", "recipe"],
                "timings": stage_timings,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        }
        
        return jsonify(result)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "message": "Style enrichment failed"
        }), 500


@app.route("/api/pipeline/recipes", methods=["GET"])
def list_recipes_endpoint():
    """List all available material recipes."""
    return jsonify({
        "recipes": list_recipes(),
        "count": len(list_recipes())
    })


@app.route("/api/pipeline/recipes/<recipe_id>", methods=["GET"])
def get_recipe_endpoint(recipe_id: str):
    """Get a specific recipe by ID."""
    recipe = get_recipe_by_id(recipe_id)
    if recipe:
        return jsonify(recipe)
    return jsonify({"error": "Recipe not found"}), 404


def run_server(host: str = "0.0.0.0", port: int = 5001):
    """Run the pipeline server."""
    print(f"Starting Component + Material Intelligence Pipeline on {host}:{port}")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    port = int(os.environ.get("PIPELINE_PORT", 5001))
    run_server(port=port)
