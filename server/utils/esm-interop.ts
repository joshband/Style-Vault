/**
 * Memoized ESM interop helpers for packages that only support ESM.
 * These helpers ensure proper loading in both ESM (development) and CJS (production) contexts.
 */

let pLimitCached: ReturnType<typeof import("p-limit").default> | null = null;
let pRetryCached: { 
  pRetry: typeof import("p-retry").default; 
  AbortError: typeof import("p-retry").AbortError;
} | null = null;

/**
 * Get a cached p-limit instance with the specified concurrency.
 * Creates a new limiter with the given concurrency on first call.
 */
export async function getPLimit(concurrency: number) {
  const pLimit = (await import("p-limit")).default;
  return pLimit(concurrency);
}

/**
 * Get memoized p-retry module with both pRetry function and AbortError class.
 */
export async function getPRetry() {
  if (!pRetryCached) {
    const module = await import("p-retry");
    pRetryCached = { 
      pRetry: module.default, 
      AbortError: module.AbortError 
    };
  }
  return pRetryCached;
}
