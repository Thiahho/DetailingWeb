// Whether the tenant publishes a catalog (≥1 public category), which decides if
// the navbar shows the "Catálogo" link. The navbar asks on every mount, so the
// answer is remembered: for the page's lifetime in memory and, across page
// loads, in the public data cache (publicApi.ts wires the storage).
import type { CatalogResult } from "./api";
import type { PublicCategory } from "./publicTypes";

export const HAS_CATALOG_CACHE_KEY = "catalog:has";
export const HAS_CATALOG_MAX_AGE_MS = 60 * 60_000;

export interface CatalogPresenceDeps {
  // The stored answer, or null when there is none or it expired.
  read: () => boolean | null;
  write: (hasCatalog: boolean) => void;
  fetchCategories: () => Promise<CatalogResult<PublicCategory[]>>;
}

// null when the response does not answer the question (network/server error).
export function categoriesAnswer(res: CatalogResult<PublicCategory[]>): boolean | null {
  if (!res.ok || !Array.isArray(res.data)) return null;
  return res.data.length > 0;
}

export function createCatalogPresence(deps: CatalogPresenceDeps) {
  let memo: Promise<boolean> | null = null;

  // Every successful categories response corrects the remembered answer, so a
  // tenant that adds or removes its catalog is fixed on the next catalog visit.
  function remember(res: CatalogResult<PublicCategory[]>): boolean | null {
    const answer = categoriesAnswer(res);
    if (answer !== null) {
      deps.write(answer);
      memo = Promise.resolve(answer);
    }
    return answer;
  }

  function check(): Promise<boolean> {
    if (memo) return memo;

    const stored = deps.read();
    if (stored !== null) {
      memo = Promise.resolve(stored);
      return memo;
    }

    const pending: Promise<boolean> = deps.fetchCategories().then((res) => {
      const answer = remember(res);
      // A failed check is not stored and is retried on the next mount instead
      // of hiding the catalog for good.
      if (answer === null && memo === pending) memo = null;
      return answer ?? false;
    });
    memo = pending;
    return pending;
  }

  return { check, remember };
}
