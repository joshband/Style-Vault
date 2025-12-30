import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { StyleHeroComponent } from "./components/StyleHero";
import type { StyleHero, StyleAssetRefs } from "./types";

const ImageSection = lazy(() => import("./components/ImageSection"));
const CollapsibleSections = lazy(() => import("./components/CollapsibleSections"));

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="aspect-square bg-muted rounded-lg" />
        <div className="aspect-square bg-muted rounded-lg" />
      </div>
    </div>
  );
}

export default function StyleInspectPage() {
  const [, params] = useRoute("/style/:id");
  const id = params?.id;
  
  const [hero, setHero] = useState<StyleHero | null>(null);
  const [assetRefs, setAssetRefs] = useState<StyleAssetRefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const mountedRef = useRef(true);
  const refetchTimersRef = useRef<number[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      refetchTimersRef.current.forEach(clearTimeout);
      refetchTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    setHero(null);
    setShowImages(false);
    setShowSections(false);
    
    fetch(`/api/styles/${id}/hero`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!mountedRef.current) return;
        setHero(data);
        setLoading(false);
        
        setTimeout(() => mountedRef.current && setShowImages(true), 300);
        setTimeout(() => mountedRef.current && setShowSections(true), 600);
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id || !showImages) return;
    
    fetch(`/api/styles/${id}/asset-refs`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (mountedRef.current) setAssetRefs(data);
      })
      .catch(() => {});
  }, [id, showImages]);

  const handleRegenerate = useCallback(async () => {
    if (!id || regenerating) return;
    
    setRegenerating(true);
    try {
      const res = await fetch(`/api/styles/${id}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start regeneration');
      }
      
      toast.success('Regeneration started! Previews will update in about a minute.');
      
      const refetchAssets = () => {
        if (!mountedRef.current) return;
        fetch(`/api/styles/${id}/asset-refs`, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (mountedRef.current) setAssetRefs(data);
          })
          .catch(() => {});
      };
      
      refetchTimersRef.current.forEach(clearTimeout);
      refetchTimersRef.current = [
        window.setTimeout(refetchAssets, 5000),
        window.setTimeout(refetchAssets, 15000),
        window.setTimeout(refetchAssets, 30000),
      ];
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  }, [id, regenerating]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  if (!hero) {
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
      <div className="max-w-4xl mx-auto space-y-6">
        <StyleHeroComponent 
          hero={hero} 
          onRegenerate={handleRegenerate}
          isRegenerating={regenerating}
        />

        {showImages && (
          <Suspense fallback={<SectionSkeleton />}>
            <ImageSection 
              styleId={id!}
              assetRefs={assetRefs}
            />
          </Suspense>
        )}

        {showSections && (
          <Suspense fallback={
            <div className="border border-border rounded-lg p-4 animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3" />
            </div>
          }>
            <CollapsibleSections 
              styleId={id!}
              hero={hero}
              assetRefs={assetRefs}
            />
          </Suspense>
        )}
      </div>
    </Layout>
  );
}
