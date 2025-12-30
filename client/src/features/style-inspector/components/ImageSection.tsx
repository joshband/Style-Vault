import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { StyleAssetRefs, StyleImageIds } from "../types";

interface ImageSectionProps {
  styleId: string;
  assetRefs: StyleAssetRefs | null;
}

function getImageUrl(imageId: string | undefined, size: 'thumb' | 'medium' | 'full' = 'medium'): string | null {
  if (!imageId) return null;
  return `/api/images/${imageId}?size=${size}`;
}

export default function ImageSection({ styleId, assetRefs }: ImageSectionProps) {
  const { data: imageIds } = useQuery<StyleImageIds>({
    queryKey: ['style', styleId, 'image-ids'],
    queryFn: async () => {
      const res = await fetch(`/api/styles/${styleId}/image-ids`, { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const referenceId = imageIds?.reference;
  const uiConceptId = imageIds?.ui_audio_plugin || 
                      imageIds?.ui_software_app || 
                      imageIds?.ui_dashboard;
  
  const refSrc = getImageUrl(referenceId, 'medium');
  const uiSrc = getImageUrl(uiConceptId, 'medium');

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-neutral-100 dark:bg-neutral-900">
        {refSrc ? (
          <>
            <div className="absolute inset-0 p-3 flex items-center justify-center">
              <img 
                src={refSrc} 
                alt="Source reference"
                className="max-w-full max-h-full object-contain rounded"
                loading="lazy"
                decoding="async"
                data-testid="img-source-reference"
              />
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[10px] font-mono rounded">
              Source
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No reference image
          </div>
        )}
      </div>

      <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-neutral-100 dark:bg-neutral-900">
        {uiSrc ? (
          <>
            <div className="absolute inset-0 p-3 flex items-center justify-center">
              <img 
                src={uiSrc}
                alt="Applied UI"
                className="max-w-full max-h-full object-contain rounded"
                loading="lazy"
                decoding="async"
                data-testid="img-applied-ui"
              />
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-[10px] font-mono rounded">
              Applied
            </div>
          </>
        ) : assetRefs?.statuses?.uiConcepts === "generating" ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <span>Not Generated</span>
            <span className="text-[10px] opacity-70">UI preview coming soon</span>
          </div>
        )}
      </div>
    </section>
  );
}
