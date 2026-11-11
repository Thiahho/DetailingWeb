import type { CatalogAttribute } from "./types";

// Returns a copy with the item at `from` moved to `to`; out-of-range moves are no-ops.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items.slice();
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function byOrder<T extends { sortOrder: number; id: number }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

// The category's attributes in its combination order (unknown ids dropped),
// each with its values sorted the way variants combine them.
export function attributesForCategory(attributeIds: number[], attributes: CatalogAttribute[]): CatalogAttribute[] {
  return attributeIds
    .map((id) => attributes.find((a) => a.id === id))
    .filter((a): a is CatalogAttribute => a !== undefined)
    .map((a) => ({ ...a, values: a.values.slice().sort(byOrder) }));
}

// "Rojo / M": the variant's values in the category's attribute order.
export function variantLabel(valueIds: number[], categoryAttributeIds: number[], attributes: CatalogAttribute[]): string {
  const labels: string[] = [];
  for (const attribute of attributesForCategory(categoryAttributeIds, attributes)) {
    const value = attribute.values.find((v) => valueIds.includes(v.id));
    if (value) labels.push(value.label);
  }
  return labels.length > 0 ? labels.join(" / ") : "Única";
}

// Public id of a Cloudinary delivery URL (what the upload widget returns):
// the path after `/upload/`, without transformations, version and extension.
export function cloudinaryPublicId(url: string): string | null {
  const match = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video|raw)\/upload\/(.+)$/);
  if (!match) return null;
  const path = match[1];
  const versioned = path.match(/(?:^|\/)v\d+\/(.+)$/);
  const rest = versioned ? versioned[1] : path;
  return rest.replace(/\.[^/.]+$/, "") || null;
}
