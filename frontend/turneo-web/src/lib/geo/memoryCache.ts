/**
 * Tiny TTL cache with in-flight de-duplication: identical concurrent requests share one load,
 * and failures are not cached. Per server instance only (see src/lib/rateLimit.ts).
 */
export type MemoryCache<T> = {
  getOrLoad(key: string, load: () => Promise<T>): Promise<T>;
};

type Options = { ttlMs: number; maxEntries: number };

export function createMemoryCache<T>({ ttlMs, maxEntries }: Options): MemoryCache<T> {
  const entries = new Map<string, { expiresAt: number; value: Promise<T> }>();

  return {
    getOrLoad(key, load) {
      const now = Date.now();
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now) return hit.value;

      const value = load();
      entries.delete(key);
      entries.set(key, { expiresAt: now + ttlMs, value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      while (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value as string);
      }
      return value;
    },
  };
}
