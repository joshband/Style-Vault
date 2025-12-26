import { fetchStyleById, type Style } from "@/lib/store";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Wand2, Loader2, Download, ArrowLeft, Layers, Sparkles, Palette, Lightbulb, X } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useParams } from "wouter";

export default function Generate() {
  const { styleId } = useParams<{ styleId: string }>();
  const [style, setStyle] = useState<Style | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [generatedImageId, setGeneratedImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (styleId) {
      fetchStyleById(styleId)
        .then(setStyle)
        .catch(() => setError("Style not found"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setError("No style selected");
    }
  }, [styleId]);

  const handleGenerate = async () => {
    if (!styleId || !prompt || !style) return;
    setIsGenerating(true);
    setResult(null);
    setError(null);
    
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, styleId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to generate image");
      }
      
      const data = await response.json();
      setGeneratedImageId(data.id);
      setResult(`data:image/png;base64,${data.imageBase64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    const base64Data = result.split(",")[1];
    if (!base64Data) {
      window.open(result, "_blank");
      return;
    }
    
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${style?.name?.toLowerCase().replace(/\s+/g, "-") || "generated"}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      window.open(result, "_blank");
    }
  };

  const addTagToPrompt = (tag: string) => {
    setPrompt(p => p ? `${p} ${tag}` : tag);
  };

  const clearPrompt = () => {
    setPrompt("");
  };

  // Extract style influence summary from tokens/metadata
  const getStyleInfluence = () => {
    if (!style) return null;
    
    const influences: { icon: React.ReactNode; label: string; value: string }[] = [];
    
    // Color influence from tokens
    if (style.tokens?.color) {
      const colorCount = Object.keys(style.tokens.color).length;
      influences.push({
        icon: <Palette size={14} />,
        label: "Color Palette",
        value: `${colorCount} curated colors will guide the output's palette`
      });
    }
    
    // Mood from metadata
    const moodTags = style.metadataTags?.mood;
    if (moodTags && moodTags.length > 0) {
      influences.push({
        icon: <Sparkles size={14} />,
        label: "Mood",
        value: moodTags.slice(0, 3).join(", ")
      });
    }
    
    // Art period influence
    const artPeriodTags = style.metadataTags?.artPeriod;
    if (artPeriodTags && artPeriodTags.length > 0) {
      influences.push({
        icon: <Lightbulb size={14} />,
        label: "Artistic Influence",
        value: artPeriodTags.slice(0, 2).join(", ")
      });
    }
    
    return influences;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!style) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Layers size={20} />
            <span className="font-serif font-medium text-sm">Visual DNA</span>
          </Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-muted-foreground text-center">No style selected. Please select a style first.</p>
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
              <ArrowLeft size={14} />
              Browse Styles
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const styleInfluences = getStyleInfluence();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal Header - Generation Mode */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <Layers size={20} />
          <span className="font-serif font-medium text-sm">Visual DNA</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Generation Mode</span>
          <Link 
            href={`/style/${styleId}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            data-testid="link-back-to-inspect"
          >
            <ArrowLeft size={12} />
            Back to Style
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          
          {/* Style Context Card */}
          <div className="bg-card border border-border rounded-xl p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Style Previews - Compact */}
              <div className="flex gap-2 shrink-0">
                {style.previews.portrait && (
                  <div className="w-16 h-20 md:w-20 md:h-24 rounded-lg overflow-hidden border border-border/50">
                    <img src={style.previews.portrait} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                {style.previews.landscape && (
                  <div className="w-16 h-20 md:w-20 md:h-24 rounded-lg overflow-hidden border border-border/50">
                    <img src={style.previews.landscape} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                {style.previews.stillLife && (
                  <div className="w-16 h-20 md:w-20 md:h-24 rounded-lg overflow-hidden border border-border/50">
                    <img src={style.previews.stillLife} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              
              {/* Style Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-serif font-medium text-foreground truncate">{style.name}</h1>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{style.description}</p>
                
                {/* How This Style Influences Generation */}
                {styleInfluences && styleInfluences.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      How this style shapes your image
                    </p>
                    <div className="space-y-2">
                      {styleInfluences.map((influence, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-0.5">{influence.icon}</span>
                          <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">{influence.label}:</span> {influence.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visual DNA Tags - Click to Insert */}
          {style.metadataTags && style.metadataEnrichmentStatus === "complete" && (
            <div className="bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/20 rounded-xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-500" />
                    Visual DNA
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tap any tag to add it to your prompt for more stylistic control
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* Mood */}
                {style.metadataTags.mood?.map((tag: string) => (
                  <button
                    key={`mood-${tag}`}
                    onClick={() => addTagToPrompt(tag)}
                    className="text-xs px-2.5 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full hover:ring-2 hover:ring-purple-400 transition-all cursor-pointer"
                    data-testid={`tag-mood-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
                {/* Art Period */}
                {style.metadataTags.artPeriod?.map((tag: string) => (
                  <button
                    key={`artPeriod-${tag}`}
                    onClick={() => addTagToPrompt(tag)}
                    className="text-xs px-2.5 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:ring-2 hover:ring-amber-400 transition-all cursor-pointer"
                    data-testid={`tag-artPeriod-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
                {/* Color Family */}
                {style.metadataTags.colorFamily?.map((tag: string) => (
                  <button
                    key={`colorFamily-${tag}`}
                    onClick={() => addTagToPrompt(tag)}
                    className="text-xs px-2.5 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer"
                    data-testid={`tag-colorFamily-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
                {/* Narrative Tone */}
                {style.metadataTags.narrativeTone?.map((tag: string) => (
                  <button
                    key={`narrativeTone-${tag}`}
                    onClick={() => addTagToPrompt(tag)}
                    className="text-xs px-2.5 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-full hover:ring-2 hover:ring-rose-400 transition-all cursor-pointer"
                    data-testid={`tag-narrativeTone-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
                {/* Psychological Effect */}
                {style.metadataTags.psychologicalEffect?.map((tag: string) => (
                  <button
                    key={`psychologicalEffect-${tag}`}
                    onClick={() => addTagToPrompt(tag)}
                    className="text-xs px-2.5 py-1.5 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded-full hover:ring-2 hover:ring-teal-400 transition-all cursor-pointer"
                    data-testid={`tag-psychologicalEffect-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
                {/* Cultural Resonance */}
                {style.metadataTags.culturalResonance?.map((tag: string) => (
                  <button
                    key={`culturalResonance-${tag}`}
                    onClick={() => addTagToPrompt(tag)}
                    className="text-xs px-2.5 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full hover:ring-2 hover:ring-emerald-400 transition-all cursor-pointer"
                    data-testid={`tag-culturalResonance-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Composition */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Describe Your Image</label>
              {prompt && (
                <button
                  onClick={clearPrompt}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to create... The style's colors, mood, and artistic influences will be applied automatically."
                className="w-full resize-none p-4 text-sm bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/30 outline-none min-h-[120px]"
                data-testid="input-concept-prompt"
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                {prompt.length} characters
              </div>
            </div>
            
            <button 
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              data-testid="button-generate"
              className={cn(
                "w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                prompt.trim() && !isGenerating
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Creating your image...
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  Generate Image
                </>
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Generation Result */}
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Your Generated Image</h3>
                <button
                  onClick={handleDownload}
                  data-testid="button-download"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-colors"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
              
              <div className="bg-muted rounded-xl border border-border overflow-hidden">
                <img 
                  src={result} 
                  alt="Generated result" 
                  className="w-full max-h-[600px] object-contain"
                />
              </div>
            </motion.div>
          )}

          {/* Placeholder States */}
          {!result && !isGenerating && (
            <div className="bg-muted/30 rounded-xl border border-dashed border-border p-12 flex flex-col items-center justify-center gap-2">
              <Wand2 size={32} className="text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground text-center">
                Your generated image will appear here
              </p>
            </div>
          )}

          {isGenerating && (
            <div className="bg-primary/5 rounded-xl border border-primary/20 p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-primary" size={32} />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Creating your image...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Applying {style.name}'s visual characteristics
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
