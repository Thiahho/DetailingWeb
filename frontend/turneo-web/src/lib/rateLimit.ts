/**
 * Small in-memory sliding-window rate limiter (log of request timestamps per key).
 *
 * IMPORTANT: state lives in the memory of one server instance. On Vercel (serverless) every
 * function instance has its own counters and they reset on cold starts, so the effective limit
 * across the deployment is `limit x instances`. That is acceptable for abuse protection of the
 * geo proxies without adding an external store; use a shared store if a hard global limit is needed.
 */
export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export type RateLimiter = {
  check(key: string): RateLimitResult;
  /** Number of tracked keys (for tests and diagnostics). */
  size(): number;
};

type Options = { limit: number; windowMs: number; maxKeys?: number };

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }: Options): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

      if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterMs = recent[0] + windowMs - now;
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }

      recent.push(now);
      // Re-insert so Map order tracks the most recently active key; the first key is the stalest.
      hits.delete(key);
      hits.set(key, recent);
      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value as string;
        hits.delete(oldest);
      }
      return { ok: true, retryAfterSeconds: 0 };
    },
    size: () => hits.size,
  };
}
