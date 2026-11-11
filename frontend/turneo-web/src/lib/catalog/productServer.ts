// Server-side load of a public product, for the product page and its metadata.
// Server only: `next/headers` does not build inside a client component, and the
// forwarded headers carry the proxy secret (see tenantHeader.ts).
import { cache } from "react";
import { headers } from "next/headers";
import { API_URL } from "@/src/lib/apiUrl";
import { tenantHeaderFromHeaders } from "@/src/lib/tenantHeader";
import { isProductDetail, productLoadKind, type ProductLoad } from "./productPage";

// The server component calls the backend directly (no hop through the catalog
// proxy), so it forwards the visited host and the visitor IP itself.
// `cache()` makes generateMetadata and the page share one request per render.
export const loadPublicProduct = cache(async (slug: string): Promise<ProductLoad> => {
  // Outside the try: Next.js signals dynamic rendering by throwing from headers().
  const forwarded = tenantHeaderFromHeaders(headers());
  try {
    const response = await fetch(`${API_URL}/api/catalog/public/products/${encodeURIComponent(slug)}`, {
      headers: forwarded,
      cache: "no-store",
    });
    const kind = productLoadKind(response.status);
    if (kind !== "found") return { kind, product: null };

    const data: unknown = await response.json();
    return isProductDetail(data) ? { kind, product: data } : { kind: "error", product: null };
  } catch {
    return { kind: "error", product: null };
  }
});
