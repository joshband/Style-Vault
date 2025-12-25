import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { StyleCard } from "@/components/style-card";

interface CreatorInfo {
  id: string;
  name: string;
}

interface StyleSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  metadataTags: any;
  moodBoardStatus: string;
  uiConceptsStatus: string;
  thumbnailPreview: string | null;
  imageIds?: Record<string, string>;
  creatorId?: string | null;
  creatorName?: string | null;
  isPublic?: boolean;
}

export default function CreatorPage() {
  const [, params] = useRoute("/creator/:creatorId");
  const creatorId = params?.creatorId;

  const { data: creator, isLoading: creatorLoading } = useQuery<CreatorInfo>({
    queryKey: ["/api/creators", creatorId],
    queryFn: async () => {
      const res = await fetch(`/api/creators/${creatorId}`);
      if (!res.ok) throw new Error("Failed to fetch creator");
      return res.json();
    },
    enabled: !!creatorId,
  });

  const { data: styles, isLoading: stylesLoading } = useQuery<StyleSummary[]>({
    queryKey: ["/api/creators", creatorId, "styles"],
    queryFn: async () => {
      const res = await fetch(`/api/creators/${creatorId}/styles`);
      if (!res.ok) throw new Error("Failed to fetch styles");
      return res.json();
    },
    enabled: !!creatorId,
  });

  if (creatorLoading || stylesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <User size={24} className="text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-creator-name">
              {creator?.name || "Unknown Creator"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {styles?.length || 0} {(styles?.length || 0) === 1 ? 'style' : 'styles'}
            </p>
          </div>
        </div>
      </div>

      {styles && styles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {styles.map((style) => (
            <StyleCard key={style.id} style={style} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>No styles found from this creator.</p>
        </div>
      )}
    </div>
  );
}
