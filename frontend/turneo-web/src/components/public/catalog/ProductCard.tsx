import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatPrice } from "@/src/lib/catalog/price";
import type { PublicProductCard } from "@/src/lib/catalog/publicTypes";

export function productHref(slug: string) {
  return `/catalogo/producto/${encodeURIComponent(slug)}`;
}

export default function ProductCard({ product }: { product: PublicProductCard }) {
  return (
    <Link
      href={productHref(product.slug)}
      className="glass-card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-blush/40"
    >
      <div className="aspect-square overflow-hidden bg-cream">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-mauve/50">
            <ImageOff size={28} aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-[11px] uppercase tracking-[0.18em] text-mauve">{product.categoryName}</span>
        <h3 className="font-semibold leading-snug text-charcoal">{product.name}</h3>
        <span
          className={`mt-auto pt-2 text-sm font-semibold ${product.price === null ? "text-charcoal/60" : "text-rosewood"}`}
        >
          {formatPrice(product.price)}
        </span>
      </div>
    </Link>
  );
}
