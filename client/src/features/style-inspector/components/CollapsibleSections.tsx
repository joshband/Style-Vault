import { useState, lazy, Suspense, useCallback } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { isFeatureEnabled } from "@shared/featureFlags";
import type { StyleHero, StyleAssetRefs, StyleTokens, StyleMetadata, StyleImageIds } from "../types";

const TokenViewer = lazy(() => import("@/components/token-viewer").then(m => ({ default: m.TokenViewer })));
const ColorDetails = lazy(() => import("@/components/color-details").then(m => ({ default: m.ColorDetails })));

interface CollapsibleSectionsProps {
  styleId: string;
  hero: StyleHero;
  assetRefs: StyleAssetRefs | null;
}

function getImageUrl(imageId: string | undefined, size: 'thumb' | 'medium' | 'full' = 'medium'): string | null {
  if (!imageId) return null;
  return `/api/images/${imageId}?size=${size}`;
}

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-4">
      <Loader2 className="animate-spin text-muted-foreground" size={20} />
    </div>
  );
}

function AccordionSection({ 
  title, 
  testId, 
  children,
  isLoading = false,
  defaultOpen = false,
}: { 
  title: string; 
  testId: string; 
  children: React.ReactNode;
  isLoading?: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0" data-testid={testId}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 cursor-pointer hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          <ChevronDown 
            size={16} 
            className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>
      {isOpen && (
        <div className="p-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

function TokensSection({ styleId, enabled }: { styleId: string; enabled: boolean }) {
  const { data, isLoading, isFetching } = useQuery<StyleTokens>({
    queryKey: ['style', styleId, 'tokens'],
    queryFn: async () => {
      const res = await fetch(`/api/styles/${styleId}/tokens`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load tokens');
      return res.json();
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });

  if (!enabled) return null;
  if (isLoading || isFetching) return <LazyFallback />;
  if (!data?.tokens) return <p className="text-sm text-muted-foreground">No tokens available</p>;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Color Details</h4>
        <Suspense fallback={<LazyFallback />}>
          <ColorDetails tokens={data.tokens} />
        </Suspense>
      </div>
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">All Tokens</h4>
        <Suspense fallback={<LazyFallback />}>
          <TokenViewer tokens={data.tokens} />
        </Suspense>
      </div>
    </div>
  );
}

function MetadataSection({ styleId, enabled }: { styleId: string; enabled: boolean }) {
  const { data, isLoading, isFetching } = useQuery<StyleMetadata>({
    queryKey: ['style', styleId, 'metadata'],
    queryFn: async () => {
      const res = await fetch(`/api/styles/${styleId}/metadata`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load metadata');
      return res.json();
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });

  if (!enabled) return null;
  if (isLoading || isFetching) return <LazyFallback />;
  if (!data) return <p className="text-sm text-muted-foreground">No metadata available</p>;

  return (
    <div className="space-y-3">
      {data.metadataTags?.keywords && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Keywords</h4>
          <div className="flex flex-wrap gap-1">
            {(data.metadataTags.keywords as string[]).slice(0, 10).map((keyword, i) => (
              <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">{keyword}</span>
            ))}
          </div>
        </div>
      )}
      {data.metadataTags?.mood && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Mood</h4>
          <div className="flex flex-wrap gap-1">
            {(data.metadataTags.mood as string[]).map((mood, i) => (
              <span key={i} className="px-2 py-0.5 bg-muted text-xs rounded">{mood}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StyleGuideSection({ styleId, enabled }: { styleId: string; enabled: boolean }) {
  const { data, isLoading, isFetching } = useQuery<StyleMetadata>({
    queryKey: ['style', styleId, 'metadata'],
    queryFn: async () => {
      const res = await fetch(`/api/styles/${styleId}/metadata`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load metadata');
      return res.json();
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });

  if (!enabled) return null;
  if (isLoading || isFetching) return <LazyFallback />;
  if (!data?.promptScaffolding) return <p className="text-sm text-muted-foreground">No style guide available</p>;

  return (
    <div className="space-y-4">
      {data.promptScaffolding.base && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Description</h4>
          <p className="text-sm text-foreground">{data.promptScaffolding.base}</p>
        </div>
      )}
      {data.promptScaffolding.modifiers?.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Characteristics</h4>
          <div className="flex flex-wrap gap-1">
            {data.promptScaffolding.modifiers.map((mod, i) => (
              <span key={i} className="px-2 py-0.5 bg-muted text-xs rounded">{mod}</span>
            ))}
          </div>
        </div>
      )}
      {data.promptScaffolding.negative && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Avoid</h4>
          <p className="text-sm text-muted-foreground">{data.promptScaffolding.negative}</p>
        </div>
      )}
      {data.spec?.usageGuidelines && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Usage Notes</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">{data.spec.usageGuidelines}</p>
        </div>
      )}
    </div>
  );
}

function PreviewsSection({ styleId, styleName, enabled }: { styleId: string; styleName: string; enabled: boolean }) {
  const { data: imageIds, isLoading, isFetching } = useQuery<StyleImageIds>({
    queryKey: ['style', styleId, 'image-ids'],
    queryFn: async () => {
      const res = await fetch(`/api/styles/${styleId}/image-ids`, { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled) return null;
  if (isLoading || isFetching) return <LazyFallback />;

  const previewTypes = ['landscape', 'portrait', 'stillLife'] as const;

  return (
    <div className="grid grid-cols-3 gap-2">
      {previewTypes.map((type) => {
        const key = type === 'stillLife' ? 'preview_still_life' : `preview_${type}`;
        const imgSrc = getImageUrl((imageIds as any)?.[key], 'medium');
        const fullSrc = getImageUrl((imageIds as any)?.[key], 'full');
        return (
          <div key={type} className="aspect-square bg-muted rounded-lg overflow-hidden border border-border relative group/preview">
            {imgSrc ? (
              <>
                <img src={imgSrc} alt={type} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <button
                  onClick={() => {
                    if (!fullSrc) return;
                    const link = document.createElement("a");
                    link.href = fullSrc;
                    link.download = `${styleName}-${type}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="absolute top-1 right-1 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover/preview:opacity-100 transition-opacity hover:bg-black/70"
                  title={`Download ${type}`}
                >
                  <Download size={12} />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs capitalize">
                {type}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OnDemandAccordion({ 
  title, 
  testId, 
  children,
}: { 
  title: string; 
  testId: string; 
  children: (isOpen: boolean) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleToggle = useCallback(() => {
    if (!isOpen && !hasOpened) {
      setHasOpened(true);
    }
    setIsOpen(!isOpen);
  }, [isOpen, hasOpened]);

  return (
    <div className="border-b border-border last:border-b-0" data-testid={testId}>
      <button 
        onClick={handleToggle}
        className="flex items-center justify-between w-full p-4 cursor-pointer hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <ChevronDown 
          size={16} 
          className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      {isOpen && (
        <div className="p-4 pt-0">
          {children(hasOpened)}
        </div>
      )}
    </div>
  );
}

export default function CollapsibleSections({ styleId, hero, assetRefs }: CollapsibleSectionsProps) {
  return (
    <div className="border border-border rounded-lg divide-y divide-border">
      {isFeatureEnabled('inspect.tokens') && (
        <OnDemandAccordion title="Design DNA" testId="section-design-dna">
          {(enabled) => <TokensSection styleId={styleId} enabled={enabled} />}
        </OnDemandAccordion>
      )}

      {isFeatureEnabled('inspect.previews') && (
        <OnDemandAccordion title="Canonical Previews" testId="section-canonical-previews">
          {(enabled) => <PreviewsSection styleId={styleId} styleName={hero.name} enabled={enabled} />}
        </OnDemandAccordion>
      )}

      <OnDemandAccordion title="Style Guide" testId="section-style-guide">
        {(enabled) => <StyleGuideSection styleId={styleId} enabled={enabled} />}
      </OnDemandAccordion>

      <OnDemandAccordion title="AI Insights" testId="section-ai-insights">
        {(enabled) => <MetadataSection styleId={styleId} enabled={enabled} />}
      </OnDemandAccordion>
    </div>
  );
}
