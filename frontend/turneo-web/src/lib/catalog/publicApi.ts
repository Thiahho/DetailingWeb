// Client-side calls to the anonymous catalog endpoints, through the catalog
// proxy (app/api/catalog/[...path]) that forwards the tenant host — the same
// pattern the rest of the public site uses (/api/services, /api/siteconfig).
import { getCached, setCached } from "@/src/lib/publicDataCache";
import { catalogRequest, type CatalogResult } from "./api";
import { HAS_CATALOG_CACHE_KEY, HAS_CATALOG_MAX_AGE_MS, createCatalogPresence } from "./catalogPresence";
import type { PublicCategory, PublicProductCard, PublicProductDetail, PublicVariantStatus } from "./publicTypes";

// The backend accepts up to 200 ids per call.
const VARIANT_IDS_PER_CALL = 200;

function requestPublicCategories(): Promise<CatalogResult<PublicCategory[]>> {
  return catalogRequest<PublicCategory[]>("public/categories", { fallback: "No se pudo cargar el catálogo" });
}

// Every successful answer also refreshes what hasPublicCatalog() remembers.
export async function fetchPublicCategories(): Promise<CatalogResult<PublicCategory[]>> {
  const res = await requestPublicCategories();
  catalogPresence.remember(res);
  return res;
}

export function fetchPublicProducts(categorySlug?: string): Promise<CatalogResult<PublicProductCard[]>> {
  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : "";
  return catalogRequest<PublicProductCard[]>(`public/products${query}`, { fallback: "No se pudieron cargar los productos" });
}

export function fetchPublicProduct(slug: string): Promise<CatalogResult<PublicProductDetail>> {
  return catalogRequest<PublicProductDetail>(`public/products/${encodeURIComponent(slug)}`, {
    fallback: "No se pudo cargar el producto",
  });
}

// null when the check could not be done (network/server error): the caller keeps the cart as it is.
export async function fetchVariantStatuses(ids: number[]): Promise<PublicVariantStatus[] | null> {
  const unique = Array.from(new Set(ids));
  const result: PublicVariantStatus[] = [];
  for (let i = 0; i < unique.length; i += VARIANT_IDS_PER_CALL) {
    const chunk = unique.slice(i, i + VARIANT_IDS_PER_CALL);
    const res = await catalogRequest<PublicVariantStatus[]>(`public/variants?ids=${chunk.join(",")}`);
    if (!res.ok || !Array.isArray(res.data)) return null;
    result.push(...res.data);
  }
  return result;
}

// Whether the tenant publishes a catalog (≥1 public category). The navbar asks
// on every mount of every public page: the answer is kept for the page's
// lifetime and, with the "preferences" consent, for an hour across page loads
// (see catalogPresence.ts), so most page loads make no categories request.
const catalogPresence = createCatalogPresence({
  read: () => {
    const stored = getCached<boolean>(HAS_CATALOG_CACHE_KEY, HAS_CATALOG_MAX_AGE_MS);
    return typeof stored === "boolean" ? stored : null;
  },
  write: (hasCatalog) => setCached(HAS_CATALOG_CACHE_KEY, hasCatalog),
  fetchCategories: requestPublicCategories,
});

export function hasPublicCatalog(): Promise<boolean> {
  return catalogPresence.check();
}

export interface OrderSettings {
  businessName: string;
  whatsAppNumber: string;
}

// Read straight from the public site config, without getSiteConfig()'s
// env defaults: an order must never go to a fallback number of another business.
export async function fetchOrderSettings(): Promise<OrderSettings | null> {
  try {
    const res = await fetch("/api/siteconfig");
    if (!res.ok) return null;
    const data = (await res.json()) as { businessName?: unknown; whatsAppNumber?: unknown };
    return {
      businessName: typeof data.businessName === "string" ? data.businessName : "",
      whatsAppNumber: typeof data.whatsAppNumber === "string" ? data.whatsAppNumber : "",
    };
  } catch {
    return null;
  }
}
