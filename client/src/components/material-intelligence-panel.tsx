import { useState, useCallback } from "react";
import { Layers, Sparkles, Box, Loader2, RefreshCw, ChevronDown, Zap, Grid2X2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MaterialSignals {
  translucency_score: number;
  specular_density: number;
  emission_score: number;
  depth_shadow_complexity: number;
}

interface TextureSignals {
  texture_grain: number;
  microcontrast: number;
  anisotropy: number;
  noise_type_hint: string;
}

interface RecipeMatch {
  recipe_id: string;
  label: string;
  confidence: number;
  description: string;
  layer_topology?: string[];
}

interface ComponentCandidate {
  id: string;
  bbox: [number, number, number, number];
  label: string;
  confidence: number;
}

interface MaterialIntelligence {
  components: {
    candidates: ComponentCandidate[];
    count: number;
  };
  material_signature: {
    signals: { global: MaterialSignals };
    texture: { global: TextureSignals };
    recipe: RecipeMatch;
    layer_topology: string[];
  };
  enriched_tokens: Record<string, any>;
  lineage: {
    pipeline_version: string;
    stages: string[];
    timestamp: string;
  };
}

interface Props {
  styleId: string;
  referenceImage?: string;
  className?: string;
}

function SignalBar({ label, value, color }: { label: string; value: number | undefined | null; color: string }) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const percent = Math.round(safeValue * 100);
  const isAvailable = typeof value === 'number' && !isNaN(value);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {isAvailable ? `${percent}%` : 'N/A'}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color, !isAvailable && "opacity-30")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeMatch }) {
  const confidenceColor =
    recipe.confidence > 0.8
      ? "text-emerald-500"
      : recipe.confidence > 0.5
      ? "text-amber-500"
      : "text-rose-500";

  return (
    <div className="p-3 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{recipe.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{recipe.description}</div>
        </div>
        <div className={cn("text-xs font-mono", confidenceColor)}>
          {Math.round(recipe.confidence * 100)}%
        </div>
      </div>
      {recipe.layer_topology && recipe.layer_topology.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {recipe.layer_topology.map((layer, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-muted text-[10px] rounded font-mono"
            >
              {layer}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentOverlay({
  components,
  imageWidth,
  imageHeight,
}: {
  components: ComponentCandidate[];
  imageWidth: number;
  imageHeight: number;
}) {
  if (components.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
    >
      {components.map((comp, i) => {
        const [x, y, w, h] = comp.bbox;
        const hue = (i * 137.5) % 360;
        return (
          <g key={comp.id}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={`hsl(${hue}, 70%, 60%)`}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <text
              x={x + 4}
              y={y + 14}
              fill={`hsl(${hue}, 70%, 60%)`}
              fontSize="12"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {comp.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MaterialIntelligencePanel({ styleId, referenceImage, className }: Props) {
  const [data, setData] = useState<MaterialIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const analyzeStyle = useCallback(async () => {
    if (!referenceImage) {
      setError("No reference image available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/pipeline/enrich-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: referenceImage,
          styleId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.error?.includes("Pipeline server not available") || res.status === 503) {
          throw new Error("Material analysis is temporarily unavailable. The analysis service is starting up - please try again in a moment.");
        }
        throw new Error(errorData.error || "Pipeline analysis failed");
      }

      const result = await res.json();
      setData(result);
      setExpanded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("fetch") || message.includes("network") || message.includes("Failed to fetch")) {
        setError("Material analysis service is temporarily unavailable. Please try again later.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [styleId, referenceImage]);

  if (!data && !loading && !error) {
    return (
      <div className={cn("border border-border rounded-lg p-4", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">Material Intelligence</span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Beta</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Analyze UI components, material properties, and surface textures using computer vision.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={analyzeStyle}
          disabled={!referenceImage}
          className="w-full"
          data-testid="button-analyze-materials"
        >
          <Sparkles size={14} className="mr-2" />
          Analyze Materials
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("border border-border rounded-lg p-4", className)}>
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Analyzing materials...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("border border-border rounded-lg p-4", className)}>
        <div className="text-sm text-destructive mb-2">{error}</div>
        <Button size="sm" variant="outline" onClick={analyzeStyle}>
          <RefreshCw size={14} className="mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { components, material_signature, lineage } = data;
  const materialSignals = material_signature?.signals?.global;
  const textureSignals = material_signature?.texture?.global;
  const recipe = material_signature?.recipe;

  return (
    <details
      className={cn("border border-border rounded-lg overflow-hidden group", className)}
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Material Intelligence</span>
          {recipe && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">
              {recipe.label}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className="text-muted-foreground group-open:rotate-180 transition-transform"
        />
      </summary>

      <div className="p-4 pt-0 space-y-4">
        {referenceImage && components.count > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Grid2X2 size={12} />
                <span>{components.count} components detected</span>
              </div>
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-overlay"
              >
                {showOverlay ? "Hide" : "Show"} overlay
              </button>
            </div>
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              <img
                src={referenceImage}
                alt="Reference with component overlay"
                className="w-full h-full object-cover"
              />
              {showOverlay && (
                <ComponentOverlay
                  components={components.candidates}
                  imageWidth={1024}
                  imageHeight={1024}
                />
              )}
            </div>
          </div>
        )}

        {materialSignals && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Box size={12} />
              Material Signals
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SignalBar
                label="Translucency"
                value={materialSignals.translucency_score}
                color="bg-cyan-500"
              />
              <SignalBar
                label="Specular"
                value={materialSignals.specular_density}
                color="bg-amber-500"
              />
              <SignalBar
                label="Emission"
                value={materialSignals.emission_score}
                color="bg-rose-500"
              />
              <SignalBar
                label="Shadow Depth"
                value={materialSignals.depth_shadow_complexity}
                color="bg-violet-500"
              />
            </div>
          </div>
        )}

        {textureSignals && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Zap size={12} />
              Texture Signals
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SignalBar
                label="Grain"
                value={textureSignals.texture_grain}
                color="bg-slate-500"
              />
              <SignalBar
                label="Microcontrast"
                value={textureSignals.microcontrast}
                color="bg-emerald-500"
              />
              <SignalBar
                label="Anisotropy"
                value={textureSignals.anisotropy}
                color="bg-blue-500"
              />
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Noise Type</span>
                  <span className="font-mono text-foreground capitalize">
                    {textureSignals.noise_type_hint}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {recipe && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Matched Recipe
            </div>
            <RecipeCard recipe={recipe} />
          </div>
        )}

        {lineage && (
          <div className="pt-2 border-t border-border text-[10px] text-muted-foreground font-mono">
            Pipeline v{lineage.pipeline_version} &middot; {lineage.stages?.length || 0} stages
            &middot; {new Date(lineage.timestamp).toLocaleTimeString()}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={analyzeStyle}
          className="w-full"
          data-testid="button-reanalyze-materials"
        >
          <RefreshCw size={14} className="mr-2" />
          Re-analyze
        </Button>
      </div>
    </details>
  );
}
