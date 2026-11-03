/**
 * Spaces outbound calls so that no two start less than `intervalMs` apart (Nominatim usage
 * policy: at most 1 request per second). Calls wait their turn; a call that would have to wait
 * more than `maxWaitMs` is rejected with ThrottleBusyError instead of piling up.
 *
 * IMPORTANT: per server instance only. Several serverless instances each get their own
 * 1 req/s budget; the in-memory cache in front of it and the per-IP rate limit keep the real
 * outbound volume low.
 */
export class ThrottleBusyError extends Error {
  constructor() {
    super("Outbound throttle queue is full");
    this.name = "ThrottleBusyError";
  }
}

type Options = { intervalMs: number; maxWaitMs: number };

export type Throttle = <T>(job: () => Promise<T>) => Promise<T>;

export function createThrottle({ intervalMs, maxWaitMs }: Options): Throttle {
  // Earliest time the next call may start.
  let nextSlot = 0;

  return async (job) => {
    const now = Date.now();
    const start = Math.max(now, nextSlot);
    const wait = start - now;
    if (wait > maxWaitMs) throw new ThrottleBusyError();
    nextSlot = start + intervalMs;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return job();
  };
}
