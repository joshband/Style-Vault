import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, RefreshCw, Image as ImageIcon, Layout, Palette } from "lucide-react";
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

async function generateMoodBoard(styleId: string) {
  const response = await fetch(`/api/styles/${styleId}/generate-mood-board`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error("Failed to generate mood board");
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

  const mutation = useMutation({
    mutationFn: () => generateMoodBoard(styleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles", styleId] });
    },
  });

  const hasCollage = moodBoard?.status === "complete" && moodBoard.collage;
  const hasAudioPlugin = uiConcepts?.status === "complete" && uiConcepts.audioPlugin;
  const hasDashboard = uiConcepts?.status === "complete" && uiConcepts.dashboard;
  const hasAnyAssets = hasCollage || hasAudioPlugin || hasDashboard;
  const isGenerating = mutation.isPending || moodBoard?.status === "generating" || uiConcepts?.status === "generating";

  if (!hasAnyAssets && !isGenerating) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-empty">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h3 className="text-lg font-semibold">Generate AI Mood Board</h3>
          <p className="text-sm text-muted-foreground">
            Create a visual mood board collage and UI concept mockups using AI.
            This will generate images showing how "{styleName}" can be applied to interfaces.
          </p>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={isGenerating}
          size="lg"
          data-testid="button-generate-mood-board"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Mood Board
        </Button>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            Generation failed. Please try again.
          </p>
        )}
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-generating">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Generating Mood Board...</h3>
          <p className="text-sm text-muted-foreground">
            Creating visual collage and UI mockups. This may take a minute.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "collage" as const, label: "Mood Board", icon: Palette, available: hasCollage },
    { id: "audio" as const, label: "Audio Plugin", icon: Layout, available: hasAudioPlugin },
    { id: "dashboard" as const, label: "Dashboard", icon: ImageIcon, available: hasDashboard },
  ].filter((tab) => tab.available);

  const getCurrentImage = () => {
    switch (activeTab) {
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
                activeTab === tab.id
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
          disabled={isGenerating}
          data-testid="button-regenerate-mood-board"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isGenerating && "animate-spin")} />
          Regenerate
        </Button>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30" data-testid="mood-board-image-container">
        {currentImage ? (
          <img
            src={currentImage}
            alt={`${styleName} ${activeTab}`}
            className="w-full h-auto"
            data-testid={`img-${activeTab}`}
          />
        ) : (
          <div className="aspect-[3/4] flex items-center justify-center">
            <p className="text-muted-foreground">No image available</p>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        {activeTab === "collage" && "AI-generated mood board collage showing color palette, textures, typography, and visual references"}
        {activeTab === "audio" && "UI concept: Audio plugin interface styled with extracted design tokens"}
        {activeTab === "dashboard" && "UI concept: Dashboard interface styled with extracted design tokens"}
      </div>
    </div>
  );
}

export default AiMoodBoard;
