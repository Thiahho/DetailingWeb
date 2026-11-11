"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  addItem,
  applyVariants,
  cartStorageKey,
  deserializeCart,
  removeItem,
  serializeCart,
  setItemQty,
  type CartItem,
} from "@/src/lib/catalog/cart";
import type { PublicVariantStatus } from "@/src/lib/catalog/publicTypes";

// Public catalog cart shared by the navbar badge, the product page and
// /pedido. One module-level store per tab, persisted in localStorage under a
// key per tenant host (src/lib/catalog/cart.ts) and kept in sync across tabs
// through the `storage` event. The cart is what the visitor asked for (the
// order itself), so it is not gated by the "preferences" consent like the
// public data cache.

const EMPTY: CartItem[] = [];
let items: CartItem[] = EMPTY;
let loadedKey: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function readStorage(key: string): CartItem[] {
  try {
    return deserializeCart(localStorage.getItem(key), Date.now());
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  const key = cartStorageKey(window.location.host);
  if (loadedKey === key) return;
  loadedKey = key;
  items = readStorage(key);
}

function commit(next: CartItem[]) {
  ensureLoaded();
  items = next;
  try {
    if (next.length === 0) localStorage.removeItem(loadedKey!);
    else localStorage.setItem(loadedKey!, serializeCart(next, Date.now()));
  } catch {
    // Private mode or full quota: the cart still works for this tab.
  }
  notify();
}

function onStorage(event: StorageEvent) {
  if (loadedKey && event.key === loadedKey) {
    items = deserializeCart(event.newValue, Date.now());
    notify();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): CartItem[] {
  ensureLoaded();
  return items;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

export const cartActions = {
  add: (item: CartItem, qty: number) => commit(addItem(getSnapshot(), item, qty)),
  setQty: (variantId: number, qty: number) => commit(setItemQty(getSnapshot(), variantId, qty)),
  remove: (variantId: number) => commit(removeItem(getSnapshot(), variantId)),
  clear: () => commit(EMPTY),
  // Returns how many lines were dropped because their variant is no longer available.
  sync: (statuses: PublicVariantStatus[]): number => {
    const before = getSnapshot();
    const next = applyVariants(before, statuses);
    commit(next);
    return before.length - next.length;
  },
};

export function useCart() {
  const cartItems = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // false during SSR and the hydration pass, when the stored cart is not read yet.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return { items: cartItems, ready, ...cartActions };
}
