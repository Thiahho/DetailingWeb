// Shapes returned by the catalog admin endpoints (backend Modules/Catalog/Admin).
// Enums arrive as integers: see ./enums.ts.

export type CatalogAvailability = 0 | 1;
export type CatalogMediaType = 0 | 1;

export interface CatalogAttributeValue {
  id: number;
  attributeId: number;
  label: string;
  sortOrder: number;
  colorHex: string | null;
}

export interface CatalogAttribute {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  values: CatalogAttributeValue[];
}

export interface CatalogCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  attributeIds: number[];
  productCount?: number;
}

export interface CatalogProductSummary {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  slug: string;
  price: number | null;
  isActive: boolean;
  sortOrder: number;
  activeVariants: number;
  onRequestVariants: number;
  coverUrl: string | null;
}

export interface CatalogVariant {
  id: number;
  sku: string;
  combinationKey: string;
  valueIds: number[];
  availability: CatalogAvailability;
  isActive: boolean;
  // Turned off by hand: product/category saves never reactivate it.
  disabledManually: boolean;
}

export interface CatalogMedia {
  id: number;
  type: CatalogMediaType;
  url: string;
  publicId: string | null;
  attributeValueId: number | null;
  sortOrder: number;
}

export interface CatalogProductDetail {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  sortOrder: number;
  isActive: boolean;
  allowedValueIds: number[];
  variants: CatalogVariant[];
  media: CatalogMedia[];
}
