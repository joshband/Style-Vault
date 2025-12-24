import { useJob, Job } from "@/hooks/use-job";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Loader2, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle
} from "lucide-react";

interface JobProgressProps {
  jobId: string | null;
  onSuccess?: (job: Job) => void;
  onError?: (job: Job) => void;
  className?: string;
  showControls?: boolean;
  compact?: boolean;
}

export function JobProgress({ 
  jobId, 
  onSuccess, 
  onError, 
  className,
  showControls = true,
  compact = false,
}: JobProgressProps) {
  const { 
    job, 
    isLoading, 
    isPolling, 
    cancel, 
    retry, 
    isCanceling, 
    isRetrying 
  } = useJob(jobId, { onSuccess, onError });

  if (!jobId || isLoading) {
    return null;
  }

  if (!job) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
        <AlertTriangle size={14} />
        <span>Job not found</span>
      </div>
    );
  }

  const statusIcon = getStatusIcon(job.status, isPolling);
  const statusColor = getStatusColor(job.status);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {statusIcon}
        <span className={cn("text-xs font-medium", statusColor)}>
          {job.message || job.progressMessage || getStatusLabel(job.status)}
        </span>
        {job.status === "running" && (
          <span className="text-xs text-muted-foreground">
            {job.progress}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 p-4 rounded-lg border bg-card", className)} data-testid="job-progress">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className={cn("text-sm font-medium", statusColor)}>
            {getStatusLabel(job.status)}
          </span>
        </div>
        {showControls && (
          <div className="flex items-center gap-2">
            {job.canCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancel}
                disabled={isCanceling}
                data-testid="button-cancel-job"
              >
                {isCanceling ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
                <span className="ml-1">Cancel</span>
              </Button>
            )}
            {job.canRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={retry}
                disabled={isRetrying}
                data-testid="button-retry-job"
              >
                {isRetrying ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                <span className="ml-1">Retry</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {(job.status === "running" || job.status === "queued") && (
        <div className="space-y-1">
          <Progress value={job.progress} className="h-2" data-testid="job-progress-bar" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{job.progressMessage || "Processing..."}</span>
            <span>{job.progress}%</span>
          </div>
        </div>
      )}

      {job.error && (
        <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{job.error}</p>
          {job.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Attempt {job.retryCount} of {job.maxRetries}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: Job["status"], isPolling: boolean) {
  switch (status) {
    case "queued":
      return <Clock size={16} className="text-muted-foreground" />;
    case "running":
      return <Loader2 size={16} className="text-primary animate-spin" />;
    case "succeeded":
      return <CheckCircle2 size={16} className="text-green-500" />;
    case "failed":
      return <XCircle size={16} className="text-destructive" />;
    case "canceled":
      return <X size={16} className="text-muted-foreground" />;
    default:
      return null;
  }
}

function getStatusColor(status: Job["status"]) {
  switch (status) {
    case "queued":
      return "text-muted-foreground";
    case "running":
      return "text-primary";
    case "succeeded":
      return "text-green-500";
    case "failed":
      return "text-destructive";
    case "canceled":
      return "text-muted-foreground";
    default:
      return "";
  }
}

function getStatusLabel(status: Job["status"]) {
  switch (status) {
    case "queued":
      return "Waiting...";
    case "running":
      return "Processing";
    case "succeeded":
      return "Complete";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
}

interface InlineProgressProps {
  progress: number;
  message?: string;
  status?: "running" | "complete" | "error";
  className?: string;
}

export function InlineProgress({ 
  progress, 
  message, 
  status = "running",
  className 
}: InlineProgressProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        {status === "running" && <Loader2 size={12} className="animate-spin text-primary" />}
        {status === "complete" && <CheckCircle2 size={12} className="text-green-500" />}
        {status === "error" && <XCircle size={12} className="text-destructive" />}
        <span className="text-xs text-muted-foreground">{message || "Processing..."}</span>
      </div>
      {status === "running" && (
        <Progress value={progress} className="h-1" />
      )}
    </div>
  );
}

interface JobStatusBadgeProps {
  status: Job["status"];
  className?: string;
}

export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  const icon = getStatusIcon(status, false);
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs", color, className)}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
