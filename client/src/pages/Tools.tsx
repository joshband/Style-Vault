import { useState, useCallback } from "react";
import { Layout } from "@/components/layout";
import { GradientGenerator } from "@/components/GradientGenerator";
import { ColorPaletteTester } from "@/components/ColorPaletteTester";
import { FrameworkExport } from "@/components/FrameworkExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paintbrush, Palette, Code, Sparkles } from "lucide-react";

interface SharedState {
  colors: { name: string; hex: string }[];
  gradientCSS: string;
}

export default function Tools() {
  const [sharedState, setSharedState] = useState<SharedState>({
    colors: [],
    gradientCSS: "",
  });
  const [activeTab, setActiveTab] = useState("gradient");

  const handleGradientExport = useCallback((css: string, _tokens: Record<string, unknown>) => {
    setSharedState(prev => ({ ...prev, gradientCSS: css }));
  }, []);

  const handlePaletteExport = useCallback((palette: { id: string; name: string; hex: string }[]) => {
    setSharedState(prev => ({
      ...prev,
      colors: palette.map(p => ({ name: p.name, hex: p.hex })),
    }));
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-serif font-bold" data-testid="page-title">Design Tools</h1>
            </div>
            <p className="text-muted-foreground">
              Interactive tools for creating gradients, testing color palettes, and exporting to frameworks
            </p>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="gradient" className="flex items-center gap-2" data-testid="tab-gradient">
                <Paintbrush className="w-4 h-4" />
                <span className="hidden sm:inline">Gradient Generator</span>
                <span className="sm:hidden">Gradients</span>
              </TabsTrigger>
              <TabsTrigger value="palette" className="flex items-center gap-2" data-testid="tab-palette-main">
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Color Palette</span>
                <span className="sm:hidden">Colors</span>
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2" data-testid="tab-export">
                <Code className="w-4 h-4" />
                <span className="hidden sm:inline">Framework Export</span>
                <span className="sm:hidden">Export</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gradient" className="space-y-6">
              <GradientGenerator onExport={handleGradientExport} />
              
              {sharedState.gradientCSS && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Your gradient is ready for export. Switch to the Framework Export tab to generate code.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="palette" className="space-y-6">
              <ColorPaletteTester onExport={handlePaletteExport} />
              
              {sharedState.colors.length > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Your palette is ready for export. Switch to the Framework Export tab to generate code.
                  </p>
                  <div className="flex gap-2">
                    {sharedState.colors.slice(0, 8).map((c, i) => (
                      <div 
                        key={i}
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="export" className="space-y-6">
              <FrameworkExport 
                colors={sharedState.colors.length > 0 ? sharedState.colors : undefined}
                gradientCSS={sharedState.gradientCSS || undefined}
                styleName="MyDesign"
              />
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Paintbrush className="w-4 h-4 text-purple-500" />
                    Gradient Preview
                  </h3>
                  {sharedState.gradientCSS ? (
                    <div 
                      className="h-24 rounded-lg border"
                      style={{ background: sharedState.gradientCSS }}
                    />
                  ) : (
                    <div className="h-24 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-sm">
                      Create a gradient in the Gradient tab
                    </div>
                  )}
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-500" />
                    Palette Preview
                  </h3>
                  {sharedState.colors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {sharedState.colors.map((c, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <div 
                            className="w-10 h-10 rounded-lg border"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs text-muted-foreground mt-1 truncate max-w-[60px]">
                            {c.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-24 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-sm">
                      Create a palette in the Colors tab
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
