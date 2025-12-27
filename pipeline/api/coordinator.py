"""
Pipeline Coordinator

Runs all extraction stages sequentially and aggregates results.
Provides the main entry point for the extraction pipeline.
"""

import os
from typing import Optional, Callable, Any
from dataclasses import dataclass

from pipeline.ingest import ingest_image
from pipeline.extract.color import extract_colors
from pipeline.extract.layout import extract_layout
from pipeline.extract.typography import extract_typography
from pipeline.extract.depth import extract_depth, DepthAnythingV2
from pipeline.extract.components import detect_components
from pipeline.extract.semantics import infer_style
from pipeline.extract.materials import analyze_materials
from pipeline.extract.lighting import analyze_lighting
from pipeline.extract.motion import recommend_motion
from pipeline.assemble import PipelineResults, assemble_unified_output
from pipeline.schemas import UnifiedPipelineOutput


@dataclass
class PipelineConfig:
    """Configuration for pipeline execution."""
    output_dir: str = "./pipeline_output"
    use_clip_classification: bool = False
    num_colors: int = 8
    depth_model_size: str = "small"
    skip_depth: bool = False
    skip_style: bool = False
    skip_motion: bool = False
    
    progress_callback: Optional[Callable[[str, float], None]] = None


class PipelineCoordinator:
    """
    Coordinates the full extraction pipeline.
    
    Runs stages in sequence, collecting results and handling errors gracefully.
    """
    
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self.results = PipelineResults()
    
    def _report_progress(self, stage: str, progress: float):
        """Report progress if callback is configured."""
        if self.config.progress_callback:
            self.config.progress_callback(stage, progress)
    
    def run(
        self,
        image_source: str,
        is_base64: bool = False,
        image_id: Optional[str] = None
    ) -> UnifiedPipelineOutput:
        """
        Run the complete extraction pipeline on an image.
        
        Args:
            image_source: Path to image or base64 data
            is_base64: Whether source is base64 encoded
            image_id: Optional custom image ID
        
        Returns:
            UnifiedPipelineOutput with all extracted data
        """
        output_dir = self.config.output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        self._report_progress("ingest", 0.0)
        try:
            self.results.ingest = ingest_image(
                source=image_source,
                output_dir=output_dir,
                image_id=image_id,
                is_base64=is_base64
            )
            image_path = self.results.ingest.sizes.get("large") or self.results.ingest.original_path
            actual_id = self.results.ingest.image_id
        except Exception as e:
            print(f"[Pipeline] Ingestion failed: {e}")
            raise
        
        self._report_progress("colors", 0.1)
        try:
            self.results.colors = extract_colors(
                image_path=image_path,
                num_colors=self.config.num_colors
            )
        except Exception as e:
            print(f"[Pipeline] Color extraction failed: {e}")
        
        self._report_progress("layout", 0.2)
        try:
            self.results.layout = extract_layout(image_path=image_path)
        except Exception as e:
            print(f"[Pipeline] Layout extraction failed: {e}")
        
        self._report_progress("typography", 0.3)
        try:
            self.results.typography = extract_typography(image_path=image_path)
        except Exception as e:
            print(f"[Pipeline] Typography extraction failed: {e}")
        
        if not self.config.skip_depth:
            self._report_progress("depth", 0.4)
            try:
                depth_model = DepthAnythingV2(model_size=self.config.depth_model_size)
                self.results.depth = extract_depth(
                    image_path=image_path,
                    output_dir=os.path.join(output_dir, actual_id),
                    model=depth_model,
                    image_id=actual_id
                )
            except Exception as e:
                print(f"[Pipeline] Depth extraction failed: {e}")
        
        self._report_progress("components", 0.5)
        try:
            self.results.components = detect_components(
                image_path=image_path,
                output_dir=os.path.join(output_dir, actual_id),
                use_clip=self.config.use_clip_classification,
                image_id=actual_id
            )
        except Exception as e:
            print(f"[Pipeline] Component detection failed: {e}")
        
        if not self.config.skip_style:
            self._report_progress("style", 0.6)
            try:
                self.results.style = infer_style(image_path=image_path)
            except Exception as e:
                print(f"[Pipeline] Style inference failed: {e}")
        
        self._report_progress("materials", 0.7)
        try:
            depth_path = self.results.depth.depth_map_path if self.results.depth else None
            self.results.materials = analyze_materials(
                image_path=image_path,
                depth_map_path=depth_path,
                output_dir=os.path.join(output_dir, actual_id),
                image_id=actual_id
            )
        except Exception as e:
            print(f"[Pipeline] Material analysis failed: {e}")
        
        self._report_progress("lighting", 0.8)
        try:
            self.results.lighting = analyze_lighting(
                image_path=image_path,
                depth_map_path=self.results.depth.depth_map_path if self.results.depth else None
            )
        except Exception as e:
            print(f"[Pipeline] Lighting analysis failed: {e}")
        
        if not self.config.skip_motion:
            self._report_progress("motion", 0.9)
            try:
                if self.results.components:
                    style_mood = "neutral"
                    if self.results.style and self.results.style.mood:
                        style_mood = self.results.style.mood.get("primary", "neutral")
                    
                    self.results.motion = recommend_motion(
                        detected_regions=self.results.components.regions,
                        style_mood=style_mood
                    )
            except Exception as e:
                print(f"[Pipeline] Motion recommendation failed: {e}")
        
        self._report_progress("assemble", 0.95)
        output = assemble_unified_output(
            results=self.results,
            output_dir=os.path.join(output_dir, actual_id)
        )
        
        self._report_progress("complete", 1.0)
        return output


def run_pipeline(
    image_source: str,
    output_dir: str = "./pipeline_output",
    is_base64: bool = False,
    **kwargs
) -> UnifiedPipelineOutput:
    """
    Convenience function to run the pipeline with minimal configuration.
    
    Args:
        image_source: Path to image or base64 data
        output_dir: Output directory for results
        is_base64: Whether source is base64 encoded
        **kwargs: Additional PipelineConfig options
    
    Returns:
        UnifiedPipelineOutput with all extracted data
    """
    config = PipelineConfig(output_dir=output_dir, **kwargs)
    coordinator = PipelineCoordinator(config)
    return coordinator.run(image_source=image_source, is_base64=is_base64)
