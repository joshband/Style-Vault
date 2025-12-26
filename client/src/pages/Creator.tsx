import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Loader2, ArrowLeft, User, Calendar, Image, Pencil, Check, X, Lock } from "lucide-react";
import { StyleCard } from "@/components/style-card";
import { Layout } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

interface CreatorInfo {
  id: string;
  name: string;
  displayName: string | null;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const isOwnProfile = user?.id === creatorId;

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

  const updateProfileMutation = useMutation({
    mutationFn: async (displayName: string) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creators", creatorId] });
      setIsEditing(false);
      toast({ title: "Profile updated", description: "Your display name has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    },
  });

  const startEditing = () => {
    setEditName(creator?.displayName || creator?.name || "");
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editName.trim()) {
      updateProfileMutation.mutate(editName.trim());
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditName("");
  };

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
  const privateStyles = isOwnProfile ? (styles?.filter(s => s.isPublic === false) || []) : [];
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
          <h1 className="text-2xl font-semibold">
            {isOwnProfile ? "My Profile" : "Creator Profile"}
          </h1>
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
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Display name"
                    className="max-w-xs text-lg"
                    data-testid="input-display-name"
                  />
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={saveEdit}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-name"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={cancelEdit}
                    data-testid="button-cancel-edit"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-3xl font-bold" data-testid="text-creator-name">
                    {creator?.name || "Unknown Creator"}
                  </h2>
                  {isOwnProfile && (
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={startEditing}
                      data-testid="button-edit-name"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
              
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
                {isOwnProfile && privateStyles.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    <span>{privateStyles.length} private {privateStyles.length === 1 ? 'style' : 'styles'}</span>
                  </div>
                )}
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
              <p>{isOwnProfile ? "You haven't published any public styles yet." : "This creator hasn't published any public styles yet."}</p>
            </div>
          )}
        </div>

        {isOwnProfile && privateStyles.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Private Styles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {privateStyles.map((style) => (
                <StyleCard key={style.id} style={style} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
