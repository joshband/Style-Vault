import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Loader2, Sparkles, X, Check, Sliders } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { preloadImage } from "@/lib/image-utils";

interface StyleSummary {
  id: string;
  name: string;
  description: string | null;
  thumbnailPreview?: string | null;
}

interface RemixResult {
  name: string;
  description: string;
  tokens: Record<string, any>;
  promptScaffolding: {
    base: string;
    modifiers: string[];
    negative: string;
  };
  sourceStyles: { id: string; name: string; weight: number }[];
}

export default function Remix() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [availableStyles, setAvailableStyles] = useState<StyleSummary[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<StyleSummary[]>([]);
  const [weights, setWeights] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [remixing, setRemixing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RemixResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);

  useEffect(() => {
    const fetchStyles = async () => {
      try {
        const res = await fetch("/api/styles/summaries");
        if (res.ok) {
          const data = await res.json();
          setAvailableStyles(data);
        }
      } catch (err) {
        console.error("Failed to fetch styles:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStyles();
  }, []);

  const toggleStyle = useCallback((style: StyleSummary) => {
    setSelectedStyles((prev) => {
      const isSelected = prev.some((s) => s.id === style.id);
      if (isSelected) {
        const newSelected = prev.filter((s) => s.id !== style.id);
        setWeights(newSelected.map(() => 1 / Math.max(newSelected.length, 1)));
        return newSelected;
      } else if (prev.length < 4) {
        const newSelected = [...prev, style];
        setWeights(newSelected.map(() => 1 / newSelected.length));
        return newSelected;
      }
      return prev;
    });
    setResult(null);
    setError(null);
  }, []);

  const handleWeightChange = useCallback((index: number, value: number) => {
    setWeights((prev) => {
      const newWeights = [...prev];
      newWeights[index] = value;
      return newWeights;
    });
  }, []);

  const handleStyleHover = useCallback((style: StyleSummary) => {
    if (style.thumbnailPreview) {
      preloadImage(style.thumbnailPreview, 2);
    }
  }, []);

  const handleRemix = async () => {
    if (selectedStyles.length < 2) return;
    
    setRemixing(true);
    setError(null);
    
    try {
      const res = await fetch("/api/styles/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleIds: selectedStyles.map((s) => s.id),
          weights: weights,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remix styles");
      }
      
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remix styles");
    } finally {
      setRemixing(false);
    }
  };

  const handleSave = async () => {
    if (!result || !isAuthenticated) return;
    
    setSaving(true);
    
    try {
      const res = await fetch("/api/styles/remix/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save style");
      }
      
      const savedStyle = await res.json();
      setLocation(`/style/${savedStyle.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save style");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono w-fit">
            <ArrowLeft size={12} /> Back to Vault
          </Link>
          
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-3xl font-serif font-medium">Style Remix</h1>
              <p className="text-muted-foreground text-sm">
                Blend 2-4 styles together to create something new
              </p>
            </div>
          </div>
        </div>

        {/* Selected Styles */}
        {selectedStyles.length > 0 && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Selected Styles ({selectedStyles.length}/4)</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWeights(!showWeights)}
                className="text-xs"
              >
                <Sliders size={14} className="mr-1" />
                {showWeights ? "Hide" : "Adjust"} Weights
              </Button>
            </div>
            
            <div className="space-y-3">
              {selectedStyles.map((style, index) => (
                <div key={style.id} className="flex items-center gap-3 bg-background rounded-md p-3 border border-border">
                  {style.thumbnailPreview && (
                    <img 
                      src={style.thumbnailPreview} 
                      alt="" 
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{style.name}</p>
                    {showWeights && (
                      <div className="flex items-center gap-2 mt-2">
                        <Slider
                          value={[weights[index] * 100]}
                          onValueChange={([v]) => handleWeightChange(index, v / 100)}
                          min={10}
                          max={90}
                          step={5}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground w-10">
                          {Math.round(weights[index] * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleStyle(style)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    data-testid={`remove-style-${style.id}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            
            <Button
              onClick={handleRemix}
              disabled={selectedStyles.length < 2 || remixing}
              className="w-full"
              data-testid="button-remix"
            >
              {remixing ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Remixing...
                </>
              ) : (
                <>
                  <Sparkles size={16} className="mr-2" />
                  Remix Styles
                </>
              )}
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Result Preview */}
        {result && (
          <div className="space-y-4 p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-serif font-medium">{result.name}</h2>
                <p className="text-muted-foreground mt-1">{result.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground">Sign in to save</p>
                )}
                <Button
                  onClick={handleSave}
                  disabled={!isAuthenticated || saving}
                  data-testid="button-save-remix"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} className="mr-2" />
                      Save to Vault
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Color Preview */}
            {result.tokens.color && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Blended Colors
                </h3>
                <div className="flex gap-2">
                  {Object.entries(result.tokens.color).map(([name, token]: [string, any]) => (
                    <div
                      key={name}
                      className="w-12 h-12 rounded-lg border border-border shadow-sm"
                      style={{ backgroundColor: token.$value }}
                      title={`${name}: ${token.$value}`}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Prompt Preview */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Blended Prompt
              </h3>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {result.promptScaffolding.base}
              </p>
            </div>
            
            {/* Source Attribution */}
            <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
              Remixed from: {result.sourceStyles.map(s => `${s.name} (${Math.round(s.weight * 100)}%)`).join(" + ")}
            </div>
          </div>
        )}

        {/* Available Styles Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">
            {selectedStyles.length === 0 ? "Select styles to remix" : "Add more styles"}
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {availableStyles.map((style) => {
                const isSelected = selectedStyles.some((s) => s.id === style.id);
                return (
                  <button
                    key={style.id}
                    onClick={() => toggleStyle(style)}
                    onMouseEnter={() => handleStyleHover(style)}
                    disabled={!isSelected && selectedStyles.length >= 4}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? "border-purple-500 ring-2 ring-purple-500/20"
                        : "border-border hover:border-muted-foreground/50 disabled:opacity-50"
                    }`}
                    data-testid={`select-style-${style.id}`}
                  >
                    {style.thumbnailPreview ? (
                      <img
                        src={style.thumbnailPreview}
                        alt={style.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">{style.name}</span>
                      </div>
                    )}
                    
                    {isSelected && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                          <Check size={16} className="text-white" />
                        </div>
                      </div>
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white truncate">{style.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
