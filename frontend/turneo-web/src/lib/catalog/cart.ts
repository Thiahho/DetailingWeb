// Pure cart logic for the public catalog. The cart lives only in the browser
// (orders are not persisted): src/hooks/useCart.ts stores it in localStorage
// under a key per tenant host, so two businesses opened in the same browser
// never share a cart.
import type { CatalogAvailability } from "./types";
import type { PublicVariantStatus } from "./publicTypes";

export const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MAX_QTY = 999;
const STORAGE_PREFIX = "turneo-cart";

export interface CartItem {
  variantId: number;
  productSlug: string;
  productName: string;
  categoryName: string;
  // Chosen values in the category's attribute order, e.g. "M / Rojo"; empty for products without attributes.
  valuesLabel: string;
  availability: CatalogAvailability;
  price: number | null;
  imageUrl: string | null;
  qty: number;
}

export function cartStorageKey(host: string): string {
  return `${STORAGE_PREFIX}:${host}`;
}

export function clampQty(qty: number): number {
  return Math.min(MAX_QTY, Math.max(1, Math.floor(qty) || 1));
}

// Adding a variant already in the cart sums the quantity and refreshes its data.
export function addItem(items: CartItem[], incoming: CartItem, qty: number): CartItem[] {
  const existing = items.find((i) => i.variantId === incoming.variantId);
  if (existing) {
    return items.map((i) =>
      i.variantId === incoming.variantId ? { ...i, ...incoming, qty: clampQty(i.qty + qty) } : i
    );
  }
  return [...items, { ...incoming, qty: clampQty(qty) }];
}

export function setItemQty(items: CartItem[], variantId: number, qty: number): CartItem[] {
  return items.map((i) => (i.variantId === variantId ? { ...i, qty: clampQty(qty) } : i));
}

export function removeItem(items: CartItem[], variantId: number): CartItem[] {
  return items.filter((i) => i.variantId !== variantId);
}

export function totalUnits(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

export function lineSubtotal(item: CartItem): number | null {
  return item.price === null ? null : item.price * item.qty;
}

// Total of the priced lines only; unpriced lines are quoted over WhatsApp.
export function cartTotals(items: CartItem[]): { total: number; pricedLines: number; unpricedLines: number } {
  let total = 0;
  let pricedLines = 0;
  for (const item of items) {
    const subtotal = lineSubtotal(item);
    if (subtotal === null) continue;
    total += subtotal;
    pricedLines += 1;
  }
  return { total, pricedLines, unpricedLines: items.length - pricedLines };
}

// Applies the current backend state: variants that are no longer returned
// (inactive, deleted, hidden) are dropped; names, prices and availability are refreshed.
export function applyVariants(items: CartItem[], statuses: PublicVariantStatus[]): CartItem[] {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  return items.flatMap((item) => {
    const s = byId.get(item.variantId);
    if (!s) return [];
    return [
      {
        ...item,
        productSlug: s.productSlug,
        productName: s.productName,
        categoryName: s.categoryName,
        valuesLabel: s.values.join(" / "),
        availability: s.availability,
        price: s.price,
      },
    ];
  });
}

export function serializeCart(items: CartItem[], now: number): string {
  return JSON.stringify({ savedAt: now, items });
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.variantId === "number" &&
    typeof v.productSlug === "string" &&
    typeof v.productName === "string" &&
    typeof v.qty === "number" &&
    (v.price === null || typeof v.price === "number")
  );
}

// Reads what localStorage holds; anything malformed or older than the TTL becomes an empty cart.
export function deserializeCart(raw: string | null, now: number): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown; items?: unknown };
    if (typeof parsed?.savedAt !== "number" || now - parsed.savedAt > CART_TTL_MS) return [];
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isCartItem).map((i) => ({ ...i, qty: clampQty(i.qty) }));
  } catch {
    return [];
  }
}
