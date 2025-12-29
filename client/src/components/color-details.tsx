import { useState, useMemo } from "react";
import { Check, Copy, ChevronDown, ChevronUp, Thermometer, Droplets, Contrast, Info, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EnhancedColor, ColorAnalysis, DTCGTokenGroup, DesignToken } from "@/lib/store";

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function calculateWarmth(hue: number): number {
  if (hue <= 60) return Math.round(100 - (hue / 60) * 50);
  if (hue <= 120) return Math.round(50 - ((hue - 60) / 60) * 50);
  if (hue <= 180) return 0;
  if (hue <= 240) return Math.round(((hue - 180) / 60) * 25);
  if (hue <= 300) return Math.round(25 + ((hue - 240) / 60) * 25);
  return Math.round(50 + ((hue - 300) / 60) * 50);
}

function getSaturationLabel(saturation: number): string {
  if (saturation < 10) return "neutral";
  if (saturation < 25) return "muted";
  if (saturation < 40) return "soft";
  if (saturation < 60) return "moderate";
  if (saturation < 80) return "vivid";
  return "intense";
}

function inferRole(name: string, hsl: [number, number, number]): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("background") || lowerName.includes("bg")) return "background";
  if (lowerName.includes("text") || lowerName.includes("foreground")) return "text";
  if (lowerName.includes("accent")) return "accent";
  if (lowerName.includes("primary")) return "primary";
  if (lowerName.includes("secondary")) return "secondary";
  if (lowerName.includes("button") || lowerName.includes("btn")) return "button";
  if (lowerName.includes("border")) return "border";
  if (lowerName.includes("shadow")) return "shadow";
  if (lowerName.includes("surface") || lowerName.includes("panel")) return "panel";
  if (lowerName.includes("muted") || lowerName.includes("neutral")) return "muted";
  if (lowerName.includes("highlight")) return "highlight";
  
  const [, sat, light] = hsl;
  if (light > 85 || light < 15) return "background";
  if (sat < 15) return "neutral";
  if (sat > 60) return "accent";
  return "secondary";
}

function findBestContrastPartner(color: { hex: string; rgb: [number, number, number] }, allColors: Array<{ hex: string; rgb: [number, number, number] }>): { hex: string; ratio: number; wcagAA: boolean; wcagAAA: boolean } | null {
  let bestPartner = null;
  let bestRatio = 0;
  
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };
  
  const lum1 = getLuminance(color.rgb[0], color.rgb[1], color.rgb[2]);
  
  for (const other of allColors) {
    if (other.hex === color.hex) continue;
    const lum2 = getLuminance(other.rgb[0], other.rgb[1], other.rgb[2]);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestPartner = other;
    }
  }
  
  return bestPartner ? {
    hex: bestPartner.hex,
    ratio: Math.round(bestRatio * 100) / 100,
    wcagAA: bestRatio >= 4.5,
    wcagAAA: bestRatio >= 7
  } : null;
}

function extractColorsFromDTCG(tokens: DTCGTokenGroup | null | undefined): EnhancedColor[] {
  if (!tokens || typeof tokens !== "object") return [];
  
  const colors: EnhancedColor[] = [];
  const colorGroup = tokens.color;
  if (!colorGroup || typeof colorGroup !== "object") return colors;

  const isToken = (n: any): n is DesignToken => {
    return n && typeof n === "object" && "$value" in n && "$type" in n;
  };

  const rawColors: Array<{ name: string; hex: string; rgb: [number, number, number] }> = [];

  const processColorEntry = (key: string, value: any, prefix: string = "") => {
    const fullName = prefix ? `${prefix}.${key}` : key;
    
    if (isToken(value) && value.$type === "color") {
      const colorValue = String(value.$value);
      if (colorValue.startsWith("#")) {
        const rgb = hexToRgb(colorValue);
        if (rgb) {
          rawColors.push({ name: fullName, hex: colorValue, rgb });
        }
      }
    } else if (typeof value === "object" && !isToken(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        processColorEntry(subKey, subValue, fullName);
      }
    }
  };

  for (const [key, value] of Object.entries(colorGroup)) {
    processColorEntry(key, value);
  }

  for (let i = 0; i < rawColors.length && i < 10; i++) {
    const { name, hex, rgb } = rawColors[i];
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const warmth = calculateWarmth(hsl[0]);
    const satLabel = getSaturationLabel(hsl[1]) as EnhancedColor["saturation"];
    const role = inferRole(name, hsl) as EnhancedColor["role"];
    const contrastPartner = findBestContrastPartner({ hex, rgb }, rawColors);

    colors.push({
      space: "oklch",
      l: hsl[2] / 100,
      c: hsl[1] / 100,
      h: hsl[0],
      hex,
      rgb,
      coverage: Math.max(5, 30 - i * 3),
      confidence: 0.85,
      role,
      warmth,
      saturation: satLabel,
      contrastPartner
    });
  }

  return colors;
}

interface ColorSwatchCardProps {
  color: EnhancedColor;
  index: number;
}

function ColorSwatchCard({ color, index }: ColorSwatchCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isLightColor = color.l > 0.6;
  const textColor = isLightColor ? "text-gray-800" : "text-white";

  const roleColors: Record<string, string> = {
    background: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    text: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
    shadow: "bg-gray-600/20 text-gray-600 dark:text-gray-400",
    accent: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    button: "bg-green-500/20 text-green-700 dark:text-green-300",
    panel: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
    slider: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    border: "bg-gray-400/20 text-gray-600 dark:text-gray-400",
    highlight: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    muted: "bg-gray-300/20 text-gray-500 dark:text-gray-400",
    primary: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
    secondary: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
    tertiary: "bg-teal-500/20 text-teal-700 dark:text-teal-300",
    neutral: "bg-gray-200/20 text-gray-500 dark:text-gray-400",
  };

  const saturationColors: Record<string, string> = {
    neutral: "text-gray-500",
    muted: "text-gray-600 dark:text-gray-400",
    soft: "text-blue-500 dark:text-blue-400",
    moderate: "text-indigo-500 dark:text-indigo-400",
    vivid: "text-purple-500 dark:text-purple-400",
    intense: "text-pink-500 dark:text-pink-400",
  };

  return (
    <div
      className="group rounded-lg border border-border bg-card overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all"
      data-testid={`color-swatch-${index}`}
    >
      <button
        onClick={() => handleCopy(color.hex)}
        className="w-full h-16 flex items-center justify-center relative cursor-pointer"
        style={{ backgroundColor: color.hex }}
        data-testid={`color-swatch-bg-${index}`}
      >
        <span className={cn("opacity-0 group-hover:opacity-100 transition-opacity", textColor)}>
          {copied ? <Check size={20} /> : <Copy size={18} />}
        </span>
        
        <Badge
          className={cn(
            "absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 font-medium capitalize",
            roleColors[color.role] || roleColors.neutral
          )}
          data-testid={`color-role-${index}`}
        >
          {color.role}
        </Badge>
      </button>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-foreground uppercase">
            {color.hex}
          </span>
          {copied && (
            <span className="text-[10px] text-green-500 font-medium">Copied!</span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Coverage</span>
            <span className="font-medium">{color.coverage.toFixed(1)}%</span>
          </div>
          <Progress value={color.coverage} className="h-1" data-testid={`color-coverage-${index}`} />
        </div>

        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors pt-1">
            <span className="flex items-center gap-1">
              <Info size={10} />
              Details
            </span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </CollapsibleTrigger>
          
          <CollapsibleContent className="pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Thermometer size={10} className={color.warmth > 50 ? "text-orange-500" : "text-blue-500"} />
                      <span>{color.warmth > 50 ? "Warm" : "Cool"}</span>
                      <span className="font-medium text-foreground">{color.warmth}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Warmth: {color.warmth}% (0=cool, 100=warm)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Droplets size={10} className={saturationColors[color.saturation]} />
                      <span className={cn("capitalize", saturationColors[color.saturation])}>
                        {color.saturation}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Saturation level based on chroma</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Eye size={10} />
                      <span>Conf.</span>
                      <span className="font-medium text-foreground">{(color.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Extraction confidence: {(color.confidence * 100).toFixed(0)}%</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {color.contrastPartner && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Contrast size={10} />
                        <div
                          className="w-3 h-3 rounded-sm border border-border"
                          style={{ backgroundColor: color.contrastPartner.hex }}
                        />
                        <span className="font-medium text-foreground">
                          {color.contrastPartner.ratio.toFixed(1)}:1
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Best contrast pair: {color.contrastPartner.hex}</p>
                      <p>WCAG AA: {color.contrastPartner.wcagAA ? "✓" : "✗"}</p>
                      <p>WCAG AAA: {color.contrastPartner.wcagAAA ? "✓" : "✗"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="pt-1 border-t border-border/50 text-[9px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>OKLCH</span>
                <span className="font-mono">
                  {color.l.toFixed(2)} {color.c.toFixed(2)} {color.h.toFixed(0)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span>RGB</span>
                <span className="font-mono">
                  {color.rgb[0]}, {color.rgb[1]}, {color.rgb[2]}
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

interface ColorAnalysisSummaryProps {
  analysis: ColorAnalysis;
}

function ColorAnalysisSummary({ analysis }: ColorAnalysisSummaryProps) {
  const temperatureColor = {
    warm: "text-orange-500",
    cool: "text-blue-500",
    neutral: "text-gray-500",
  }[analysis.temperature.overall];

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg" data-testid="color-analysis-summary">
      <div className="text-center space-y-1">
        <div className="text-2xl font-bold text-foreground capitalize">
          {analysis.harmony.type}
        </div>
        <div className="text-xs text-muted-foreground">Harmony</div>
      </div>
      
      <div className="text-center space-y-1">
        <div className={cn("text-2xl font-bold capitalize", temperatureColor)}>
          {analysis.temperature.overall}
        </div>
        <div className="text-xs text-muted-foreground">Temperature</div>
      </div>
      
      <div className="text-center space-y-1">
        <div className="text-2xl font-bold text-foreground">
          {analysis.contrast.filter(c => c.wcagAA).length}
        </div>
        <div className="text-xs text-muted-foreground">WCAG AA Pairs</div>
      </div>
    </div>
  );
}

interface ColorDetailsProps {
  colors?: EnhancedColor[];
  tokens?: DTCGTokenGroup | null;
  analysis?: ColorAnalysis;
  className?: string;
}

export function ColorDetails({ colors: providedColors, tokens, analysis, className }: ColorDetailsProps) {
  const colors = useMemo(() => {
    if (providedColors && providedColors.length > 0) {
      return providedColors;
    }
    if (tokens) {
      return extractColorsFromDTCG(tokens);
    }
    return [];
  }, [providedColors, tokens]);

  const derivedAnalysis = useMemo(() => {
    if (analysis) return analysis;
    if (colors.length === 0) return null;
    
    const warmCount = colors.filter(c => c.warmth > 50).length;
    const coolCount = colors.filter(c => c.warmth < 50).length;
    const neutralCount = colors.filter(c => c.warmth === 50).length;
    
    return {
      harmony: { type: "varied", score: 0.7, relationships: [] },
      contrast: [],
      temperature: {
        overall: (warmCount > coolCount ? "warm" : coolCount > warmCount ? "cool" : "neutral") as "warm" | "cool" | "neutral",
        warmColors: warmCount,
        coolColors: coolCount,
        neutralColors: neutralCount
      }
    };
  }, [colors, analysis]);

  if (colors.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground text-center py-8", className)}>
        No color data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="color-details-section">
      {derivedAnalysis && <ColorAnalysisSummary analysis={derivedAnalysis} />}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {colors.map((color, index) => (
          <ColorSwatchCard key={`${color.hex}-${index}`} color={color} index={index} />
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        {colors.length} colors • Click any swatch to copy hex code
      </p>
    </div>
  );
}

export { extractColorsFromDTCG };
