import { useState } from "react";
import { Loader2, Palette, Grid3X3, BoxSelect, Layers, PenTool, AlertCircle, Eye, ChevronDown, ChevronRight, Microscope, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CVColorToken {
  space: string;
  l: number;
  c: number;
  h: number;
}

interface CVGridToken {
  columns: number;
  rows: number;
}

interface CVElevationToken {
  elevation: number;
  shadowStrength: number;
  direction: string;
  directionAngle: number;
  blurRadius: number;
  contrast: number;
  depthStyle: string;
  distribution: {
    dark: number;
    mid: number;
    light: number;
  };
  shadowColor: {
    space: string;
    l: number;
    c: number;
    h: number;
  } | null;
}

interface CVExtractedTokens {
  color: CVColorToken[];
  spacing: number[];
  borderRadius: number[];
  grid: CVGridToken;
  elevation: CVElevationToken;
  strokeWidth: number[];
  meta: {
    method: string;
    confidence: string;
    realtimeSafe: boolean;
  };
}

interface CVDebugVisual {
  label: string;
  description: string;
  image: string;
}

interface CVDebugInfo {
  visuals: CVDebugVisual[];
  steps: string[];
}

interface CVTokenExplorerProps {
  referenceImage?: string;
  styleName: string;
}

const WALKTHROUGH_TITLES: Record<string, { title: string; icon: typeof Palette }> = {
  color: { title: "How We Extract Colors", icon: Palette },
  spacing: { title: "How We Detect Spacing", icon: Grid3X3 },
  borderRadius: { title: "How We Find Border Radii", icon: BoxSelect },
  grid: { title: "How We Analyze Grid Structure", icon: Grid3X3 },
  elevation: { title: "How We Measure Shadows & Depth", icon: Layers },
  strokeWidth: { title: "How We Detect Stroke Widths", icon: PenTool },
};

function oklchToCSS(color: CVColorToken): string {
  return `oklch(${color.l} ${color.c} ${color.h})`;
}

function ColorSection({ colors }: { colors: CVColorToken[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Palette size={14} />
        <span>Extracted Colors</span>
        <span className="text-[10px] font-normal normal-case">({colors.length} unique)</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {colors.map((color, i) => (
          <div
            key={i}
            className="relative group"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="aspect-square rounded-md border border-border shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: oklchToCSS(color) }}
              data-testid={`color-swatch-${i}`}
            />
            {hoveredIndex === i && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-md px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10 shadow-lg">
                <div>L: {color.l.toFixed(2)}</div>
                <div>C: {color.c.toFixed(3)}</div>
                <div>H: {color.h.toFixed(0)}°</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono">
        Color space: OKLCH (perceptually uniform)
      </div>
    </div>
  );
}

function SpacingSection({ spacing }: { spacing: number[] }) {
  const maxSpacing = Math.max(...spacing, 64);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Grid3X3 size={14} />
        <span>Spacing Scale</span>
      </div>
      {spacing.length > 0 ? (
        <div className="space-y-2">
          {spacing.map((value, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="h-3 bg-primary/60 rounded-sm transition-all"
                style={{ width: `${(value / maxSpacing) * 100}%`, minWidth: '8px' }}
                data-testid={`spacing-bar-${value}`}
              />
              <span className="text-xs font-mono text-muted-foreground w-12">{value}px</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No spacing patterns detected</div>
      )}
    </div>
  );
}

function BorderRadiusSection({ radii }: { radii: number[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <BoxSelect size={14} />
        <span>Border Radius</span>
      </div>
      {radii.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {radii.map((radius, i) => (
            <div
              key={i}
              className="w-12 h-12 border-2 border-primary/60 bg-primary/10 flex items-center justify-center text-xs font-mono"
              style={{ borderRadius: `${radius}px` }}
              data-testid={`radius-sample-${radius}`}
            >
              {radius}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No border radii detected</div>
      )}
    </div>
  );
}

function DirectionIndicator({ direction, angle }: { direction: string; angle: number }) {
  const directionAngles: Record<string, number> = {
    'right': 0,
    'bottom-right': 45,
    'bottom': 90,
    'bottom-left': 135,
    'left': 180,
    'top-left': -135,
    'top': -90,
    'top-right': -45,
    'ambient': 0,
  };

  const displayAngle = directionAngles[direction] ?? angle;

  return (
    <div className="relative w-16 h-16 rounded-full border border-border bg-muted flex items-center justify-center">
      {direction === 'ambient' ? (
        <div className="w-8 h-8 rounded-full bg-gradient-radial from-foreground/20 to-transparent" />
      ) : (
        <div 
          className="absolute w-6 h-1 bg-primary rounded-full origin-left"
          style={{ 
            transform: `rotate(${displayAngle}deg)`,
            left: '50%',
            top: '50%',
            marginTop: '-2px'
          }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-foreground/60" />
      </div>
    </div>
  );
}

function DepthDistributionBar({ distribution }: { distribution: { dark: number; mid: number; light: number } }) {
  return (
    <div className="w-full h-4 rounded-sm overflow-hidden flex">
      <div 
        className="h-full bg-zinc-800" 
        style={{ width: `${distribution.dark * 100}%` }}
        title={`Dark: ${(distribution.dark * 100).toFixed(0)}%`}
      />
      <div 
        className="h-full bg-zinc-500" 
        style={{ width: `${distribution.mid * 100}%` }}
        title={`Mid: ${(distribution.mid * 100).toFixed(0)}%`}
      />
      <div 
        className="h-full bg-zinc-200" 
        style={{ width: `${distribution.light * 100}%` }}
        title={`Light: ${(distribution.light * 100).toFixed(0)}%`}
      />
    </div>
  );
}

function ElevationSection({ elevation }: { elevation: CVElevationToken }) {
  const levels = ['Flat', 'Subtle', 'Medium', 'Deep'];
  const shadows = [
    'none',
    '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
    '0 4px 6px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
    '0 10px 20px rgba(0,0,0,0.15), 0 6px 6px rgba(0,0,0,0.10)'
  ];

  const depthStyleLabels: Record<string, string> = {
    'high-contrast': 'High Contrast',
    'dark-dominant': 'Dark Dominant',
    'light-dominant': 'Light Dominant',
    'flat': 'Flat',
    'balanced': 'Balanced',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Layers size={14} />
        <span>Shadow & Depth Analysis</span>
      </div>
      
      {/* Elevation Levels */}
      <div className="space-y-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Elevation Level</div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((level) => (
            <div
              key={level}
              className={cn(
                "flex-1 h-12 rounded-md bg-card border border-border flex items-center justify-center text-[10px] font-mono transition-all",
                elevation.elevation === level && "ring-2 ring-primary bg-primary/5"
              )}
              style={{ boxShadow: shadows[level] }}
              data-testid={`elevation-level-${level}`}
            >
              {levels[level]}
            </div>
          ))}
        </div>
      </div>

      {/* Shadow Direction & Properties */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Light Direction</div>
          <div className="flex items-center gap-3">
            <DirectionIndicator direction={elevation.direction} angle={elevation.directionAngle} />
            <div className="space-y-1">
              <div className="text-sm font-medium capitalize">{elevation.direction.replace('-', ' ')}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{elevation.directionAngle.toFixed(0)}°</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Shadow Properties</div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Blur Radius</span>
              <span className="font-mono">{elevation.blurRadius}px</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Strength</span>
              <span className="font-mono">{elevation.shadowStrength.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Contrast</span>
              <span className="font-mono">{elevation.contrast.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Depth Distribution */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Luminance Distribution</div>
          <div className="text-[10px] font-mono text-primary capitalize">
            {depthStyleLabels[elevation.depthStyle] || elevation.depthStyle}
          </div>
        </div>
        <DepthDistributionBar distribution={elevation.distribution} />
        <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
          <span>Dark {(elevation.distribution.dark * 100).toFixed(0)}%</span>
          <span>Mid {(elevation.distribution.mid * 100).toFixed(0)}%</span>
          <span>Light {(elevation.distribution.light * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Shadow Color */}
      {elevation.shadowColor && (
        <div className="space-y-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Shadow Color</div>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-md border border-border"
              style={{ backgroundColor: `oklch(${elevation.shadowColor.l} ${elevation.shadowColor.c} ${elevation.shadowColor.h})` }}
            />
            <div className="text-[10px] font-mono text-muted-foreground">
              <div>L: {elevation.shadowColor.l.toFixed(2)}</div>
              <div>C: {elevation.shadowColor.c.toFixed(3)}</div>
              <div>H: {elevation.shadowColor.h.toFixed(0)}°</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StrokeSection({ strokes }: { strokes: number[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <PenTool size={14} />
        <span>Stroke Widths</span>
      </div>
      {strokes.length > 0 ? (
        <div className="flex flex-wrap items-end gap-4">
          {strokes.map((width, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="w-12 bg-foreground rounded-full"
                style={{ height: `${width}px` }}
                data-testid={`stroke-sample-${width}`}
              />
              <span className="text-xs font-mono text-muted-foreground">{width}px</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No stroke widths detected</div>
      )}
    </div>
  );
}

function GridSection({ grid }: { grid: CVGridToken }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Grid3X3 size={14} />
        <span>Grid Structure</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-mono font-bold text-primary">{grid.columns}</span>
          <span className="text-xs text-muted-foreground">columns</span>
        </div>
        <div className="text-muted-foreground">×</div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-mono font-bold text-primary">{grid.rows}</span>
          <span className="text-xs text-muted-foreground">rows</span>
        </div>
      </div>
    </div>
  );
}

function WalkthroughSection({ tokenType, debug }: { tokenType: string; debug: CVDebugInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  const config = WALKTHROUGH_TITLES[tokenType];
  
  if (!config || !debug) return null;
  
  const IconComponent = config.icon;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left" data-testid={`walkthrough-toggle-${tokenType}`}>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <IconComponent size={16} className="text-primary" />
        <span className="text-sm font-medium flex-1">{config.title}</span>
        <span className="text-[10px] text-muted-foreground">{debug.steps.length} steps</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-4 animate-in slide-in-from-top-2 duration-200">
        <div className="space-y-4 pl-2 border-l-2 border-primary/20 ml-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Lightbulb size={12} />
              <span>How It Works</span>
            </div>
            <ol className="space-y-2 pl-4">
              {debug.steps.map((step, i) => (
                <li key={i} className="text-sm text-foreground/80 list-decimal">
                  {step}
                </li>
              ))}
            </ol>
          </div>
          
          {debug.visuals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Microscope size={12} />
                <span>Intermediate Visualizations</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {debug.visuals.map((visual, i) => (
                  <div key={i} className="space-y-1.5" data-testid={`walkthrough-visual-${tokenType}-${i}`}>
                    <div className="aspect-video rounded-md border border-border overflow-hidden bg-black/5">
                      <img 
                        src={visual.image} 
                        alt={visual.label}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-xs font-medium">{visual.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{visual.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AlgorithmWalkthrough({ debug }: { debug: Record<string, CVDebugInfo> }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const tokenOrder = ['color', 'spacing', 'borderRadius', 'grid', 'elevation', 'strokeWidth'];
  const availableTokens = tokenOrder.filter(t => debug[t]);
  
  if (availableTokens.length === 0) return null;
  
  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid="algorithm-walkthrough">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-3 w-full p-4 bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 transition-colors text-left">
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Microscope size={18} className="text-primary" />
          <div className="flex-1">
            <div className="text-sm font-semibold">Algorithm Walkthrough</div>
            <div className="text-[10px] text-muted-foreground">
              See how each token type was extracted with step-by-step explanations and visualizations
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="p-4 pt-2 border-t border-border bg-muted/20">
          <div className="space-y-3">
            {availableTokens.map(tokenType => (
              <WalkthroughSection 
                key={tokenType} 
                tokenType={tokenType} 
                debug={debug[tokenType]} 
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function CVTokenExplorer({ referenceImage, styleName }: CVTokenExplorerProps) {
  const [tokens, setTokens] = useState<CVExtractedTokens | null>(null);
  const [debug, setDebug] = useState<Record<string, CVDebugInfo> | null>(null);
  const [loading, setLoading] = useState(false);
  const [walkthroughLoading, setWalkthroughLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cvEnabled, setCvEnabled] = useState<boolean | null>(null);
  const [walkthroughEnabled, setWalkthroughEnabled] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/cv-status');
      const data = await res.json();
      setCvEnabled(data.enabled);
      return data.enabled;
    } catch {
      setCvEnabled(false);
      return false;
    }
  };

  const extractTokens = async (withWalkthrough = false) => {
    if (!referenceImage) {
      setError("No reference image available");
      return;
    }

    if (withWalkthrough) {
      setWalkthroughLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const enabled = await checkStatus();
      if (!enabled) {
        setError("CV extraction is not enabled on this server");
        setLoading(false);
        setWalkthroughLoading(false);
        return;
      }

      const res = await fetch('/api/analyze-image-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: referenceImage,
          includeWalkthrough: withWalkthrough 
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'CV extraction failed');
      }

      const data = await res.json();
      setTokens(data.rawTokens);
      if (data.debug) {
        setDebug(data.debug);
        setWalkthroughEnabled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract tokens');
    } finally {
      setLoading(false);
      setWalkthroughLoading(false);
    }
  };

  const loadWalkthrough = async () => {
    await extractTokens(true);
  };

  if (!referenceImage) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="text-muted-foreground mb-3" size={32} />
        <p className="text-sm text-muted-foreground">No reference image available for this style</p>
      </div>
    );
  }

  if (!tokens && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Eye className="text-primary" size={24} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">CV Token Extraction</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Analyze the reference image to extract design tokens using computer vision. 
            This is fast, deterministic, and runs entirely on CPU.
          </p>
        </div>
        <button
          onClick={() => extractTokens(false)}
          disabled={loading}
          data-testid="button-extract-cv-tokens"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Analyzing...
            </span>
          ) : (
            'Extract Tokens'
          )}
        </button>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary mb-3" size={32} />
        <p className="text-sm text-muted-foreground">Analyzing image with CV...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="text-destructive mb-3" size={32} />
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => extractTokens(false)}
          className="mt-4 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!tokens) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Extracted via {tokens.meta.method} • Confidence: {tokens.meta.confidence}
        </div>
        <div className="flex items-center gap-3">
          {!debug && !walkthroughLoading && (
            <button
              onClick={loadWalkthrough}
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
              data-testid="button-load-walkthrough"
            >
              <Microscope size={12} />
              Load Walkthrough
            </button>
          )}
          {walkthroughLoading && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Loading walkthrough...
            </span>
          )}
          <button
            onClick={() => extractTokens(false)}
            className="text-[10px] underline text-muted-foreground hover:text-foreground"
            data-testid="button-refresh-cv-tokens"
          >
            Re-analyze
          </button>
        </div>
      </div>

      {debug && (
        <AlgorithmWalkthrough debug={debug} />
      )}

      <ColorSection colors={tokens.color} />
      <div className="border-t border-border pt-6">
        <SpacingSection spacing={tokens.spacing} />
      </div>
      <div className="border-t border-border pt-6">
        <BorderRadiusSection radii={tokens.borderRadius} />
      </div>
      <div className="border-t border-border pt-6">
        <ElevationSection elevation={tokens.elevation} />
      </div>
      <div className="border-t border-border pt-6">
        <StrokeSection strokes={tokens.strokeWidth} />
      </div>
      <div className="border-t border-border pt-6">
        <GridSection grid={tokens.grid} />
      </div>
    </div>
  );
}
