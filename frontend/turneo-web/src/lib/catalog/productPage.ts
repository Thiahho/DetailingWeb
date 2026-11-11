// Pure helpers of the public product page (app/(public)/catalogo/producto/[slug]):
// how a backend answer maps to the page outcome, and the metadata of a product.
import { MEDIA_VIDEO } from "./enums";
import type { PublicMedia, PublicProductDetail } from "./publicTypes";

export type ProductLoadKind = "found" | "notFound" | "error";

// A flat shape instead of a discriminated union: the project compiles with
// `strict: false`, where the union does not narrow. `product` is set only when found.
export interface ProductLoad {
  kind: ProductLoadKind;
  product: PublicProductDetail | null;
}

// Only a 404 means the product does not exist: any other failure (rate limit,
// server error) must not turn into a "not found" page.
export function productLoadKind(status: number): ProductLoadKind {
  if (status === 200) return "found";
  if (status === 404) return "notFound";
  return "error";
}

export function isProductDetail(data: unknown): data is PublicProductDetail {
  if (!data || typeof data !== "object") return false;
  const body = data as Partial<PublicProductDetail>;
  return (
    typeof body.slug === "string" &&
    typeof body.name === "string" &&
    Array.isArray(body.attributes) &&
    Array.isArray(body.variants) &&
    Array.isArray(body.media)
  );
}

// Search engines cut descriptions around this length.
export const META_DESCRIPTION_MAX = 160;

// Same image the root layout uses for the site.
export const FALLBACK_OG_IMAGE = "/img/og.jpg";

export function productMetaDescription(product: Pick<PublicProductDetail, "name" | "description">): string {
  const text = (product.description ?? "").replace(/\s+/g, " ").trim();
  if (text === "") return `${product.name} en nuestro catálogo. Hacé tu pedido por WhatsApp.`;
  if (text.length <= META_DESCRIPTION_MAX) return text;

  const cut = text.slice(0, META_DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function productOpenGraphImage(media: PublicMedia[]): string | null {
  return media.find((m) => m.type !== MEDIA_VIDEO)?.url ?? null;
}

// Open Graph and Twitter are replaced as a whole by a page (Next.js does not
// merge them with the root layout), so both repeat what they need. No canonical
// URL: the site URL env var is not tenant-specific.
export function buildProductMetadata(product: PublicProductDetail) {
  const description = productMetaDescription(product);
  const image = productOpenGraphImage(product.media) ?? FALLBACK_OG_IMAGE;
  return {
    title: product.name,
    description,
    openGraph: {
      type: "website" as const,
      locale: "es_AR",
      title: product.name,
      description,
      images: [{ url: image, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: product.name,
      description,
      images: [image],
    },
  };
}
