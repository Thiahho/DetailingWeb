import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryCache } from "@/src/lib/geo/memoryCache";

describe("createMemoryCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the cached value until the ttl expires", async () => {
    const cache = createMemoryCache<string>({ ttlMs: 60_000, maxEntries: 10 });
    const load = vi.fn(() => Promise.resolve("value"));
    expect(await cache.getOrLoad("k", load)).toBe("value");
    expect(await cache.getOrLoad("k", load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_001);
    await cache.getOrLoad("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight load between identical concurrent requests", async () => {
    const cache = createMemoryCache<number>({ ttlMs: 60_000, maxEntries: 10 });
    const load = vi.fn(() => Promise.resolve(42));
    await expect(Promise.all([cache.getOrLoad("k", load), cache.getOrLoad("k", load)])).resolves.toEqual([42, 42]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const cache = createMemoryCache<number>({ ttlMs: 60_000, maxEntries: 10 });
    await expect(cache.getOrLoad("k", () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    await expect(cache.getOrLoad("k", () => Promise.resolve(1))).resolves.toBe(1);
  });

  it("evicts the oldest entry past maxEntries", async () => {
    const cache = createMemoryCache<string>({ ttlMs: 60_000, maxEntries: 2 });
    await cache.getOrLoad("a", async () => "a");
    await cache.getOrLoad("b", async () => "b");
    await cache.getOrLoad("c", async () => "c");
    const load = vi.fn(async () => "a2");
    expect(await cache.getOrLoad("a", load)).toBe("a2");
    expect(load).toHaveBeenCalledTimes(1);
  });
});
