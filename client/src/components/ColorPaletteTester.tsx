import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Check, X, AlertTriangle, Eye } from "lucide-react";

interface PaletteColor {
  id: string;
  name: string;
  hex: string;
}

interface ContrastResult {
  ratio: number;
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
  aaaLarge: boolean;
}

interface ColorPaletteTesterProps {
  initialColors?: { name: string; hex: string }[];
  onExport?: (palette: PaletteColor[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrast(hex1: string, hex2: string): ContrastResult {
  const ratio = getContrastRatio(hex1, hex2);
  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
  };
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#000000";
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function ColorPaletteTester({ initialColors, onExport }: ColorPaletteTesterProps) {
  const [colors, setColors] = useState<PaletteColor[]>(() => {
    if (initialColors && initialColors.length > 0) {
      return initialColors.map(c => ({ id: generateId(), name: c.name, hex: c.hex }));
    }
    return [
      { id: generateId(), name: "Primary", hex: "#6366f1" },
      { id: generateId(), name: "Secondary", hex: "#8b5cf6" },
      { id: generateId(), name: "Background", hex: "#ffffff" },
      { id: generateId(), name: "Text", hex: "#1f2937" },
    ];
  });

  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);

  const addColor = useCallback(() => {
    if (colors.length >= 12) {
      toast.error("Maximum 12 colors allowed");
      return;
    }
    const newColor = {
      id: generateId(),
      name: `Color ${colors.length + 1}`,
      hex: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    };
    setColors([...colors, newColor]);
  }, [colors]);

  const removeColor = useCallback((id: string) => {
    if (colors.length <= 2) {
      toast.error("Minimum 2 colors required");
      return;
    }
    setColors(colors.filter(c => c.id !== id));
    if (selectedPair && selectedPair.includes(id)) {
      setSelectedPair(null);
    }
  }, [colors, selectedPair]);

  const updateColor = useCallback((id: string, updates: Partial<PaletteColor>) => {
    setColors(colors.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [colors]);

  const contrastMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, ContrastResult>> = {};
    for (const c1 of colors) {
      matrix[c1.id] = {};
      for (const c2 of colors) {
        if (c1.id !== c2.id) {
          matrix[c1.id][c2.id] = checkContrast(c1.hex, c2.hex);
        }
      }
    }
    return matrix;
  }, [colors]);

  const accessibilityIssues = useMemo(() => {
    const issues: { pair: [PaletteColor, PaletteColor]; result: ContrastResult }[] = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const result = checkContrast(colors[i].hex, colors[j].hex);
        if (!result.aaLarge) {
          issues.push({ pair: [colors[i], colors[j]], result });
        }
      }
    }
    return issues;
  }, [colors]);

  const copyPalette = useCallback(async () => {
    const css = colors.map(c => `--${c.name.toLowerCase().replace(/\s+/g, '-')}: ${c.hex};`).join('\n');
    try {
      await navigator.clipboard.writeText(`:root {\n  ${css.split('\n').join('\n  ')}\n}`);
      toast.success("CSS variables copied");
    } catch {
      toast.error("Failed to copy");
    }
  }, [colors]);

  const exportPalette = useCallback(() => {
    if (onExport) {
      onExport(colors);
    }
    const tokens = {
      color: colors.reduce((acc, c) => {
        acc[c.name.toLowerCase().replace(/\s+/g, '-')] = {
          $type: "color",
          $value: c.hex,
        };
        return acc;
      }, {} as Record<string, unknown>),
    };
    const json = JSON.stringify(tokens, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "color-palette.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Palette exported as tokens");
  }, [colors, onExport]);

  const selectedContrast = useMemo(() => {
    if (!selectedPair) return null;
    const [id1, id2] = selectedPair;
    const c1 = colors.find(c => c.id === id1);
    const c2 = colors.find(c => c.id === id2);
    if (!c1 || !c2) return null;
    return { colors: [c1, c2], result: checkContrast(c1.hex, c2.hex) };
  }, [selectedPair, colors]);

  return (
    <Card className="w-full" data-testid="color-palette-tester">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Color Palette Tester
        </CardTitle>
        <CardDescription>Test color combinations and check WCAG accessibility compliance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="palette">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="palette" data-testid="tab-palette">Palette</TabsTrigger>
            <TabsTrigger value="contrast" data-testid="tab-contrast">Contrast Matrix</TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="palette" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Colors ({colors.length}/12)</Label>
              <Button variant="outline" size="sm" onClick={addColor} data-testid="button-add-color">
                <Plus className="w-4 h-4 mr-1" />
                Add Color
              </Button>
            </div>

            <div className="grid gap-3">
              {colors.map((color) => (
                <div key={color.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div
                    className="w-12 h-12 rounded-lg border shadow-sm flex-shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={color.name}
                      onChange={(e) => updateColor(color.id, { name: e.target.value })}
                      placeholder="Color name"
                      data-testid={`input-name-${color.id}`}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={color.hex}
                        onChange={(e) => updateColor(color.id, { hex: e.target.value })}
                        className="w-14 p-1 cursor-pointer"
                        data-testid={`input-picker-${color.id}`}
                      />
                      <Input
                        value={color.hex}
                        onChange={(e) => updateColor(color.id, { hex: e.target.value })}
                        className="font-mono text-sm"
                        data-testid={`input-hex-${color.id}`}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeColor(color.id)}
                    disabled={colors.length <= 2}
                    data-testid={`button-remove-${color.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {accessibilityIssues.length > 0 && (
              <div className="p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-600 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Accessibility Issues ({accessibilityIssues.length})</span>
                </div>
                <div className="space-y-1 text-sm">
                  {accessibilityIssues.slice(0, 5).map(({ pair, result }, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: pair[0].hex }} />
                      <span>+</span>
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: pair[1].hex }} />
                      <span className="text-muted-foreground">
                        {pair[0].name} / {pair[1].name}: {result.ratio}:1
                      </span>
                    </div>
                  ))}
                  {accessibilityIssues.length > 5 && (
                    <span className="text-muted-foreground">
                      +{accessibilityIssues.length - 5} more issues
                    </span>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contrast" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Click any cell to see detailed contrast information
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="p-2"></th>
                    {colors.map(c => (
                      <th key={c.id} className="p-2 text-center">
                        <div className="w-8 h-8 mx-auto rounded" style={{ backgroundColor: c.hex }} title={c.name} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {colors.map(c1 => (
                    <tr key={c1.id}>
                      <td className="p-2">
                        <div className="w-8 h-8 rounded" style={{ backgroundColor: c1.hex }} title={c1.name} />
                      </td>
                      {colors.map(c2 => {
                        if (c1.id === c2.id) {
                          return <td key={c2.id} className="p-1"><div className="w-full h-10 bg-muted rounded" /></td>;
                        }
                        const result = contrastMatrix[c1.id]?.[c2.id];
                        if (!result) return <td key={c2.id} className="p-1" />;
                        
                        const bgColor = result.aa ? "bg-green-500/20" : result.aaLarge ? "bg-yellow-500/20" : "bg-red-500/20";
                        const isSelected = selectedPair && selectedPair[0] === c1.id && selectedPair[1] === c2.id;
                        
                        return (
                          <td key={c2.id} className="p-1">
                            <button
                              onClick={() => setSelectedPair([c1.id, c2.id])}
                              className={`w-full h-10 rounded text-xs font-mono ${bgColor} ${isSelected ? 'ring-2 ring-primary' : ''} hover:opacity-80 transition-opacity`}
                              data-testid={`cell-${c1.id}-${c2.id}`}
                            >
                              {result.ratio}:1
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedContrast && (
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded" style={{ backgroundColor: selectedContrast.colors[0].hex }} />
                    <span className="font-medium">{selectedContrast.colors[0].name}</span>
                  </div>
                  <span className="text-muted-foreground">vs</span>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded" style={{ backgroundColor: selectedContrast.colors[1].hex }} />
                    <span className="font-medium">{selectedContrast.colors[1].name}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold">{selectedContrast.result.ratio}:1</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedContrast.result.aa ? "default" : "destructive"}>
                    {selectedContrast.result.aa ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    AA Normal
                  </Badge>
                  <Badge variant={selectedContrast.result.aaa ? "default" : "secondary"}>
                    {selectedContrast.result.aaa ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    AAA Normal
                  </Badge>
                  <Badge variant={selectedContrast.result.aaLarge ? "default" : "destructive"}>
                    {selectedContrast.result.aaLarge ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    AA Large
                  </Badge>
                  <Badge variant={selectedContrast.result.aaaLarge ? "default" : "secondary"}>
                    {selectedContrast.result.aaaLarge ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    AAA Large
                  </Badge>
                </div>
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ 
                    backgroundColor: selectedContrast.colors[0].hex, 
                    color: selectedContrast.colors[1].hex 
                  }}
                >
                  <p className="text-lg font-medium">Sample Text Preview</p>
                  <p className="text-sm">The quick brown fox jumps over the lazy dog</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div 
                className="p-6 rounded-lg"
                style={{ 
                  backgroundColor: colors[2]?.hex || "#ffffff",
                  color: colors[3]?.hex || "#000000"
                }}
              >
                <h3 className="text-xl font-bold mb-2" style={{ color: colors[0]?.hex }}>
                  Example Heading
                </h3>
                <p className="mb-4">
                  This is sample body text to preview how your colors work together in a realistic layout.
                </p>
                <div className="flex gap-2">
                  <button 
                    className="px-4 py-2 rounded font-medium"
                    style={{ 
                      backgroundColor: colors[0]?.hex, 
                      color: getContrastColor(colors[0]?.hex || "#6366f1")
                    }}
                  >
                    Primary Button
                  </button>
                  <button 
                    className="px-4 py-2 rounded font-medium border-2"
                    style={{ 
                      borderColor: colors[1]?.hex,
                      color: colors[1]?.hex
                    }}
                  >
                    Secondary Button
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {colors.map(c => (
                  <div 
                    key={c.id}
                    className="p-4 rounded-lg flex items-center justify-between"
                    style={{ backgroundColor: c.hex, color: getContrastColor(c.hex) }}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="font-mono text-sm">{c.hex}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2">
          <Button onClick={copyPalette} className="flex-1" data-testid="button-copy-palette">
            <Copy className="w-4 h-4 mr-2" />
            Copy CSS Variables
          </Button>
          <Button variant="outline" onClick={exportPalette} data-testid="button-export-palette">
            Export Tokens
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
