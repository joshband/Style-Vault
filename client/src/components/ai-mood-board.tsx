import { useEffect } from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Image as ImageIcon, Layout, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MoodBoardAssets, UiConceptAssets } from "@/lib/store";

interface AiMoodBoardProps {
  styleId: string;
  styleName: string;
  moodBoard?: MoodBoardAssets | null;
  uiConcepts?: UiConceptAssets | null;
  className?: string;
}

async function regenerateMoodBoard(styleId: string) {
  const response = await fetch(`/api/styles/${styleId}/generate-mood-board`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error("Failed to regenerate mood board");
  }
  return response.json();
}

export function AiMoodBoard({
  styleId,
  styleName,
  moodBoard,
  uiConcepts,
  className,
}: AiMoodBoardProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"collage" | "audio" | "dashboard">("collage");

  const isGenerating = moodBoard?.status === "generating" || uiConcepts?.status === "generating";
  const isPending = moodBoard?.status === "pending" || uiConcepts?.status === "pending";

  // Poll for updates when generating
  useQuery({
    queryKey: ["/api/styles", styleId, "poll"],
    queryFn: async () => {
      const res = await fetch(`/api/styles/${styleId}`);
      return res.json();
    },
    refetchInterval: isGenerating || isPending ? 3000 : false,
    enabled: isGenerating || isPending,
  });

  // Invalidate main query when poll detects completion
  useEffect(() => {
    if (!isGenerating && !isPending) {
      queryClient.invalidateQueries({ queryKey: ["/api/styles", styleId] });
    }
  }, [isGenerating, isPending, queryClient, styleId]);

  const mutation = useMutation({
    mutationFn: () => regenerateMoodBoard(styleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles", styleId] });
    },
  });

  const hasCollage = moodBoard?.status === "complete" && moodBoard.collage;
  const hasAudioPlugin = uiConcepts?.status === "complete" && uiConcepts.audioPlugin;
  const hasDashboard = uiConcepts?.status === "complete" && uiConcepts.dashboard;
  const hasAnyAssets = hasCollage || hasAudioPlugin || hasDashboard;

  // Show loading state when generating
  if (isGenerating || isPending) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-generating">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Generating Style Assets...</h3>
          <p className="text-sm text-muted-foreground">
            Creating mood board collage and UI concept mockups. This may take a minute.
          </p>
        </div>
      </div>
    );
  }

  // Show failure state if generation failed
  if (moodBoard?.status === "failed" && uiConcepts?.status === "failed" && !hasAnyAssets) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-failed">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Generation Failed</h3>
          <p className="text-sm text-muted-foreground">
            Unable to generate mood board assets. You can try regenerating.
          </p>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="button-retry-mood-board"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", mutation.isPending && "animate-spin")} />
          Retry Generation
        </Button>
      </div>
    );
  }

  // Show content when assets are available
  const tabs = [
    { id: "collage" as const, label: "AI Mood Board", icon: Palette, available: hasCollage },
    { id: "audio" as const, label: "AI Audio Plugin", icon: Layout, available: hasAudioPlugin },
    { id: "dashboard" as const, label: "AI Dashboard", icon: ImageIcon, available: hasDashboard },
  ].filter((tab) => tab.available);

  // If no tabs available but not generating, default to first available or show empty
  if (tabs.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-empty">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">No Assets Available</h3>
          <p className="text-sm text-muted-foreground">
            Style assets are still being generated or were not created.
          </p>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="button-generate-mood-board"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", mutation.isPending && "animate-spin")} />
          Generate Assets
        </Button>
      </div>
    );
  }

  // Ensure active tab is valid
  const validActiveTab = tabs.find(t => t.id === activeTab) ? activeTab : tabs[0]?.id || "collage";

  const getCurrentImage = () => {
    switch (validActiveTab) {
      case "collage":
        return moodBoard?.collage;
      case "audio":
        return uiConcepts?.audioPlugin;
      case "dashboard":
        return uiConcepts?.dashboard;
      default:
        return null;
    }
  };

  const currentImage = getCurrentImage();

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                validActiveTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="button-regenerate-mood-board"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", mutation.isPending && "animate-spin")} />
          Regenerate
        </Button>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30" data-testid="mood-board-image-container">
        {currentImage ? (
          <img
            src={currentImage}
            alt={`${styleName} ${validActiveTab}`}
            className="w-full h-auto"
            data-testid={`img-${validActiveTab}`}
          />
        ) : (
          <div className="aspect-[3/4] flex items-center justify-center">
            <p className="text-muted-foreground">No image available</p>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        {validActiveTab === "collage" && "AI-generated mood board collage showing color palette, textures, typography, and visual references"}
        {validActiveTab === "audio" && "AI-generated audio plugin interface styled with extracted design tokens"}
        {validActiveTab === "dashboard" && "AI-generated dashboard interface styled with extracted design tokens"}
      </div>
    </div>
  );
}

export default AiMoodBoard;
