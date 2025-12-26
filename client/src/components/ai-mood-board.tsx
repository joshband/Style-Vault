import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MoodBoardAssets, UiConceptAssets, MoodBoardEntry, UiConceptEntry } from "@/lib/store";
import { InfoTooltip, FEATURE_EXPLANATIONS } from "@/components/info-tooltip";

function downloadImage(dataUrl: string, filename: string) {
  if (!dataUrl) return;
  
  try {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Failed to download image:", err);
  }
}

function DownloadButton({ src, filename }: { src: string; filename: string }) {
  if (!src) return null;
  
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadImage(src, filename);
      }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
      title="Download image"
      data-testid={`button-download-${filename.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <Download size={14} />
    </button>
  );
}

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

  // Show images immediately when available, even if still generating
  const hasCollage = !!moodBoard?.collage;
  const hasSoftwareApp = !!uiConcepts?.softwareApp;
  const hasAudioPlugin = !!uiConcepts?.audioPlugin;
  const hasDashboard = !!uiConcepts?.dashboard;
  const hasAnyAssets = hasCollage || hasSoftwareApp || hasAudioPlugin || hasDashboard;
  
  // Track what's still loading
  const collageLoading = (isGenerating || isPending) && !hasCollage;
  const softwareAppLoading = (isGenerating || isPending) && !hasSoftwareApp;
  const audioPluginLoading = (isGenerating || isPending) && !hasAudioPlugin;
  const dashboardLoading = (isGenerating || isPending) && !hasDashboard;

  if (moodBoard?.status === "failed" && uiConcepts?.status === "failed" && !hasAnyAssets) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-failed">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Exploration Failed</h3>
          <p className="text-sm text-muted-foreground">
            Couldn't create explorations this time. Try again?
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

  // Only show empty state if not generating and no assets
  if (!hasAnyAssets && !isGenerating && !isPending) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-12 space-y-6", className)} data-testid="mood-board-empty">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">No Explorations Yet</h3>
          <p className="text-sm text-muted-foreground">
            Create some visual expressions of this style.
          </p>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="button-generate-mood-board"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", mutation.isPending && "animate-spin")} />
          Create Explorations
        </Button>
      </div>
    );
  }

  // Loading placeholder component for images still being generated
  const LoadingPlaceholder = ({ label }: { label: string }) => (
    <div className="relative rounded-lg overflow-hidden border border-border bg-white aspect-video flex items-center justify-center">
      <div className="text-center space-y-2">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Style Expressions</h2>
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

      {/* Mood Board Section - show loading or image */}
      {(hasCollage || collageLoading) && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            Mood Exploration
            <InfoTooltip testId="tooltip-mood-board">{FEATURE_EXPLANATIONS.moodBoard}</InfoTooltip>
          </h3>
          {hasCollage ? (
            <div className="relative group rounded-lg overflow-hidden border border-border" data-testid="img-container-collage">
              <img
                src={moodBoard?.collage}
                alt={`${styleName} mood board`}
                className="w-full h-auto"
                data-testid="img-collage"
              />
              <DownloadButton src={moodBoard?.collage || ""} filename={`${styleName}-mood-board.png`} />
            </div>
          ) : (
            <LoadingPlaceholder label="Exploring mood..." />
          )}
        </div>
      )}

      {/* Software App Thumbnail Section - show first as primary UI concept */}
      {(hasSoftwareApp || softwareAppLoading) && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            App Interface
            <InfoTooltip testId="tooltip-software-app">One way this style might express itself in a software interface.</InfoTooltip>
          </h3>
          {hasSoftwareApp ? (
            <div className="relative group rounded-lg overflow-hidden border border-border" data-testid="img-container-software-app">
              <img
                src={uiConcepts?.softwareApp}
                alt={`${styleName} software app`}
                className="w-full h-auto"
                data-testid="img-software-app"
              />
              <DownloadButton src={uiConcepts?.softwareApp || ""} filename={`${styleName}-software-app.png`} />
            </div>
          ) : (
            <LoadingPlaceholder label="Sketching interface..." />
          )}
        </div>
      )}

      {/* UI Concepts Section - show loading or images progressively */}
      {(hasAudioPlugin || hasDashboard || audioPluginLoading || dashboardLoading) && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            Interface Sketches
            <InfoTooltip testId="tooltip-ui-concepts">{FEATURE_EXPLANATIONS.uiConcepts}</InfoTooltip>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Audio Plugin - show image or loading */}
            {hasAudioPlugin ? (
              <div className="relative group rounded-lg overflow-hidden border border-border" data-testid="img-container-audio">
                <img
                  src={uiConcepts?.audioPlugin}
                  alt={`${styleName} audio plugin`}
                  className="w-full h-auto"
                  data-testid="img-audio"
                />
                <DownloadButton src={uiConcepts?.audioPlugin || ""} filename={`${styleName}-audio-plugin.png`} />
                <div className="p-2 bg-white text-center">
                  <span className="text-xs text-muted-foreground">Audio Plugin</span>
                </div>
              </div>
            ) : audioPluginLoading ? (
              <LoadingPlaceholder label="Sketching audio UI..." />
            ) : null}
            
            {/* Dashboard - show image or loading */}
            {hasDashboard ? (
              <div className="relative group rounded-lg overflow-hidden border border-border" data-testid="img-container-dashboard">
                <img
                  src={uiConcepts?.dashboard}
                  alt={`${styleName} dashboard`}
                  className="w-full h-auto"
                  data-testid="img-dashboard"
                />
                <DownloadButton src={uiConcepts?.dashboard || ""} filename={`${styleName}-dashboard.png`} />
                <div className="p-2 bg-white text-center">
                  <span className="text-xs text-muted-foreground">Dashboard</span>
                </div>
              </div>
            ) : dashboardLoading ? (
              <LoadingPlaceholder label="Sketching dashboard..." />
            ) : null}
          </div>
        </div>
      )}

      {/* Generation History */}
      {((moodBoard?.history && moodBoard.history.length > 0) || 
        (uiConcepts?.history && uiConcepts.history.length > 0)) && (
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Previous Generations</h3>
          </div>
          
          {moodBoard?.history?.map((entry: MoodBoardEntry, index: number) => (
            <div key={`mood-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Mood Board - {new Date(entry.generatedAt).toLocaleDateString(undefined, { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </span>
              </div>
              <div className="relative group rounded-lg overflow-hidden border border-border/50 opacity-75 hover:opacity-100 transition-opacity">
                <img
                  src={entry.collage}
                  alt={`${styleName} previous mood board`}
                  className="w-full h-auto"
                  loading="lazy"
                />
                <DownloadButton src={entry.collage} filename={`${styleName}-mood-board-${index + 1}.png`} />
              </div>
            </div>
          ))}

          {uiConcepts?.history?.map((entry: UiConceptEntry, index: number) => (
            <div key={`ui-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  UI Concepts - {new Date(entry.generatedAt).toLocaleDateString(undefined, { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entry.audioPlugin && (
                  <div className="relative group rounded-lg overflow-hidden border border-border/50 opacity-75 hover:opacity-100 transition-opacity">
                    <img
                      src={entry.audioPlugin}
                      alt={`${styleName} previous audio plugin`}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    <DownloadButton src={entry.audioPlugin} filename={`${styleName}-audio-plugin-${index + 1}.png`} />
                    <div className="p-2 bg-white text-center">
                      <span className="text-xs text-muted-foreground">Audio Plugin</span>
                    </div>
                  </div>
                )}
                {entry.dashboard && (
                  <div className="relative group rounded-lg overflow-hidden border border-border/50 opacity-75 hover:opacity-100 transition-opacity">
                    <img
                      src={entry.dashboard}
                      alt={`${styleName} previous dashboard`}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    <DownloadButton src={entry.dashboard} filename={`${styleName}-dashboard-${index + 1}.png`} />
                    <div className="p-2 bg-white text-center">
                      <span className="text-xs text-muted-foreground">Dashboard</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AiMoodBoard;
