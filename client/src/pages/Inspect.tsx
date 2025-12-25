import { useRoute } from "wouter";
import { fetchStyleById, type Style } from "@/lib/store";
import { Layout } from "@/components/layout";
import { TokenViewer } from "@/components/token-viewer";
import { CVTokenExplorer } from "@/components/cv-token-explorer";
import { ArrowLeft, Download, Loader2, ChevronDown, ChevronUp, Eye, Palette, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, type ReactNode } from "react";
import { AiMoodBoard } from "@/components/ai-mood-board";

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

export default function Inspect() {
  const [, params] = useRoute("/style/:id");
  const id = params?.id;
  const [style, setStyle] = useState<Style | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokensExpanded, setTokensExpanded] = useState(false);
  const [explorerExpanded, setExplorerExpanded] = useState(false);

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
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono w-fit">
            <ArrowLeft size={12} /> Back to Vault
          </Link>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground">{style.name}</h1>
            <p className="text-muted-foreground text-lg font-light leading-relaxed max-w-2xl">
              {style.description}
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
            <time dateTime={style.createdAt}>
              Created {new Date(style.createdAt).toLocaleDateString(undefined, { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </time>
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
              <div className="col-span-1 sm:col-span-2 aspect-video bg-muted rounded-lg overflow-hidden border border-border relative group">
                {style.previews.landscape ? (
                  <>
                    <img 
                      src={style.previews.landscape} 
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
                {style.previews.portrait ? (
                  <>
                    <img 
                      src={style.previews.portrait} 
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
                {style.previews.stillLife ? (
                  <>
                    <img 
                      src={style.previews.stillLife} 
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
            </div>
          </div>

          {/* Reference Images */}
          {style.referenceImages && style.referenceImages.length > 0 && (
            <div className="space-y-4 pt-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Reference Sources
              </h3>
              <div className="flex gap-2 flex-wrap">
                {style.referenceImages.map((img, i) => (
                  <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={img} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mood Board & UI Concepts */}
          <div className="pt-6">
            <AiMoodBoard
              styleId={style.id}
              styleName={style.name}
              moodBoard={style.moodBoard}
              uiConcepts={style.uiConcepts}
            />
          </div>
        </section>

        {/* Section 2: Design Tokens */}
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
                  <TokenViewer tokens={style.tokens} />
                </div>
              )}
            </div>

            {/* Collapsible CV Explorer */}
            {style.referenceImages && style.referenceImages.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExplorerExpanded(!explorerExpanded)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  data-testid="toggle-cv-explorer"
                >
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">CV Token Explorer</span>
                  </div>
                  {explorerExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {explorerExpanded && (
                  <div className="p-4 pt-0 border-t border-border animate-in fade-in duration-200">
                    <CVTokenExplorer 
                      referenceImage={style.referenceImages?.[0]} 
                      styleName={style.name}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Section 3: Prompt Scaffolding */}
        <section className="space-y-0 pb-8">
          <SectionHeader
            icon={<MessageSquare size={20} />}
            title="Prompt Scaffolding"
            description="How to describe this style to an AI image generator"
          />

          <div className="space-y-6">
            {/* Base Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Base Prompt
              </label>
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm font-mono leading-relaxed text-foreground whitespace-pre-wrap">
                  {style.promptScaffolding.base}
                </p>
              </div>
            </div>

            {/* Style Modifiers */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Style Modifiers
              </label>
              <div className="flex flex-wrap gap-2">
                {style.promptScaffolding.modifiers.map((mod, i) => (
                  <span 
                    key={i} 
                    className="text-sm px-3 py-1.5 bg-primary/10 text-primary rounded-full font-mono"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </div>

            {/* Negative Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Negative Prompt
              </label>
              <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <p className="text-sm font-mono leading-relaxed text-destructive whitespace-pre-wrap">
                  {style.promptScaffolding.negative}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
