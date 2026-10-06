"use client";

import { useState } from "react";
import FeaturedContent, { type FeaturedVideo } from "@/src/components/public/FeaturedContent";
import Reveal from "@/src/components/public/Reveal";

export interface GalleryItem {
  id: number;
  title: string;
  tag: string;
  imageUrl: string;
}

type Tab = "Todo" | "Fotos" | "Reels";

// La cinta necesita contenido de sobra para llenar pantallas anchas: con pocas
// fotos se repite la lista hasta llegar a este mínimo.
const MIN_MARQUEE_ITEMS = 8;

interface WorkSectionProps {
  gallery: GalleryItem[];
  videos: FeaturedVideo[];
  profileUrl?: string;
}

// Galería y Contenido en una sola sección: una cinta de fotos que se mueve
// sola (se pausa con el mouse encima) y, debajo, la cinta de reels, que se
// mueve en sentido contrario.
export default function WorkSection({ gallery, videos, profileUrl }: WorkSectionProps) {
  const [tab, setTab] = useState<Tab>("Todo");
  const hasPhotos = gallery.length > 0;
  const hasReels = videos.length > 0;
  if (!hasPhotos && !hasReels) return null;

  const repeats = hasPhotos ? Math.ceil(MIN_MARQUEE_ITEMS / gallery.length) : 0;
  const strip = Array.from({ length: repeats }, () => gallery).flat();

  const renderTile = (item: GalleryItem, key: string) => (
    <figure key={key} className="group relative m-0 h-64 w-52 shrink-0 overflow-hidden rounded-3xl bg-inksoft sm:h-[22rem] sm:w-72">
      <img
        src={item.imageUrl}
        alt={item.title}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-105"
      />
      {/* Con mouse, el título sube al pasar por encima; en táctil queda visible. */}
      <figcaption className="absolute inset-x-2.5 bottom-2.5 rounded-2xl bg-cream px-3.5 py-2.5 text-charcoal transition-transform duration-500 ease-out [@media(hover:hover)]:translate-y-[130%] [@media(hover:hover)]:group-hover:translate-y-0">
        <span className="block text-sm font-semibold">{item.title}</span>
        {item.tag && <span className="block text-[11px] uppercase tracking-widest text-charcoal/70">{item.tag}</span>}
      </figcaption>
    </figure>
  );

  return (
    <section id="trabajos" className="scroll-mt-20 space-y-10 bg-ink py-20 text-cream md:space-y-12 md:py-28">
      <Reveal className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-6">
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blush">
            {hasPhotos && hasReels ? "Galería y contenido" : hasPhotos ? "Galería" : "Contenido"}
          </span>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-[3.25rem]">
            Nuestro trabajo, <span className="accent-serif text-blush">de cerca</span>
          </h2>
        </div>
        {hasPhotos && hasReels && (
          <div className="flex gap-1 rounded-full border border-cream/15 p-1">
            {(["Todo", "Fotos", "Reels"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition-colors duration-300 ${
                  tab === t ? "bg-cream text-ink" : "text-mist hover:text-cream"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </Reveal>

      {hasPhotos && tab !== "Reels" && (
        <div className="marquee-wrap animate-pane overflow-hidden">
          <div className="flex w-max animate-marquee gap-4 pr-4 sm:gap-5 sm:pr-5">
            {strip.map((item, i) => renderTile(item, `a-${i}`))}
            {/* Segunda copia idéntica: es lo que hace invisible el reinicio de la cinta. */}
            <div aria-hidden="true" className="flex gap-4 sm:gap-5">
              {strip.map((item, i) => renderTile(item, `b-${i}`))}
            </div>
          </div>
        </div>
      )}

      {hasReels && tab !== "Fotos" && (
        <div className="animate-pane">
          <FeaturedContent videos={videos} profileUrl={profileUrl} />
        </div>
      )}
    </section>
  );
}
