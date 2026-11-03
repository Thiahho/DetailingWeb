import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle, ThrottleBusyError } from "@/src/lib/geo/throttle";

describe("createThrottle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the first call right away and spaces the next ones by the interval", async () => {
    const throttle = createThrottle({ intervalMs: 1_000, maxWaitMs: 5_000 });
    const started: number[] = [];
    const t0 = Date.now();
    const job = () => {
      started.push(Date.now() - t0);
      return Promise.resolve("ok");
    };

    const results = Promise.all([throttle(job), throttle(job), throttle(job)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(started).toEqual([0, 1_000]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(started).toEqual([0, 1_000, 2_000]);
    await expect(results).resolves.toEqual(["ok", "ok", "ok"]);
  });

  it("does not delay a call when the previous one is older than the interval", async () => {
    const throttle = createThrottle({ intervalMs: 1_000, maxWaitMs: 5_000 });
    const job = vi.fn(() => Promise.resolve(1));
    await throttle(job);
    await vi.advanceTimersByTimeAsync(1_500);
    const pending = throttle(job);
    await vi.advanceTimersByTimeAsync(0);
    expect(job).toHaveBeenCalledTimes(2);
    await pending;
  });

  it("rejects with ThrottleBusyError instead of queueing past maxWaitMs", async () => {
    const throttle = createThrottle({ intervalMs: 1_000, maxWaitMs: 2_000 });
    const job = vi.fn(() => Promise.resolve(1));
    const accepted = [throttle(job), throttle(job), throttle(job)]; // start at 0s, 1s, 2s
    await expect(throttle(job)).rejects.toBeInstanceOf(ThrottleBusyError); // would start at 3s
    await vi.advanceTimersByTimeAsync(2_000);
    await Promise.all(accepted);
    expect(job).toHaveBeenCalledTimes(3);
  });

  it("keeps the spacing when a job fails", async () => {
    const throttle = createThrottle({ intervalMs: 1_000, maxWaitMs: 5_000 });
    const failing = throttle(() => Promise.reject(new Error("boom")));
    const job = vi.fn(() => Promise.resolve(1));
    const next = throttle(job);
    await expect(failing).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(999);
    expect(job).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(job).toHaveBeenCalledTimes(1);
    await next;
  });
});
