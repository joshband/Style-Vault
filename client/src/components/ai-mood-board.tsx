import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
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

  const isGenerating = moodBoard?.status === "generating" || uiConcepts?.status === "generating";
  const isPending = moodBoard?.status === "pending" || uiConcepts?.status === "pending";

  useQuery({
    queryKey: ["/api/styles", styleId, "poll"],
    queryFn: async () => {
      const res = await fetch(`/api/styles/${styleId}`);
      return res.json();
    },
    refetchInterval: isGenerating || isPending ? 3000 : false,
    enabled: isGenerating || isPending,
  });

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
            Creating mood board and UI mockups. This may take a minute.
          </p>
        </div>
      </div>
    );
  }

  if (moodBoard?.status === "failed" && uiConcepts?.status === "failed" && !hasAnyAssets) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-failed">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Generation Failed</h3>
          <p className="text-sm text-muted-foreground">
            Unable to generate assets. You can try regenerating.
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

  if (!hasAnyAssets) {
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

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Generated Assets</h2>
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

      {hasCollage && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mood Board</h3>
          <div className="rounded-lg overflow-hidden border border-border" data-testid="img-container-collage">
            <img
              src={moodBoard?.collage}
              alt={`${styleName} mood board`}
              className="w-full h-auto"
              data-testid="img-collage"
            />
          </div>
        </div>
      )}

      {(hasAudioPlugin || hasDashboard) && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">UI Concepts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasAudioPlugin && (
              <div className="rounded-lg overflow-hidden border border-border" data-testid="img-container-audio">
                <img
                  src={uiConcepts?.audioPlugin}
                  alt={`${styleName} audio plugin`}
                  className="w-full h-auto"
                  data-testid="img-audio"
                />
                <div className="p-2 bg-muted/50 text-center">
                  <span className="text-xs text-muted-foreground">Audio Plugin</span>
                </div>
              </div>
            )}
            {hasDashboard && (
              <div className="rounded-lg overflow-hidden border border-border" data-testid="img-container-dashboard">
                <img
                  src={uiConcepts?.dashboard}
                  alt={`${styleName} dashboard`}
                  className="w-full h-auto"
                  data-testid="img-dashboard"
                />
                <div className="p-2 bg-muted/50 text-center">
                  <span className="text-xs text-muted-foreground">Dashboard</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AiMoodBoard;
