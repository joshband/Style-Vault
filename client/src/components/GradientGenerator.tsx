import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Plus, Trash2, RotateCw, Shuffle, Download } from "lucide-react";

interface ColorStop {
  id: string;
  color: string;
  position: number;
}

type GradientType = "linear" | "radial" | "conic";

interface GradientGeneratorProps {
  initialColors?: string[];
  onExport?: (css: string, tokens: Record<string, unknown>) => void;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function randomColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

export function GradientGenerator({ initialColors, onExport }: GradientGeneratorProps) {
  const [gradientType, setGradientType] = useState<GradientType>("linear");
  const [angle, setAngle] = useState(90);
  const [radialShape, setRadialShape] = useState<"circle" | "ellipse">("circle");
  const [colorStops, setColorStops] = useState<ColorStop[]>(() => {
    if (initialColors && initialColors.length >= 2) {
      return initialColors.slice(0, 5).map((color, i, arr) => ({
        id: generateId(),
        color,
        position: Math.round((i / (arr.length - 1)) * 100),
      }));
    }
    return [
      { id: generateId(), color: "#6366f1", position: 0 },
      { id: generateId(), color: "#ec4899", position: 100 },
    ];
  });

  const gradientCSS = useMemo(() => {
    const sortedStops = [...colorStops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(", ");
    
    switch (gradientType) {
      case "linear":
        return `linear-gradient(${angle}deg, ${stopsStr})`;
      case "radial":
        return `radial-gradient(${radialShape} at center, ${stopsStr})`;
      case "conic":
        return `conic-gradient(from ${angle}deg at center, ${stopsStr})`;
      default:
        return `linear-gradient(${angle}deg, ${stopsStr})`;
    }
  }, [colorStops, gradientType, angle, radialShape]);

  const addColorStop = useCallback(() => {
    if (colorStops.length >= 8) {
      toast.error("Maximum 8 color stops allowed");
      return;
    }
    const positions = colorStops.map(s => s.position);
    let newPosition = 50;
    for (let i = 0; i <= 100; i += 10) {
      if (!positions.some(p => Math.abs(p - i) < 5)) {
        newPosition = i;
        break;
      }
    }
    setColorStops([...colorStops, { id: generateId(), color: randomColor(), position: newPosition }]);
  }, [colorStops]);

  const removeColorStop = useCallback((id: string) => {
    if (colorStops.length <= 2) {
      toast.error("Minimum 2 color stops required");
      return;
    }
    setColorStops(colorStops.filter(s => s.id !== id));
  }, [colorStops]);

  const updateColorStop = useCallback((id: string, updates: Partial<ColorStop>) => {
    setColorStops(colorStops.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [colorStops]);

  const randomizeGradient = useCallback(() => {
    const numStops = 2 + Math.floor(Math.random() * 3);
    const newStops: ColorStop[] = [];
    for (let i = 0; i < numStops; i++) {
      newStops.push({
        id: generateId(),
        color: randomColor(),
        position: Math.round((i / (numStops - 1)) * 100),
      });
    }
    setColorStops(newStops);
    setAngle(Math.floor(Math.random() * 360));
  }, []);

  const copyCSS = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`background: ${gradientCSS};`);
      toast.success("CSS copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }, [gradientCSS]);

  const exportAsTokens = useCallback(() => {
    const tokens = {
      gradient: {
        primary: {
          $type: "gradient",
          $value: gradientCSS,
          $description: `${gradientType} gradient with ${colorStops.length} color stops`,
        },
      },
      color: colorStops.reduce((acc, stop, i) => {
        acc[`gradient-stop-${i + 1}`] = {
          $type: "color",
          $value: stop.color,
          $description: `Gradient stop at ${stop.position}%`,
        };
        return acc;
      }, {} as Record<string, unknown>),
    };
    
    if (onExport) {
      onExport(gradientCSS, tokens);
    }
    
    const json = JSON.stringify(tokens, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gradient-tokens.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Gradient tokens exported");
  }, [gradientCSS, gradientType, colorStops, onExport]);

  return (
    <Card className="w-full" data-testid="gradient-generator">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-6 h-6 rounded" style={{ background: gradientCSS }} />
          Gradient Generator
        </CardTitle>
        <CardDescription>Create beautiful gradients with real-time preview</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div 
          className="w-full h-48 rounded-xl border shadow-inner"
          style={{ background: gradientCSS }}
          data-testid="gradient-preview"
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Gradient Type</Label>
            <Select value={gradientType} onValueChange={(v) => setGradientType(v as GradientType)}>
              <SelectTrigger data-testid="select-gradient-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="conic">Conic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {gradientType === "linear" || gradientType === "conic" ? (
            <div className="space-y-2">
              <Label>Angle: {angle}°</Label>
              <Slider
                value={[angle]}
                onValueChange={([v]) => setAngle(v)}
                min={0}
                max={360}
                step={1}
                data-testid="slider-angle"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Shape</Label>
              <Select value={radialShape} onValueChange={(v) => setRadialShape(v as "circle" | "ellipse")}>
                <SelectTrigger data-testid="select-radial-shape">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="ellipse">Ellipse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Color Stops ({colorStops.length}/8)</Label>
            <Button variant="outline" size="sm" onClick={addColorStop} data-testid="button-add-stop">
              <Plus className="w-4 h-4 mr-1" />
              Add Stop
            </Button>
          </div>

          <div className="space-y-2">
            {colorStops.sort((a, b) => a.position - b.position).map((stop) => (
              <div key={stop.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <Input
                  type="color"
                  value={stop.color}
                  onChange={(e) => updateColorStop(stop.id, { color: e.target.value })}
                  className="w-12 h-10 p-1 cursor-pointer"
                  data-testid={`input-color-${stop.id}`}
                />
                <Input
                  type="text"
                  value={stop.color}
                  onChange={(e) => updateColorStop(stop.id, { color: e.target.value })}
                  className="w-24 font-mono text-sm"
                  data-testid={`input-hex-${stop.id}`}
                />
                <div className="flex-1">
                  <Slider
                    value={[stop.position]}
                    onValueChange={([v]) => updateColorStop(stop.id, { position: v })}
                    min={0}
                    max={100}
                    step={1}
                    data-testid={`slider-position-${stop.id}`}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-10">{stop.position}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeColorStop(stop.id)}
                  disabled={colorStops.length <= 2}
                  data-testid={`button-remove-${stop.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <Label className="text-xs text-muted-foreground">CSS Output</Label>
          <code className="block mt-1 text-sm font-mono break-all" data-testid="css-output">
            background: {gradientCSS};
          </code>
        </div>

        <div className="flex gap-2">
          <Button onClick={copyCSS} className="flex-1" data-testid="button-copy-css">
            <Copy className="w-4 h-4 mr-2" />
            Copy CSS
          </Button>
          <Button variant="outline" onClick={randomizeGradient} data-testid="button-randomize">
            <Shuffle className="w-4 h-4 mr-2" />
            Randomize
          </Button>
          <Button variant="outline" onClick={exportAsTokens} data-testid="button-export-tokens">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
