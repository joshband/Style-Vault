import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Loader2, ArrowLeft, User, Calendar, Image } from "lucide-react";
import { StyleCard } from "@/components/style-card";
import { Layout } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

interface CreatorInfo {
  id: string;
  name: string;
  profileImageUrl: string | null;
  createdAt: string | null;
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
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const publicStyles = styles?.filter(s => s.isPublic !== false) || [];
  const joinDate = creator?.createdAt ? format(new Date(creator.createdAt), "MMMM yyyy") : null;
  const initials = creator?.name
    ? creator.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-semibold">Creator Profile</h1>
        </div>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="w-24 h-24" data-testid="avatar-creator">
              {creator?.profileImageUrl ? (
                <AvatarImage src={creator.profileImageUrl} alt={creator.name} />
              ) : null}
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h2 className="text-3xl font-bold" data-testid="text-creator-name">
                {creator?.name || "Unknown Creator"}
              </h2>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                {joinDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {joinDate}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Image className="w-4 h-4" />
                  <span>{publicStyles.length} public {publicStyles.length === 1 ? 'style' : 'styles'}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="text-xl font-semibold mb-4">Public Styles</h3>
          {publicStyles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicStyles.map((style) => (
                <StyleCard key={style.id} style={style} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>This creator hasn't published any public styles yet.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
