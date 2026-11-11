"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Minus, PackageSearch, Plus } from "lucide-react";
import AvailabilityBadge from "@/src/components/public/catalog/AvailabilityBadge";
import ProductGallery from "@/src/components/public/catalog/ProductGallery";
import { useCart } from "@/src/hooks/useCart";
import { MAX_QTY, clampQty } from "@/src/lib/catalog/cart";
import { MEDIA_VIDEO } from "@/src/lib/catalog/enums";
import { formatPrice } from "@/src/lib/catalog/price";
import { fetchPublicProduct } from "@/src/lib/catalog/publicApi";
import type { PublicProductDetail } from "@/src/lib/catalog/publicTypes";
import { findVariant, initialSelection, isValueEnabled, selectValue, selectionLabel, type Selection } from "@/src/lib/catalog/variants";

type LoadState = { kind: "loading" } | { kind: "notFound" } | { kind: "error"; message: string } | { kind: "ready"; product: PublicProductDetail };

// `initialProduct` comes from the server page; without it (the server could not
// load the product) the view fetches it from the browser.
export default function ProductView({ slug, initialProduct = null }: { slug: string; initialProduct?: PublicProductDetail | null }) {
  const [state, setState] = useState<LoadState>(
    initialProduct ? { kind: "ready", product: initialProduct } : { kind: "loading" }
  );

  useEffect(() => {
    if (initialProduct) return;
    let active = true;
    fetchPublicProduct(slug).then((res) => {
      if (!active) return;
      if (res.ok && res.data) setState({ kind: "ready", product: res.data });
      else if (res.status === 404) setState({ kind: "notFound" });
      else setState({ kind: "error", message: res.message });
    });
    return () => {
      active = false;
    };
  }, [slug, initialProduct]);

  return (
    <ProductShell>
      {state.kind === "loading" && (
        <div className="grid gap-8 md:grid-cols-2">
          <div className="glass-card aspect-square animate-pulse bg-mauve/5" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-mauve/10" />
            <div className="h-40 animate-pulse rounded-2xl bg-mauve/5" />
          </div>
        </div>
      )}
      {state.kind === "notFound" && <ProductNotFound />}
      {state.kind === "error" && (
        <div className="glass-card px-6 py-14 text-center">
          <p className="font-medium">{state.message}</p>
          <p className="mt-1 text-sm text-charcoal/60">Probá de nuevo en unos minutos.</p>
        </div>
      )}
      {state.kind === "ready" && <ProductPicker product={state.product} />}
    </ProductShell>
  );
}

// The server page's 404 (not-found.tsx next to it) shows the same view the
// client fallback shows.
export function ProductNotFoundView() {
  return (
    <ProductShell>
      <ProductNotFound />
    </ProductShell>
  );
}

function ProductShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-cream px-4 py-10 text-charcoal sm:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/catalogo" className="mb-6 inline-flex items-center gap-1.5 text-sm text-charcoal/60 transition hover:text-charcoal">
          <ArrowLeft size={16} aria-hidden /> Catálogo
        </Link>
        {children}
      </div>
    </main>
  );
}

function ProductNotFound() {
  return (
    <div className="glass-card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <PackageSearch className="text-mauve" size={36} aria-hidden />
      <h1 className="text-2xl font-semibold">Producto no encontrado</h1>
      <p className="max-w-md text-sm text-charcoal/60">Puede que ya no esté en el catálogo o que el enlace esté incompleto.</p>
      <Link href="/catalogo" className="mt-2 rounded-full bg-blush px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5">
        Ver el catálogo
      </Link>
    </div>
  );
}

function ProductPicker({ product }: { product: PublicProductDetail }) {
  const { attributes, variants } = product;
  const { add } = useCart();
  const [selection, setSelection] = useState<Selection>(() => initialSelection(attributes));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<string | null>(null);

  const variant = useMemo(() => findVariant(attributes, variants, selection), [attributes, variants, selection]);
  const selectedValueIds = Object.values(selection).filter((v): v is number => v !== undefined);
  const missing = attributes.filter((a) => selection[a.id] === undefined).map((a) => a.name.toLowerCase());

  function handleAdd() {
    if (!variant) return;
    const images = product.media.filter((m) => m.type !== MEDIA_VIDEO);
    const image =
      images.find((m) => m.attributeValueId !== null && selectedValueIds.includes(m.attributeValueId)) ??
      images.find((m) => m.attributeValueId === null) ??
      images[0];
    const valuesLabel = selectionLabel(attributes, selection);
    add(
      {
        variantId: variant.id,
        productSlug: product.slug,
        productName: product.name,
        categoryName: product.categoryName,
        valuesLabel,
        availability: variant.availability,
        price: product.price,
        imageUrl: image?.url ?? null,
        qty,
      },
      qty
    );
    setAdded(`${qty} × ${product.name}${valuesLabel ? ` (${valuesLabel})` : ""}`);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <ProductGallery media={product.media} name={product.name} selectedValueIds={selectedValueIds} />

      <div>
        <Link
          href={`/catalogo?categoria=${encodeURIComponent(product.categorySlug)}`}
          className="text-xs uppercase tracking-[0.2em] text-mauve transition hover:text-charcoal"
        >
          {product.categoryName}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{product.name}</h1>
        <p className={`mt-3 text-2xl font-semibold ${product.price === null ? "text-charcoal/60" : "text-rosewood"}`}>
          {formatPrice(product.price)}
        </p>
        {product.description && <p className="mt-4 whitespace-pre-line text-charcoal/70">{product.description}</p>}

        <div className="mt-8 space-y-6">
          {attributes.map((attr) => (
            <fieldset key={attr.id}>
              <legend className="mb-2 text-sm font-medium">
                {attr.name}
                {selection[attr.id] !== undefined && (
                  <span className="ml-2 font-normal text-charcoal/60">
                    {attr.values.find((v) => v.id === selection[attr.id])?.label}
                  </span>
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {attr.values.map((value) => {
                  const selected = selection[attr.id] === value.id;
                  const enabled = isValueEnabled(variants, selection, attr.id, value.id);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={!enabled}
                      onClick={() => {
                        setSelection((s) => selectValue(attributes, variants, s, attr.id, value.id));
                        setAdded(null);
                      }}
                      className={`inline-flex h-11 min-w-12 items-center justify-center gap-2 rounded-full border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush/60 ${
                        selected
                          ? "border-charcoal bg-charcoal text-cream"
                          : "border-mauve/20 bg-white hover:border-blush"
                      } ${!enabled ? "cursor-not-allowed opacity-40 line-through hover:border-mauve/20" : ""}`}
                    >
                      {value.colorHex && (
                        <span aria-hidden className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: value.colorHex }} />
                      )}
                      {value.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="glass-card mt-8 p-5">
          <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
            {variant ? (
              <>
                <span className="text-charcoal/60">{attributes.length > 0 ? "Esta combinación" : "Disponibilidad"}</span>
                <AvailabilityBadge availability={variant.availability} />
              </>
            ) : (
              <span className="text-charcoal/60">
                {variants.length === 0 ? "Este producto no tiene opciones disponibles por ahora." : `Elegí ${missing.join(", ")} para continuar.`}
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <div className="flex items-center rounded-full border border-mauve/20 bg-white">
              <button type="button" aria-label="Restar uno" onClick={() => setQty((q) => clampQty(q - 1))} className="grid h-11 w-11 place-items-center text-charcoal/70 hover:text-charcoal">
                <Minus size={16} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_QTY}
                aria-label="Cantidad"
                value={qty}
                onChange={(e) => setQty(clampQty(Number(e.target.value)))}
                className="h-11 w-12 bg-transparent text-center text-sm tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button type="button" aria-label="Sumar uno" onClick={() => setQty((q) => clampQty(q + 1))} className="grid h-11 w-11 place-items-center text-charcoal/70 hover:text-charcoal">
                <Plus size={16} />
              </button>
            </div>
            <button
              type="button"
              disabled={!variant}
              onClick={handleAdd}
              className="min-h-[44px] flex-1 rounded-full bg-blush px-6 text-sm font-semibold text-ink transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Agregar al pedido
            </button>
          </div>

          {added && (
            <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blush/40 bg-blush/10 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-charcoal">
                <Check size={16} className="text-rosewood" aria-hidden /> Agregaste {added}
              </span>
              <Link href="/pedido" className="font-semibold text-rosewood underline-offset-4 hover:underline">
                Ver pedido
              </Link>
            </div>
          )}
          <p className="mt-3 text-xs text-charcoal/60">
            El pedido se envía por WhatsApp y el negocio te confirma el pago y la entrega.
          </p>
        </div>
      </div>
    </div>
  );
}
