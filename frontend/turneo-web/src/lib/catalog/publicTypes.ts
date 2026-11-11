// Shapes returned by the anonymous catalog endpoints (backend
// Modules/Catalog/Public, `api/catalog/public/...`). Enums arrive as integers:
// see ./enums.ts.
import type { CatalogAvailability, CatalogMediaType } from "./types";

export interface PublicCategory {
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
}

export interface PublicProductCard {
  slug: string;
  name: string;
  price: number | null;
  imageUrl: string | null;
  categorySlug: string;
  categoryName: string;
}

export interface PublicAttributeValue {
  id: number;
  label: string;
  colorHex: string | null;
  sortOrder: number;
}

export interface PublicAttribute {
  id: number;
  name: string;
  slug: string;
  values: PublicAttributeValue[];
}

export interface PublicVariant {
  id: number;
  sku: string;
  valueIds: number[];
  availability: CatalogAvailability;
}

export interface PublicMedia {
  id: number;
  url: string;
  type: CatalogMediaType;
  attributeValueId: number | null;
}

export interface PublicProductDetail {
  slug: string;
  name: string;
  description: string | null;
  price: number | null;
  categorySlug: string;
  categoryName: string;
  attributes: PublicAttribute[];
  variants: PublicVariant[];
  media: PublicMedia[];
}

// GET api/catalog/public/variants?ids=... — only active, visible variants come back.
export interface PublicVariantStatus {
  id: number;
  sku: string;
  availability: CatalogAvailability;
  productSlug: string;
  productName: string;
  price: number | null;
  categoryName: string;
  values: string[];
}
