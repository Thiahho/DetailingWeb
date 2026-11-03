import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "@/src/lib/rateLimit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit inside the window and rejects the next request", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 10_000 });
    expect([1, 2, 3].map(() => limiter.check("1.1.1.1").ok)).toEqual([true, true, true]);
    const rejected = limiter.check("1.1.1.1");
    expect(rejected.ok).toBe(false);
    expect(rejected.retryAfterSeconds).toBe(10);
  });

  it("keeps a separate budget per key", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000 });
    expect(limiter.check("1.1.1.1").ok).toBe(true);
    expect(limiter.check("2.2.2.2").ok).toBe(true);
    expect(limiter.check("1.1.1.1").ok).toBe(false);
  });

  it("slides the window: old requests stop counting once they are older than the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000 });
    limiter.check("ip");
    vi.advanceTimersByTime(6_000);
    limiter.check("ip");
    expect(limiter.check("ip").ok).toBe(false);

    // The first request leaves the window at t=10s; the second one still counts until t=16s.
    vi.advanceTimersByTime(4_000);
    const afterFirstExpires = limiter.check("ip");
    expect(afterFirstExpires.ok).toBe(true);
    const rejected = limiter.check("ip");
    expect(rejected.ok).toBe(false);
    expect(rejected.retryAfterSeconds).toBe(6);
  });

  it("does not count rejected requests against the budget", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000 });
    limiter.check("ip");
    vi.advanceTimersByTime(5_000);
    expect(limiter.check("ip").ok).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(limiter.check("ip").ok).toBe(true);
  });

  it("bounds memory by evicting the oldest keys", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.check("a");
    limiter.check("b");
    limiter.check("c");
    expect(limiter.size()).toBe(2);
    // "a" was evicted, so it starts with a fresh budget.
    expect(limiter.check("a").ok).toBe(true);
  });
});
