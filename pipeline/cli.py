#!/usr/bin/env python3
"""
Visual DNA Pipeline CLI

Command-line interface for running the extraction pipeline.

Usage:
    python -m pipeline.cli extract --input image.png --output ./output
    python -m pipeline.cli extract-depth --input image.png --output ./depth.png
    python -m pipeline.cli infer-style --input image.png
"""

import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def cmd_extract(args):
    """Run full extraction pipeline."""
    from pipeline.api import run_pipeline, PipelineConfig
    
    def progress_callback(stage: str, progress: float):
        print(f"[{progress*100:.0f}%] {stage}")
    
    config_kwargs = {
        "output_dir": args.output,
        "use_clip_classification": args.use_clip,
        "num_colors": args.num_colors,
        "skip_depth": args.skip_depth,
        "skip_style": args.skip_style,
    }
    
    if args.verbose:
        config_kwargs["progress_callback"] = progress_callback
    
    try:
        result = run_pipeline(
            image_source=args.input,
            **config_kwargs
        )
        
        print(f"\nExtraction complete!")
        print(f"  Image ID: {result.image_id}")
        print(f"  Output: {args.output}/{result.image_id}/")
        print(f"  Tokens: {len(result.tokens)} categories")
        print(f"  Components: {len(result.components)}")
        
        if args.json:
            print("\n" + result.to_json())
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_extract_depth(args):
    """Extract depth map only."""
    from pipeline.extract.depth import extract_depth, DepthAnythingV2, MiDaSDepthModel
    
    if args.model == "midas":
        model = MiDaSDepthModel()
    else:
        model = DepthAnythingV2(model_size=args.model_size)
    
    try:
        result = extract_depth(
            image_path=args.input,
            output_dir=args.output,
            model=model
        )
        
        print(f"Depth extraction complete!")
        print(f"  16-bit PNG: {result.depth_map_path}")
        print(f"  JSON grid: {result.depth_json_path}")
        print(f"  Stats: {json.dumps(result.depth_stats, indent=2)}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_infer_style(args):
    """Infer style and mood only."""
    from pipeline.extract.semantics import infer_style
    
    try:
        result = infer_style(
            image_path=args.input,
            top_k=args.top_k
        )
        
        print(f"\nStyle Inference Results:")
        print(f"  Caption: {result.caption}")
        print(f"\n  Mood: {result.mood['primary']} (intensity: {result.mood['intensity']:.2f})")
        print(f"\n  Top Style Tags:")
        for tag in result.style_tags[:10]:
            print(f"    - {tag['tag']} ({tag['category']}): {tag['score']:.3f}")
        
        if args.json:
            print("\n" + json.dumps(result.to_dict(), indent=2))
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_extract_colors(args):
    """Extract color palette only."""
    from pipeline.extract.color import extract_colors
    
    try:
        result = extract_colors(
            image_path=args.input,
            num_colors=args.num_colors
        )
        
        print(f"\nColor Extraction Results:")
        print(f"  Dominant: RGB{result.dominant_color.rgb}")
        print(f"\n  Palette ({result.color_count} colors):")
        for i, color in enumerate(result.palette):
            oklch = color.to_dict()["oklch"]
            print(f"    {i+1}. RGB{color.rgb} - oklch({oklch['l']:.3f} {oklch['c']:.3f} {oklch['h']:.1f}) - freq: {color.frequency:.3f}")
        
        if args.json:
            print("\n" + json.dumps(result.to_dict(), indent=2))
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Visual DNA Pipeline CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    extract_parser = subparsers.add_parser("extract", help="Run full extraction pipeline")
    extract_parser.add_argument("--input", "-i", required=True, help="Input image path")
    extract_parser.add_argument("--output", "-o", default="./pipeline_output", help="Output directory")
    extract_parser.add_argument("--use-clip", action="store_true", help="Use CLIP for component classification")
    extract_parser.add_argument("--num-colors", type=int, default=8, help="Number of colors to extract")
    extract_parser.add_argument("--skip-depth", action="store_true", help="Skip depth extraction")
    extract_parser.add_argument("--skip-style", action="store_true", help="Skip style inference")
    extract_parser.add_argument("--verbose", "-v", action="store_true", help="Show progress")
    extract_parser.add_argument("--json", action="store_true", help="Output full JSON result")
    extract_parser.set_defaults(func=cmd_extract)
    
    depth_parser = subparsers.add_parser("extract-depth", help="Extract depth map only")
    depth_parser.add_argument("--input", "-i", required=True, help="Input image path")
    depth_parser.add_argument("--output", "-o", default="./depth_output", help="Output directory")
    depth_parser.add_argument("--model", choices=["depth-anything", "midas"], default="depth-anything")
    depth_parser.add_argument("--model-size", choices=["small", "base", "large"], default="small")
    depth_parser.set_defaults(func=cmd_extract_depth)
    
    style_parser = subparsers.add_parser("infer-style", help="Infer style and mood")
    style_parser.add_argument("--input", "-i", required=True, help="Input image path")
    style_parser.add_argument("--top-k", type=int, default=15, help="Number of tags to return")
    style_parser.add_argument("--json", action="store_true", help="Output full JSON result")
    style_parser.set_defaults(func=cmd_infer_style)
    
    color_parser = subparsers.add_parser("extract-colors", help="Extract color palette")
    color_parser.add_argument("--input", "-i", required=True, help="Input image path")
    color_parser.add_argument("--num-colors", type=int, default=8, help="Number of colors")
    color_parser.add_argument("--json", action="store_true", help="Output full JSON result")
    color_parser.set_defaults(func=cmd_extract_colors)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)


if __name__ == "__main__":
    main()
