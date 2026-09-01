"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface GalleryItem {
  id: number;
  title: string;
  tag: string;
  imageUrl: string;
}

// Carrusel horizontal con scroll-snap nativo (sin librería) — 1 card visible
// en mobile, ~2 en tablet, ~3 en desktop, con "peek" del siguiente item para
// insinuar que se puede seguir deslizando. Reemplaza la grilla paginada
// anterior (botón "Ver más") por un patrón deslizable con contador, más
// natural en mobile (donde vive la mayoría del tráfico de esta landing).
export default function GalleryCarousel({ items }: { items: GalleryItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollToIndex = (target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(items.length - 1, target));
    const card = track.children[clamped] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  // Deriva el índice actual de la posición real de scroll (en vez de solo
  // llevar la cuenta a mano) — así también se actualiza el contador si el
  // usuario desliza directo con el dedo/mouse, no solo con las flechas.
  const handleScroll = () => {
    const track = trackRef.current;
    const first = track?.children[0] as HTMLElement | undefined;
    if (!track || !first) return;
    const gap = 24; // gap-6
    const step = first.clientWidth + gap;
    const nextIndex = Math.round(track.scrollLeft / step);
    setIndex(Math.max(0, Math.min(items.length - 1, nextIndex)));
  };

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <article
            key={item.id}
            className="glass-card group w-[82%] shrink-0 snap-start overflow-hidden p-4 sm:w-[46%] lg:w-[31%]"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <div className="mt-4">
              <h4 className="text-lg font-medium text-charcoal/90 group-hover:text-blushdark transition-colors">
                {item.title}
              </h4>
              <p className="mt-1 text-xs uppercase tracking-widest text-charcoal/40">{item.tag}</p>
            </div>
          </article>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => scrollToIndex(index - 1)}
            disabled={index === 0}
            aria-label="Trabajo anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-mauve/15 bg-white text-charcoal/60 transition hover:border-mauve/30 hover:text-charcoal disabled:opacity-30 disabled:hover:border-mauve/15 disabled:hover:text-charcoal/60"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs tabular-nums text-charcoal/50">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={() => scrollToIndex(index + 1)}
            disabled={index === items.length - 1}
            aria-label="Siguiente trabajo"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-mauve/15 bg-white text-charcoal/60 transition hover:border-mauve/30 hover:text-charcoal disabled:opacity-30 disabled:hover:border-mauve/15 disabled:hover:text-charcoal/60"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
