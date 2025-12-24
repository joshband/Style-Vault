import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";

export interface Job {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
  progressMessage: string | null;
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  styleId: string | null;
  canRetry: boolean;
  canCancel: boolean;
  message: string;
}

interface UseJobOptions {
  pollingInterval?: number;
  onSuccess?: (job: Job) => void;
  onError?: (job: Job) => void;
  onProgress?: (job: Job) => void;
}

export function useJob(jobId: string | null, options: UseJobOptions = {}) {
  const { 
    pollingInterval = 1000, 
    onSuccess, 
    onError,
    onProgress,
  } = options;
  
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<string | null>(null);
  const previousProgressRef = useRef<number | null>(null);

  const query = useQuery<Job>({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("No job ID");
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch job status");
      }
      return response.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return pollingInterval;
      if (job.status === "queued" || job.status === "running") {
        return pollingInterval;
      }
      return false;
    },
    staleTime: 500,
  });

  useEffect(() => {
    const job = query.data;
    if (!job) return;

    if (previousProgressRef.current !== job.progress && onProgress) {
      onProgress(job);
    }
    previousProgressRef.current = job.progress;

    if (previousStatusRef.current !== job.status) {
      if (job.status === "succeeded" && onSuccess) {
        onSuccess(job);
      } else if (job.status === "failed" && onError) {
        onError(job);
      }
    }
    previousStatusRef.current = job.status;
  }, [query.data, onSuccess, onError, onProgress]);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("No job ID");
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel job");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("No job ID");
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to retry job");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });

  const cancel = useCallback(() => {
    cancelMutation.mutate();
  }, [cancelMutation]);

  const retry = useCallback(() => {
    retryMutation.mutate();
  }, [retryMutation]);

  return {
    job: query.data,
    isLoading: query.isLoading,
    isPolling: query.data?.status === "queued" || query.data?.status === "running",
    error: query.error,
    cancel,
    retry,
    isCanceling: cancelMutation.isPending,
    isRetrying: retryMutation.isPending,
  };
}

export function useActiveJobs(styleId?: string) {
  return useQuery<Job[]>({
    queryKey: ["jobs", "active", styleId],
    queryFn: async () => {
      const url = styleId 
        ? `/api/jobs?styleId=${encodeURIComponent(styleId)}`
        : "/api/jobs";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }
      return response.json();
    },
    refetchInterval: 2000,
  });
}
