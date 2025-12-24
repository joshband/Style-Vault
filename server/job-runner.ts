import { storage } from "./storage";
import type { Job, JobType, JobStatus } from "@shared/schema";

export interface JobConfig {
  maxRetries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  onProgress?: (progress: number, message: string) => Promise<void>;
}

const DEFAULT_CONFIG: Required<Omit<JobConfig, "onProgress">> = {
  maxRetries: 3,
  timeoutMs: 120000,
  retryDelayMs: 2000,
};

export interface JobExecutor<TInput, TOutput> {
  (input: TInput, onProgress: (progress: number, message: string) => Promise<void>): Promise<TOutput>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createAndRunJob<TInput extends Record<string, any>, TOutput>(
  type: JobType,
  input: TInput,
  executor: JobExecutor<TInput, TOutput>,
  config: JobConfig = {},
  styleId?: string
): Promise<{ job: Job; result?: TOutput }> {
  const { maxRetries, timeoutMs, retryDelayMs } = { ...DEFAULT_CONFIG, ...config };

  const job = await storage.createJob({
    type,
    input,
    status: "queued",
    progress: 0,
    maxRetries,
    styleId: styleId ?? null,
  } as any);

  return runJobWithRetries(job.id, executor, { maxRetries, timeoutMs, retryDelayMs });
}

export async function runJobWithRetries<TInput extends Record<string, any>, TOutput>(
  jobId: string,
  executor: JobExecutor<TInput, TOutput>,
  config: Required<Omit<JobConfig, "onProgress">>
): Promise<{ job: Job; result?: TOutput }> {
  const { maxRetries, timeoutMs, retryDelayMs } = config;

  let job = await storage.getJobById(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  while (job.retryCount < maxRetries) {
    try {
      await storage.updateJobStatus(job.id, "running", {
        progress: 0,
        progressMessage: "Starting...",
      });

      const onProgress = async (progress: number, message: string) => {
        await storage.updateJobStatus(job!.id, "running", {
          progress: Math.min(99, Math.max(0, progress)),
          progressMessage: message,
        });
      };

      const result = await Promise.race([
        executor(job.input as TInput, onProgress),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Job timed out")), timeoutMs)
        ),
      ]);

      const finalJob = await storage.updateJobStatus(job.id, "succeeded", {
        progress: 100,
        progressMessage: "Complete",
        output: result as Record<string, any>,
      });

      return { job: finalJob!, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Job ${job.id} failed (attempt ${job.retryCount + 1}/${maxRetries}):`, errorMessage);

      if (job.retryCount + 1 >= maxRetries) {
        const finalJob = await storage.updateJobStatus(job.id, "failed", {
          progress: 0,
          progressMessage: "Failed after all retries",
          error: errorMessage,
        });
        return { job: finalJob! };
      }

      await storage.updateJobStatus(job.id, "queued", {
        progress: 0,
        progressMessage: `Retrying in ${retryDelayMs / 1000}s...`,
        error: errorMessage,
      });

      job = await storage.incrementJobRetry(job.id);
      if (!job) {
        throw new Error(`Failed to increment retry for job ${jobId}`);
      }

      await sleep(retryDelayMs * Math.pow(2, job.retryCount - 1));
    }
  }

  const finalJob = await storage.getJobById(jobId);
  return { job: finalJob! };
}

export async function cancelJob(jobId: string): Promise<Job | undefined> {
  const job = await storage.getJobById(jobId);
  if (!job) return undefined;

  if (job.status === "succeeded" || job.status === "failed" || job.status === "canceled") {
    return job;
  }

  return storage.updateJobStatus(jobId, "canceled", {
    progressMessage: "Canceled by user",
  });
}

export async function retryJob<TInput extends Record<string, any>, TOutput>(
  jobId: string,
  executor: JobExecutor<TInput, TOutput>
): Promise<{ job: Job; result?: TOutput } | undefined> {
  const job = await storage.getJobById(jobId);
  if (!job) return undefined;

  if (job.status !== "failed" && job.status !== "canceled") {
    return { job };
  }

  await storage.updateJobStatus(job.id, "queued", {
    progress: 0,
    progressMessage: "Queued for retry",
    error: undefined,
  });

  const updatedJob = await storage.incrementJobRetry(job.id);
  if (!updatedJob) return undefined;

  return runJobWithRetries(jobId, executor, {
    maxRetries: job.maxRetries,
    timeoutMs: 120000,
    retryDelayMs: 2000,
  });
}

export function getJobProgress(job: Job): {
  status: JobStatus;
  progress: number;
  message: string;
  canRetry: boolean;
  canCancel: boolean;
} {
  return {
    status: job.status,
    progress: job.progress,
    message: job.progressMessage || getDefaultMessage(job.status),
    canRetry: job.status === "failed" && job.retryCount < job.maxRetries,
    canCancel: job.status === "queued" || job.status === "running",
  };
}

function getDefaultMessage(status: JobStatus): string {
  switch (status) {
    case "queued":
      return "Waiting to start...";
    case "running":
      return "Processing...";
    case "succeeded":
      return "Complete";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "";
  }
}
