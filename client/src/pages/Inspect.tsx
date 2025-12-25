import { useRoute } from "wouter";
import { type StyleSpec } from "@/lib/store";
import { Layout } from "@/components/layout";
import { TokenViewer } from "@/components/token-viewer";
import { ColorPaletteSwatches } from "@/components/color-palette-swatches";
import { StyleSpecEditor } from "@/components/style-spec-editor";
import { ArrowLeft, Download, Loader2, ChevronDown, ChevronUp, Eye, Palette, MessageSquare, Share2, Check, Copy, Droplets, FileEdit } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AiMoodBoard } from "@/components/ai-mood-board";
import { ActiveJobsIndicator } from "@/components/active-jobs-indicator";

interface StyleSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  tokens: any;
  referenceImages: string[];
  metadataTags: any;
  promptScaffolding: any;
  shareCode: string | null;
  moodBoardStatus: string;
  uiConceptsStatus: string;
  styleSpec: StyleSpec | null;
  updatedAt: string | null;
}

interface StyleAssets {
  previews: {
    landscape?: string;
    portrait?: string;
    stillLife?: string;
  };
  moodBoard: any;
  uiConcepts: any;
}

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function SectionHeader({ icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-serif font-medium text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function PreviewSkeleton({ aspect }: { aspect: string }) {
  return (
    <div className={`${aspect} bg-muted rounded-lg overflow-hidden border border-border animate-pulse`}>
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/30" />
      </div>
    </div>
  );
}

export default function Inspect() {
  const [, params] = useRoute("/style/:id");
  const id = params?.id;
  const [summary, setSummary] = useState<StyleSummary | null>(null);
  const [assets, setAssets] = useState<StyleAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [tokensExpanded, setTokensExpanded] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (!id) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/styles/${id}/share`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setShareCode(data.shareCode);
      }
    } catch (error) {
      console.error("Failed to generate share code:", error);
    } finally {
      setShareLoading(false);
    }
  }, [id]);

  const handleCopyLink = useCallback(() => {
    if (!shareCode) return;
    const shareUrl = `${window.location.origin}/shared/${shareCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareCode]);

  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/styles/${id}/summary`)
      .then(res => res.ok ? res.json() : null)
      .then((data: StyleSummary | null) => {
        setSummary(data);
        if (data?.shareCode) {
          setShareCode(data.shareCode);
        }
      })
      .finally(() => setLoading(false));
    
    fetch(`/api/styles/${id}/assets`)
      .then(res => res.ok ? res.json() : null)
      .then((data: StyleAssets | null) => {
        setAssets(data);
      })
      .finally(() => setAssetsLoading(false));
  }, [id]);

  const refetchAssets = useCallback(() => {
    if (!id) return;
    fetch(`/api/styles/${id}/assets`)
      .then(res => res.ok ? res.json() : null)
      .then((data: StyleAssets | null) => {
        if (data) setAssets(data);
      });
  }, [id]);

  const moodBoardStatus = assets?.moodBoard?.status || summary?.moodBoardStatus;
  const uiConceptsStatus = assets?.uiConcepts?.status || summary?.uiConceptsStatus;
  
  useEffect(() => {
    if (!id) return;
    
    const isGenerating = 
      moodBoardStatus === "generating" || 
      moodBoardStatus === "pending" ||
      uiConceptsStatus === "generating" ||
      uiConceptsStatus === "pending";
    
    if (isGenerating) {
      const interval = setInterval(refetchAssets, 2000);
      return () => clearInterval(interval);
    }
  }, [id, moodBoardStatus, uiConceptsStatus, refetchAssets]);

  const handleDownloadTokens = () => {
    if (!summary) return;
    const tokensJson = JSON.stringify(summary.tokens, null, 2);
    const blob = new Blob([tokensJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${summary.name.toLowerCase().replace(/\s+/g, "-")}-tokens.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSpecUpdate = useCallback((newSpec: StyleSpec) => {
    if (summary) {
      setSummary({ ...summary, styleSpec: newSpec, updatedAt: new Date().toISOString() });
    }
  }, [summary]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  if (!summary) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <h1 className="text-2xl font-serif text-muted-foreground">Style Not Found</h1>
          <Link href="/" className="mt-4 text-sm underline">Return to Explorer</Link>
        </div>
      </Layout>
    );
  }

  const previews = assets?.previews || {};

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono w-fit">
            <ArrowLeft size={12} /> Back to Vault
          </Link>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground">{summary.name}</h1>
            <p className="text-muted-foreground text-lg font-light leading-relaxed max-w-2xl">
              {summary.description}
            </p>
          </div>
          
          {summary.referenceImages && summary.referenceImages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Source Reference
              </h3>
              <div className="max-w-md">
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img 
                    src={summary.referenceImages[0]} 
                    alt="Source reference" 
                    className="w-full h-auto object-contain"
                    loading="lazy"
                    data-testid="img-reference-main"
                  />
                </div>
                {summary.referenceImages.length > 1 && (
                  <div className="flex gap-2 mt-2">
                    {summary.referenceImages.slice(1).map((img, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-border">
                        <img src={img} alt={`Reference ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <time dateTime={summary.createdAt}>
                Created {new Date(summary.createdAt).toLocaleDateString(undefined, { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </time>
              <ActiveJobsIndicator styleId={id} />
            </div>
            
            <div className="flex items-center gap-2">
              {shareCode ? (
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/50 hover:bg-muted transition-colors"
                  data-testid="button-copy-share-link"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-green-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span className="font-mono">{shareCode}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                  data-testid="button-share-style"
                >
                  {shareLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Share2 size={14} />
                  )}
                  <span>Share</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 1: Visual Identity */}
        <section className="space-y-0">
          <SectionHeader
            icon={<Eye size={20} />}
            title="Visual Identity"
            description="How this style looks and feels across different compositions"
          />
          
          {/* Canonical Previews */}
          <div className="space-y-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Canonical Previews
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assetsLoading ? (
                <>
                  <PreviewSkeleton aspect="col-span-1 sm:col-span-2 aspect-video" />
                  <PreviewSkeleton aspect="aspect-[3/4]" />
                  <PreviewSkeleton aspect="aspect-square" />
                </>
              ) : (
                <>
                  <div className="col-span-1 sm:col-span-2 aspect-video bg-muted rounded-lg overflow-hidden border border-border relative group">
                    {previews.landscape ? (
                      <>
                        <img 
                          src={previews.landscape} 
                          alt="Landscape preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs font-mono rounded">
                          Landscape
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No landscape preview
                      </div>
                    )}
                  </div>
                  <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden border border-border relative">
                    {previews.portrait ? (
                      <>
                        <img 
                          src={previews.portrait} 
                          alt="Portrait preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs font-mono rounded">
                          Portrait
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No portrait preview
                      </div>
                    )}
                  </div>
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden border border-border relative">
                    {previews.stillLife ? (
                      <>
                        <img 
                          src={previews.stillLife} 
                          alt="Still life preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs font-mono rounded">
                          Still Life
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No still life preview
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mood Board & UI Concepts */}
          <div className="pt-6">
            {assetsLoading ? (
              <div className="flex items-center justify-center py-12 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading mood board...</span>
                </div>
              </div>
            ) : (
              <AiMoodBoard
                styleId={summary.id}
                styleName={summary.name}
                moodBoard={assets?.moodBoard}
                uiConcepts={assets?.uiConcepts}
              />
            )}
          </div>
        </section>

        {/* Section 2: Color Palette */}
        <section className="space-y-0">
          <SectionHeader
            icon={<Droplets size={20} />}
            title="Color Palette"
            description="Click any swatch to copy the hex code"
          />
          <ColorPaletteSwatches tokens={summary.tokens} />
        </section>

        {/* Section 3: Design Tokens */}
        <section className="space-y-0">
          <SectionHeader
            icon={<Palette size={20} />}
            title="Design Tokens"
            description="The technical DNA behind this visual language"
          />

          <div className="space-y-4">
            {/* Download CTA */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">W3C DTCG Token File</p>
                <p className="text-xs text-muted-foreground mt-0.5">Standards-compliant JSON for design tools</p>
              </div>
              <button 
                onClick={handleDownloadTokens}
                data-testid="button-download-tokens"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Download size={16} />
                Download JSON
              </button>
            </div>

            {/* Collapsible Token Viewer */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setTokensExpanded(!tokensExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                data-testid="toggle-token-viewer"
              >
                <span className="text-sm font-medium text-foreground">View Token Structure</span>
                {tokensExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {tokensExpanded && (
                <div className="p-4 pt-0 border-t border-border animate-in fade-in duration-200">
                  <TokenViewer tokens={summary.tokens} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 4: Prompt Scaffolding */}
        <section className="space-y-0">
          <SectionHeader
            icon={<MessageSquare size={20} />}
            title="Prompt Scaffolding"
            description="Ready-to-use prompts for applying this style in AI tools"
          />
          
          <div className="space-y-6">
            {summary.promptScaffolding && (
              <>
                <div className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Base Prompt</h3>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <p className="text-sm font-mono text-foreground whitespace-pre-wrap">{summary.promptScaffolding.base}</p>
                  </div>
                </div>
                
                {summary.promptScaffolding.modifiers && summary.promptScaffolding.modifiers.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Style Modifiers</h3>
                    <div className="flex flex-wrap gap-2">
                      {summary.promptScaffolding.modifiers.map((mod: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-muted/70 text-xs rounded-md font-mono text-muted-foreground">
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {summary.promptScaffolding.negative && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Negative Prompt</h3>
                    <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                      <p className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">{summary.promptScaffolding.negative}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Section 5: Style Specification */}
        <section className="space-y-0">
          <SectionHeader
            icon={<FileEdit size={20} />}
            title="Style Specification"
            description="Usage guidelines and design notes for this style"
          />
          <StyleSpecEditor 
            styleId={summary.id} 
            styleSpec={summary.styleSpec} 
            updatedAt={summary.updatedAt}
            onUpdate={handleSpecUpdate}
          />
        </section>
      </div>
    </Layout>
  );
}
