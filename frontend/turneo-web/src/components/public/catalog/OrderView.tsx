"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImageOff, ShoppingBag, Trash2 } from "lucide-react";
import AvailabilityBadge from "@/src/components/public/catalog/AvailabilityBadge";
import OrderForm from "@/src/components/public/catalog/OrderForm";
import { productHref } from "@/src/components/public/catalog/ProductCard";
import { useCart } from "@/src/hooks/useCart";
import { MAX_QTY, cartTotals, lineSubtotal, totalUnits } from "@/src/lib/catalog/cart";
import { formatPrice } from "@/src/lib/catalog/price";
import { fetchOrderSettings, fetchVariantStatuses, type OrderSettings } from "@/src/lib/catalog/publicApi";

// /pedido: cart review + contact form that opens the order in WhatsApp.
export default function OrderView() {
  const { items, ready, setQty, remove, sync } = useCart();
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState<OrderSettings | null | undefined>(undefined);
  const synced = useRef(false);

  useEffect(() => {
    fetchOrderSettings().then(setSettings);
  }, []);

  // On entry, prune variants that are no longer in the catalog and refresh names and prices.
  useEffect(() => {
    if (!ready || synced.current || items.length === 0) return;
    synced.current = true;
    fetchVariantStatuses(items.map((i) => i.variantId)).then((statuses) => {
      if (!statuses) return;
      const removed = sync(statuses);
      if (removed > 0) {
        setNotice(
          removed === 1
            ? "Quitamos 1 producto que ya no está disponible en el catálogo."
            : `Quitamos ${removed} productos que ya no están disponibles en el catálogo.`
        );
      }
    });
  }, [ready, items, sync]);

  const { total, pricedLines, unpricedLines } = cartTotals(items);
  const units = totalUnits(items);

  return (
    <main className="min-h-screen bg-cream px-4 py-10 text-charcoal sm:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="space-y-3">
          <span className="badge">Pedido</span>
          <h1 className="text-4xl font-semibold tracking-tight">
            Tu <span className="accent-serif text-rosewood">pedido</span>
          </h1>
        </header>

        {notice && (
          <p role="status" className="mt-6 rounded-xl border border-champagne/40 bg-champagne/10 px-4 py-3 text-sm text-charcoal">
            {notice}
          </p>
        )}

        {!ready ? (
          <div className="glass-card mt-8 h-40 animate-pulse bg-mauve/5" />
        ) : items.length === 0 ? (
          <div className="glass-card mt-8 flex flex-col items-center gap-3 px-6 py-14 text-center">
            <ShoppingBag className="text-mauve" size={32} aria-hidden />
            <p className="font-medium">Tu pedido está vacío</p>
            <p className="text-sm text-charcoal/60">Elegí productos del catálogo y armá tu pedido.</p>
            <Link href="/catalogo" className="mt-2 rounded-full bg-blush px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5">
              Ir al catálogo
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <section aria-labelledby="order-items">
              <h2 id="order-items" className="sr-only">
                Productos
              </h2>
              <ul className="glass-card divide-y divide-mauve/10">
                {items.map((item) => {
                  const subtotal = lineSubtotal(item);
                  return (
                    <li key={item.variantId} className="flex gap-4 p-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-mauve/50">
                            <ImageOff size={20} aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <div className="min-w-0">
                            <Link href={productHref(item.productSlug)} className="font-medium transition hover:text-rosewood">
                              {item.productName}
                            </Link>
                            {item.valuesLabel && <p className="text-sm text-charcoal/60">{item.valuesLabel}</p>}
                          </div>
                          <span className={`text-sm font-semibold ${subtotal === null ? "text-charcoal/60" : "text-rosewood"}`}>
                            {formatPrice(subtotal)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <AvailabilityBadge availability={item.availability} />
                          <div className="flex items-center gap-2">
                            {item.price !== null && item.qty > 1 && (
                              <span className="hidden text-xs text-charcoal/50 sm:inline">{formatPrice(item.price)} c/u</span>
                            )}
                            <label className="sr-only" htmlFor={`qty-${item.variantId}`}>
                              Cantidad de {item.productName}
                            </label>
                            <input
                              id={`qty-${item.variantId}`}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={MAX_QTY}
                              value={item.qty}
                              onChange={(e) => setQty(item.variantId, Number(e.target.value))}
                              className="h-10 w-20 rounded-full border border-mauve/20 bg-white text-center text-sm tabular-nums focus:border-blush focus:outline-none"
                            />
                            <button
                              type="button"
                              aria-label={`Quitar ${item.productName}`}
                              onClick={() => remove(item.variantId)}
                              className="grid h-10 w-10 place-items-center rounded-full text-charcoal/50 transition hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="glass-card mt-4 space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between text-charcoal/70">
                  <span>
                    {items.length} {items.length === 1 ? "producto" : "productos"} · {units} {units === 1 ? "unidad" : "unidades"}
                  </span>
                  <Link href="/catalogo" className="text-rosewood underline-offset-4 hover:underline">
                    Seguir comprando
                  </Link>
                </div>
                {pricedLines > 0 && (
                  <div className="flex items-center justify-between border-t border-mauve/10 pt-2 text-base font-semibold">
                    <span>{unpricedLines > 0 ? "Total de productos con precio" : "Total"}</span>
                    <span className="text-rosewood">{formatPrice(total)}</span>
                  </div>
                )}
                {unpricedLines > 0 && (
                  <p className="text-charcoal/60">Algunos productos se cotizan por WhatsApp: el negocio te confirma el precio.</p>
                )}
              </div>
            </section>

            {settings === undefined ? (
              <div className="glass-card h-80 animate-pulse bg-mauve/5" />
            ) : (
              <OrderForm items={items} settings={settings} onCartChanged={setNotice} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
