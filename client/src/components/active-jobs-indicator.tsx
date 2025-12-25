import { useActiveJobs, type Job } from "@/hooks/use-job";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ChevronDown,
  X,
  RefreshCw,
  Clock
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQueryClient } from "@tanstack/react-query";

interface ActiveJobsIndicatorProps {
  styleId?: string;
  className?: string;
}

export function ActiveJobsIndicator({ styleId, className }: ActiveJobsIndicatorProps) {
  const { data: jobs, isLoading } = useActiveJobs(styleId);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Job[]>([]);
  
  const activeJobs = jobs?.filter(j => j.status === "queued" || j.status === "running") || [];
  const failedJobs = jobs?.filter(j => j.status === "failed") || [];
  
  useEffect(() => {
    const succeeded = jobs?.filter(j => j.status === "succeeded") || [];
    if (succeeded.length > 0) {
      setRecentlyCompleted(prev => {
        const newCompleted = succeeded.filter(s => !prev.some(p => p.id === s.id));
        if (newCompleted.length > 0) {
          setTimeout(() => {
            setRecentlyCompleted(current => 
              current.filter(c => !newCompleted.some(n => n.id === c.id))
            );
          }, 3000);
          return [...prev, ...newCompleted];
        }
        return prev;
      });
    }
  }, [jobs]);

  const hasActivity = activeJobs.length > 0 || failedJobs.length > 0 || recentlyCompleted.length > 0;
  
  if (isLoading || !hasActivity) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors",
            activeJobs.length > 0 
              ? "bg-primary/10 text-primary hover:bg-primary/20" 
              : failedJobs.length > 0
                ? "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                : "bg-green-500/10 text-green-600 hover:bg-green-500/20",
            className
          )}
          data-testid="indicator-active-jobs"
        >
          {activeJobs.length > 0 ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>{activeJobs.length} running</span>
            </>
          ) : failedJobs.length > 0 ? (
            <>
              <XCircle size={12} />
              <span>{failedJobs.length} failed</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={12} />
              <span>Complete</span>
            </>
          )}
          <ChevronDown size={10} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h4 className="text-sm font-medium">Background Tasks</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            These run automatically and won't block your work
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {activeJobs.length === 0 && failedJobs.length === 0 && recentlyCompleted.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No active tasks
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeJobs.map(job => (
                <JobListItem key={job.id} job={job} />
              ))}
              {failedJobs.map(job => (
                <JobListItem key={job.id} job={job} />
              ))}
              {recentlyCompleted.map(job => (
                <JobListItem key={job.id} job={job} showSuccess />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface JobListItemProps {
  job: Job;
  showSuccess?: boolean;
}

function JobListItem({ job, showSuccess }: JobListItemProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const queryClient = useQueryClient();

  const invalidateJobQueries = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] === "jobs" && key[1] === "active") return true;
        if (key[0] === "job" && key[1] === job.id) return true;
        return false;
      }
    });
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      invalidateJobQueries();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    setIsCanceling(true);
    try {
      await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      invalidateJobQueries();
    } finally {
      setIsCanceling(false);
    }
  };

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      token_extraction: "Extracting tokens",
      preview_generation: "Generating previews",
      image_generation: "Creating image",
      mood_board: "Building mood board",
      metadata_enrichment: "Enriching metadata",
    };
    return labels[type] || type;
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {job.status === "queued" && <Clock size={14} className="text-muted-foreground shrink-0" />}
          {job.status === "running" && <Loader2 size={14} className="text-primary animate-spin shrink-0" />}
          {job.status === "succeeded" && showSuccess && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
          {job.status === "failed" && <XCircle size={14} className="text-red-500 shrink-0" />}
          <span className="text-sm font-medium truncate">{getJobTypeLabel(job.type)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {job.canCancel && (
            <button
              onClick={handleCancel}
              disabled={isCanceling}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Cancel"
            >
              {isCanceling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            </button>
          )}
          {job.canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Retry"
            >
              {isRetrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </button>
          )}
        </div>
      </div>
      
      {(job.status === "running" || job.status === "queued") && (
        <div className="space-y-1">
          <Progress value={job.progress} className="h-1" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{job.progressMessage || "Processing..."}</span>
            <span>{job.progress}%</span>
          </div>
        </div>
      )}
      
      {job.status === "failed" && job.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{job.error}</p>
      )}
    </div>
  );
}

export function CompactJobIndicator({ job }: { job: Job }) {
  if (job.status === "succeeded" || job.status === "canceled") {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {job.status === "queued" && <Clock size={12} className="text-muted-foreground" />}
      {job.status === "running" && <Loader2 size={12} className="text-primary animate-spin" />}
      {job.status === "failed" && <XCircle size={12} className="text-red-500" />}
      <span className="text-[10px] text-muted-foreground">
        {job.status === "running" && `${job.progress}%`}
        {job.status === "failed" && "Failed"}
        {job.status === "queued" && "Queued"}
      </span>
    </div>
  );
}
