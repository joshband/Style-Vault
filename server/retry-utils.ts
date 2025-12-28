import pRetry, { AbortError } from "p-retry";
import { logger } from "./logger";

export interface RetryConfig {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 30000,
  factor: 2,
  onRetry: (error, attempt) => {
    logger.warn(`Attempt ${attempt} failed: ${error.message}`, { module: 'RetryUtils' });
  },
};

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("too many requests") ||
      msg.includes("quota exceeded") ||
      msg.includes("429") ||
      msg.includes("resource exhausted")
    );
  }
  return false;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      isRateLimitError(error) ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("503") ||
      msg.includes("502") ||
      msg.includes("504") ||
      msg.includes("service unavailable") ||
      msg.includes("temporarily unavailable")
    );
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  return pRetry(
    async () => {
      try {
        return await fn();
      } catch (error) {
        if (!isTransientError(error)) {
          throw new AbortError(error instanceof Error ? error.message : String(error));
        }
        throw error;
      }
    },
    {
      retries: mergedConfig.retries,
      minTimeout: mergedConfig.minTimeout,
      maxTimeout: mergedConfig.maxTimeout,
      factor: mergedConfig.factor,
      onFailedAttempt: (failedAttempt) => {
        const err = failedAttempt.error || new Error("Unknown error");
        mergedConfig.onRetry(err, failedAttempt.attemptNumber);
      },
    }
  );
}

export async function withAIRetry<T>(
  fn: () => Promise<T>,
  operationName: string = "AI operation"
): Promise<T> {
  return withRetry(fn, {
    retries: 3,
    minTimeout: 2000,
    maxTimeout: 60000,
    factor: 2.5,
    onRetry: (error, attempt) => {
      logger.warn(`${operationName} retry attempt ${attempt}: ${error.message}`, { module: 'RetryUtils', operation: operationName });
    },
  });
}

export async function withImageGenRetry<T>(
  fn: () => Promise<T>,
  operationName: string = "Image generation"
): Promise<T> {
  return withRetry(fn, {
    retries: 4,
    minTimeout: 2000,
    maxTimeout: 60000,
    factor: 2.5,
    onRetry: (error, attempt) => {
      logger.warn(`${operationName} retry attempt ${attempt}: ${error.message}`, { module: 'RetryUtils', operation: operationName });
    },
  });
}
