import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { TokenViewer } from "@/components/token-viewer";
import { ArrowLeft, Loader2, Eye, Palette, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

interface Style {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  referenceImages: string[];
  previews: {
    portrait: string;
    landscape: string;
    stillLife: string;
  };
  tokens: Record<string, any>;
  moodBoard?: {
    status: string;
    collage?: string;
    history: Array<{ collage: string; generatedAt: string }>;
  };
}

export default function SharedStyle() {
  const [, params] = useRoute("/shared/:code");
  const code = params?.code;
  const [style, setStyle] = useState<Style | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) {
      fetch(`/api/shared/${code}`)
        .then(res => {
          if (!res.ok) throw new Error("Style not found");
          return res.json();
        })
        .then(setStyle)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [code]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  if (error || !style) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
          <h1 className="text-2xl font-serif text-muted-foreground">Style Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This share link may have expired or the style no longer exists.
          </p>
          <Link href="/" className="mt-4 text-sm underline">
            Browse Style Vault
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full bg-muted/50 border border-border text-muted-foreground">
            Shared Style
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground" data-testid="text-style-name">
              {style.name}
            </h1>
            <p className="text-muted-foreground text-lg font-light leading-relaxed max-w-2xl">
              {style.description}
            </p>
          </div>
          
          {style.referenceImages && style.referenceImages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Source Reference
              </h3>
              <div className="max-w-md">
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img 
                    src={style.referenceImages[0]} 
                    alt="Source reference" 
                    className="w-full h-auto object-contain"
                    loading="lazy"
                    data-testid="img-shared-reference"
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
            <time dateTime={style.createdAt}>
              Created {new Date(style.createdAt).toLocaleDateString(undefined, { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </time>
            <Link 
              href={`/style/${style.id}`}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              data-testid="link-view-full-style"
            >
              <ExternalLink size={12} />
              View full style
            </Link>
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Eye size={20} />
            </div>
            <div>
              <h2 className="text-lg font-serif font-medium text-foreground">Visual Identity</h2>
              <p className="text-sm text-muted-foreground mt-0.5">How this style looks across different compositions</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Canonical Previews
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2 aspect-video bg-muted rounded-lg overflow-hidden border border-border relative">
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

          {style.moodBoard?.collage && (
            <div className="space-y-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mood Board
              </h3>
              <div className="rounded-lg overflow-hidden border border-border">
                <img 
                  src={style.moodBoard.collage} 
                  alt="Style mood board" 
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="text-lg font-serif font-medium text-foreground">Design Tokens</h2>
              <p className="text-sm text-muted-foreground mt-0.5">W3C DTCG 2025.10 compliant design tokens</p>
            </div>
          </div>
          
          <TokenViewer tokens={style.tokens} />
        </section>

        <div className="border-t border-border pt-8 pb-4 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Want to explore more styles or create your own?
          </p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
            data-testid="link-browse-vault"
          >
            <ArrowLeft size={14} />
            Browse Style Vault
          </Link>
        </div>
      </div>
    </Layout>
  );
}
