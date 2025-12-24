import { Layout } from "@/components/layout";
import { fetchStyleById, type Style } from "@/lib/store";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Wand2, ArrowRight, Loader2, Download, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useParams } from "wouter";
import { InfoTooltip, FEATURE_EXPLANATIONS } from "@/components/info-tooltip";

export default function Generation() {
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
    
    // For base64 data URLs, we need to convert to blob first
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
      // Fallback: open in new tab for manual save
      window.open(result, "_blank");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  if (!style) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">No style selected. Please select a style from the Style Vault.</p>
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm">
              <ArrowLeft size={14} />
              Go to Style Vault
            </button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        {/* Back button */}
        <Link href={`/style/${styleId}`}>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back">
            <ArrowLeft size={14} />
            Back to Style Details
          </button>
        </Link>

        {/* Style Preview Header */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 3 Preview Images */}
            <div className="flex gap-2 flex-shrink-0">
              <div className="w-16 h-20 md:w-20 md:h-24 rounded overflow-hidden border border-border/50">
                <img 
                  src={style.previews.portrait} 
                  alt={`${style.name} portrait`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 md:w-20 md:h-24 rounded overflow-hidden border border-border/50">
                <img 
                  src={style.previews.landscape} 
                  alt={`${style.name} landscape`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 md:w-20 md:h-24 rounded overflow-hidden border border-border/50">
                <img 
                  src={style.previews.stillLife} 
                  alt={`${style.name} still life`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            {/* Style Info */}
            <div className="flex flex-col justify-center flex-1">
              <h1 className="text-xl md:text-2xl font-serif font-medium text-foreground">{style.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{style.description}</p>
            </div>
          </div>
          
          {/* Visual DNA Tags */}
          {style.metadataTags && style.metadataEnrichmentStatus === "complete" && (
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visual DNA</h4>
                <InfoTooltip testId="tooltip-visual-dna">{FEATURE_EXPLANATIONS.visualDNA}</InfoTooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Mood */}
                {style.metadataTags.mood?.length > 0 && style.metadataTags.mood.map((tag: string) => (
                  <span key={`mood-${tag}`} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full" data-testid={`tag-mood-${tag}`}>
                    {tag}
                  </span>
                ))}
                {/* Art Period */}
                {style.metadataTags.artPeriod?.length > 0 && style.metadataTags.artPeriod.map((tag: string) => (
                  <span key={`artPeriod-${tag}`} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full" data-testid={`tag-artPeriod-${tag}`}>
                    {tag}
                  </span>
                ))}
                {/* Color Family */}
                {style.metadataTags.colorFamily?.length > 0 && style.metadataTags.colorFamily.map((tag: string) => (
                  <span key={`colorFamily-${tag}`} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full" data-testid={`tag-colorFamily-${tag}`}>
                    {tag}
                  </span>
                ))}
                {/* Narrative Tone */}
                {style.metadataTags.narrativeTone?.length > 0 && style.metadataTags.narrativeTone.map((tag: string) => (
                  <span key={`narrativeTone-${tag}`} className="text-xs px-2 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-full" data-testid={`tag-narrativeTone-${tag}`}>
                    {tag}
                  </span>
                ))}
                {/* Psychological Effect */}
                {style.metadataTags.psychologicalEffect?.length > 0 && style.metadataTags.psychologicalEffect.map((tag: string) => (
                  <span key={`psychologicalEffect-${tag}`} className="text-xs px-2 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded-full" data-testid={`tag-psychologicalEffect-${tag}`}>
                    {tag}
                  </span>
                ))}
                {/* Cultural Resonance */}
                {style.metadataTags.culturalResonance?.length > 0 && style.metadataTags.culturalResonance.map((tag: string) => (
                  <span key={`culturalResonance-${tag}`} className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full" data-testid={`tag-culturalResonance-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            Describe Your Concept
            <InfoTooltip testId="tooltip-generation">{FEATURE_EXPLANATIONS.generation}</InfoTooltip>
          </h3>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A cozy reading nook with warm lighting and vintage books..."
            className="w-full resize-none p-4 text-sm bg-background border border-border rounded-lg focus:ring-1 focus:ring-primary/30 outline-none min-h-[120px]"
            data-testid="input-concept-prompt"
          />
          
          <button 
            onClick={handleGenerate}
            disabled={!prompt || isGenerating}
            data-testid="button-generate"
            className={cn(
              "h-12 px-6 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
              prompt && !isGenerating
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Generating...
              </>
            ) : (
              <>
                <Wand2 size={16} />
                Generate Image
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Generated Result</h3>
              <button
                onClick={handleDownload}
                data-testid="button-download"
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors"
              >
                <Download size={14} />
                Download
              </button>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-muted rounded-lg border border-border overflow-hidden"
            >
              <img 
                src={result} 
                alt="Generated result" 
                className="w-full max-h-[600px] object-contain"
              />
            </motion.div>
          </div>
        )}

        {/* Placeholder when no result */}
        {!result && !isGenerating && (
          <div className="bg-muted/50 rounded-lg border border-dashed border-border p-12 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Enter a prompt and click Generate to create an image in this style
            </p>
          </div>
        )}

        {/* Loading placeholder */}
        {isGenerating && (
          <div className="bg-muted/50 rounded-lg border border-border p-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm text-muted-foreground">Creating your image...</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
