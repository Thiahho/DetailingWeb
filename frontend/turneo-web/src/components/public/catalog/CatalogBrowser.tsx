"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import ProductCard from "@/src/components/public/catalog/ProductCard";
import { fetchPublicCategories, fetchPublicProducts } from "@/src/lib/catalog/publicApi";
import type { PublicCategory, PublicProductCard } from "@/src/lib/catalog/publicTypes";

export function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-card aspect-[3/4] animate-pulse bg-mauve/5" />
      ))}
    </div>
  );
}

// /catalogo?categoria=<slug>: category chips + product grid.
export default function CatalogBrowser() {
  const categorySlug = useSearchParams().get("categoria") ?? "";
  const [categories, setCategories] = useState<PublicCategory[] | null>(null);
  const [products, setProducts] = useState<PublicProductCard[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPublicCategories().then((res) => {
      setCategories(res.ok && Array.isArray(res.data) ? res.data : []);
      if (!res.ok) setError(res.message);
    });
  }, []);

  useEffect(() => {
    let active = true;
    setProducts(null);
    fetchPublicProducts(categorySlug || undefined).then((res) => {
      if (!active) return;
      setProducts(res.ok && Array.isArray(res.data) ? res.data : []);
      if (!res.ok) setError(res.message);
    });
    return () => {
      active = false;
    };
  }, [categorySlug]);

  const current = categories?.find((c) => c.slug === categorySlug);
  const chip = (selected: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm transition ${
      selected
        ? "border-charcoal bg-charcoal text-cream"
        : "border-mauve/20 bg-white text-charcoal/70 hover:border-blush hover:text-charcoal"
    }`;

  return (
    <main className="min-h-screen bg-cream px-4 py-12 text-charcoal sm:px-6 md:py-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <span className="badge">Catálogo</span>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {current ? current.name : <>Nuestros <span className="accent-serif text-rosewood">productos</span></>}
          </h1>
          <p className="max-w-2xl text-charcoal/70">
            {current?.description ||
              "Armá tu pedido y envialo por WhatsApp. Te respondemos para coordinar el pago y la entrega."}
          </p>
        </header>

        {categories && categories.length > 1 && (
          <nav aria-label="Categorías" className="snap-row -mx-4 gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Link href="/catalogo" scroll={false} className={chip(categorySlug === "")} aria-current={categorySlug === "" ? "page" : undefined}>
              Todo
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/catalogo?categoria=${encodeURIComponent(c.slug)}`}
                scroll={false}
                className={chip(c.slug === categorySlug)}
                aria-current={c.slug === categorySlug ? "page" : undefined}
              >
                {c.name}
                <span className="ml-1.5 text-xs opacity-60">{c.productCount}</span>
              </Link>
            ))}
          </nav>
        )}

        {products === null ? (
          <CatalogSkeleton />
        ) : products.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <ShoppingBag className="text-mauve" size={32} aria-hidden />
            <p className="font-medium">{error || "Todavía no hay productos para mostrar."}</p>
            {categorySlug && (
              <Link href="/catalogo" className="text-sm text-rosewood underline-offset-4 hover:underline">
                Ver todo el catálogo
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
