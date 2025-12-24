import { useRoute, useLocation } from "wouter";
import { fetchStyleById, type Style } from "@/lib/store";
import { Layout } from "@/components/layout";
import { TokenViewer } from "@/components/token-viewer";
import { CVTokenExplorer } from "@/components/cv-token-explorer";
import { ArrowLeft, ImageIcon, Layers, Download, Loader2, Wand2, Eye } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useStyleTheme } from "@/hooks/useStyleTheme";
import { AiMoodBoard } from "@/components/ai-mood-board";
import { InfoTooltip, FEATURE_EXPLANATIONS } from "@/components/info-tooltip";

type DetailTab = 'tokens' | 'scaffolding' | 'explorer';

export default function Inspect() {
  const [, params] = useRoute("/style/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const [style, setStyle] = useState<Style | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('tokens');
  
  const theme = useStyleTheme(style?.tokens as any);

  useEffect(() => {
    if (id) {
      fetchStyleById(id)
        .then(setStyle)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleDownloadTokens = () => {
    if (!style) return;
    const tokensJson = JSON.stringify(style.tokens, null, 2);
    const blob = new Blob([tokensJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${style.name.toLowerCase().replace(/\s+/g, "-")}-tokens.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUseStyle = () => {
    if (!style) return;
    setLocation(`/generate/${style.id}`);
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
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <h1 className="text-2xl font-serif text-muted-foreground">Style Not Found</h1>
          <Link href="/" className="mt-4 text-sm underline">Return to Explorer</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col gap-4 md:gap-6">
           <Link href="/" className="inline-flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono mb-2 w-fit">
             <ArrowLeft size={12} /> Back to Vault
           </Link>
           
           <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-0">
             <div className="space-y-2 flex-1 min-w-0">
               <h1 className="text-2xl md:text-4xl font-serif font-medium text-foreground break-words">{style.name}</h1>
               <p className="text-muted-foreground max-w-2xl text-sm md:text-lg font-light leading-relaxed">
                 {style.description}
               </p>
             </div>
             <div className="flex gap-2 md:gap-3 flex-shrink-0">
               <button 
                 onClick={handleDownloadTokens}
                 data-testid="button-download-tokens"
                 title="Download design tokens as JSON"
                 className="h-9 px-2 md:px-4 flex items-center gap-2 border border-border rounded-sm hover:bg-secondary transition-colors text-xs md:text-sm font-medium whitespace-nowrap"
               >
                 <Download size={14} />
                 <span className="hidden sm:inline">Export Tokens</span>
               </button>
               <button 
                 onClick={handleUseStyle}
                 data-testid="button-use-style"
                 title="Generate new images using this style"
                 className="h-9 px-2 md:px-4 flex items-center gap-2 bg-primary text-primary-foreground rounded-sm hover:opacity-90 transition-colors text-xs md:text-sm font-medium whitespace-nowrap"
               >
                 <Wand2 size={14} />
                 <span className="hidden sm:inline">Create with Style</span>
               </button>
             </div>
           </div>
           
           <div className="flex flex-wrap gap-2 md:gap-4 text-[10px] md:text-xs font-mono text-muted-foreground border-b border-border pb-4 md:pb-6">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                <span className="truncate">ID: {style.id}</span>
             </div>
             <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-sm">
                <Layers size={12} className="flex-shrink-0" />
                <span>v1.0.0</span>
             </div>
             <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-sm">
                <ImageIcon size={12} className="flex-shrink-0" />
                <span className="hidden sm:inline">DTCG</span>
             </div>
           </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          
          {/* Left Column: Generated Assets */}
          <div className="col-span-1 lg:col-span-7 space-y-6 md:space-y-8">
            {/* Canonical Previews */}
            <div className="space-y-3 md:space-y-4 animate-in fade-in duration-300">
              <h2 className="text-xs md:text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Canonical Previews
                <InfoTooltip testId="tooltip-canonical-previews">{FEATURE_EXPLANATIONS.canonicalPreviews}</InfoTooltip>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                <div className="col-span-1 sm:col-span-2 aspect-video bg-muted rounded-sm overflow-hidden border border-border relative group">
                  {style.previews.landscape && (
                    <>
                      <img 
                        src={style.previews.landscape} 
                        alt="Landscape preview" 
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!style.previews.landscape) return;
                          try {
                            const link = document.createElement("a");
                            link.href = style.previews.landscape;
                            link.download = `${style.name}-landscape.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } catch (err) {
                            console.error("Failed to download:", err);
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
                        title="Download image"
                      >
                        <Download size={14} />
                      </button>
                    </>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs font-mono">16:9 LANDSCAPE</span>
                  </div>
                </div>
                <div className="aspect-[3/4] bg-muted rounded-sm overflow-hidden border border-border relative group">
                  {style.previews.portrait && (
                    <>
                      <img 
                        src={style.previews.portrait} 
                        alt="Portrait preview" 
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!style.previews.portrait) return;
                          try {
                            const link = document.createElement("a");
                            link.href = style.previews.portrait;
                            link.download = `${style.name}-portrait.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } catch (err) {
                            console.error("Failed to download:", err);
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
                        title="Download image"
                      >
                        <Download size={14} />
                      </button>
                    </>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs font-mono">3:4 PORTRAIT</span>
                  </div>
                </div>
                <div className="aspect-square bg-muted rounded-sm overflow-hidden border border-border relative group">
                  {style.previews.stillLife && (
                    <>
                      <img 
                        src={style.previews.stillLife} 
                        alt="Still life preview" 
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!style.previews.stillLife) return;
                          try {
                            const link = document.createElement("a");
                            link.href = style.previews.stillLife;
                            link.download = `${style.name}-still-life.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } catch (err) {
                            console.error("Failed to download:", err);
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
                        title="Download image"
                      >
                        <Download size={14} />
                      </button>
                    </>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs font-mono">1:1 STILL LIFE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reference Images */}
            {style.referenceImages && style.referenceImages.length > 0 && (
              <div className="space-y-3 md:space-y-4">
                <h2 className="text-xs md:text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  Reference Sources
                  <InfoTooltip testId="tooltip-reference-sources">{FEATURE_EXPLANATIONS.referenceImage}</InfoTooltip>
                </h2>
                <div className="flex gap-2 flex-wrap">
                  {style.referenceImages.map((img, i) => (
                    <div key={i} className="w-16 h-16 md:w-20 md:h-20 rounded-sm overflow-hidden border border-border">
                      <img src={img} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Generated Assets */}
            <AiMoodBoard
              styleId={style.id}
              styleName={style.name}
              moodBoard={style.moodBoard}
              uiConcepts={style.uiConcepts}
            />
          </div>

          {/* Right Column: Technical Data */}
          <div className="col-span-1 lg:col-span-5 space-y-4 md:space-y-6">
            {/* Tab Switcher */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Technical Data</span>
                <InfoTooltip side="right" testId="tooltip-technical-data">
                  {activeTab === 'tokens' ? FEATURE_EXPLANATIONS.designTokens : 
                   activeTab === 'explorer' ? 'Analyze the reference image using computer vision to extract design tokens like colors, spacing, and border radius.' :
                   FEATURE_EXPLANATIONS.promptScaffolding}
                </InfoTooltip>
              </div>
              <div className="flex gap-1 p-1 bg-muted rounded-sm">
                <button 
                  onClick={() => setActiveTab('tokens')}
                  data-testid="tab-design-tokens"
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-sm transition-colors",
                    activeTab === 'tokens' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  TOKENS
                </button>
                <button 
                  onClick={() => setActiveTab('explorer')}
                  data-testid="tab-token-explorer"
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-sm transition-colors flex items-center justify-center gap-1",
                    activeTab === 'explorer' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Eye size={12} />
                  EXPLORER
                </button>
                <button 
                  onClick={() => setActiveTab('scaffolding')}
                  data-testid="tab-prompt-scaffolding"
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-sm transition-colors",
                    activeTab === 'scaffolding' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  PROMPTS
                </button>
              </div>
            </div>

            {activeTab === 'tokens' && (
              <div className="bg-card border border-border rounded-md p-3 md:p-4 animate-in fade-in duration-300">
                <TokenViewer tokens={style.tokens} />
              </div>
            )}

            {activeTab === 'explorer' && (
              <div className="bg-card border border-border rounded-md p-3 md:p-4 animate-in fade-in duration-300">
                <CVTokenExplorer 
                  referenceImage={style.referenceImages?.[0]} 
                  styleName={style.name}
                />
              </div>
            )}

            {activeTab === 'scaffolding' && (
              <div className="bg-card border border-border rounded-md p-3 md:p-4 space-y-4 animate-in fade-in duration-300">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Base Prompt</label>
                  <p className="mt-2 text-sm font-mono bg-muted p-2 md:p-3 rounded-sm break-words">{style.promptScaffolding.base}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style Modifiers</label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {style.promptScaffolding.modifiers.map((mod, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-sm font-mono">{mod}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Negative Prompt</label>
                  <p className="mt-2 text-sm font-mono bg-destructive/10 text-destructive p-2 md:p-3 rounded-sm break-words">{style.promptScaffolding.negative}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
