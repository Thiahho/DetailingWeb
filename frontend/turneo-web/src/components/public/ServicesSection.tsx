"use client";

import { useState } from "react";
import Reveal from "@/src/components/public/Reveal";

export interface PublicService {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string | null;
  imageUrl: string;
  description: string;
  details: string[];
  category?: string | null;
  customFieldsSchema?: string;
}

const PAGE_SIZE = 6;
const ALL = "Todos";

interface ServicesSectionProps {
  services: PublicService[];
  onBook: (slug: string) => void;
  onDetail: (service: PublicService) => void;
}

export default function ServicesSection({ services, onBook, onDetail }: ServicesSectionProps) {
  const [category, setCategory] = useState(ALL);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // El filtro solo aparece si el negocio cargó más de una categoría.
  const categories = Array.from(new Set(services.map((s) => s.category?.trim()).filter((c): c is string => !!c)));
  const showFilter = categories.length > 1;
  const filtered = category === ALL ? services : services.filter((s) => s.category?.trim() === category);
  const shown = filtered.slice(0, visible);

  return (
    <section id="servicios" className="scroll-mt-20 mx-auto max-w-6xl space-y-10 px-6 py-20 md:space-y-12 md:py-28">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">Servicios</span>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-charcoal md:text-[3.25rem]">
            Servicios <span className="accent-serif">disponibles</span>
          </h2>
        </div>
        {showFilter && (
          <div className="snap-row -mx-6 max-w-[calc(100%+3rem)] gap-2 px-6 md:mx-0 md:max-w-full md:flex-wrap md:px-0">
            {[ALL, ...categories].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  setVisible(PAGE_SIZE);
                }}
                className={`min-h-[44px] whitespace-nowrap rounded-full border px-5 text-sm font-semibold transition-colors ${
                  category === c
                    ? "border-ink bg-ink text-cream"
                    : "border-mauve/35 text-charcoal hover:border-mauve/70"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal
        stagger
        className="snap-row -mx-6 gap-4 px-6 pb-3 [scroll-padding-left:1.5rem] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-7"
      >
        {shown.map((pack) => (
          // El wrapper es lo que anima Reveal; el hover vive en el <article>.
          <div key={pack.id} className="w-[min(19rem,82vw)] sm:w-auto">
            <article
              data-testid="reservar-service-card"
              className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-ivory shadow-soft transition duration-500 ease-out [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:shadow-elevated"
            >
              <div className="relative h-52 overflow-hidden bg-porcelain">
                {pack.imageUrl && (
                  <img
                    src={pack.imageUrl}
                    alt={pack.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-out [@media(hover:hover)]:group-hover:scale-105"
                  />
                )}
                {pack.category && (
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-charcoal/80">
                    {pack.category}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3.5 p-6">
                <h3 className="text-[1.35rem] font-semibold tracking-tight text-charcoal">{pack.title}</h3>
                {pack.details?.length > 0 && (
                  <ul className="space-y-1.5 text-sm text-charcoal/70">
                    {pack.details.slice(0, 3).map((detail, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-champagne" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex items-end justify-between gap-3 border-t border-mauve/15 pt-4">
                  <span className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-widest text-charcoal/60">
                      {pack.duration || "Precio"}
                    </span>
                    <span className="text-xl font-semibold text-charcoal">${pack.price}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDetail(pack)}
                      className="min-h-[46px] rounded-full px-2 text-sm font-medium text-charcoal/70 underline-offset-4 transition hover:text-charcoal hover:underline"
                    >
                      Detalle
                    </button>
                    <button
                      type="button"
                      onClick={() => onBook(pack.slug)}
                      className="min-h-[46px] whitespace-nowrap rounded-full bg-ink px-5 text-sm font-semibold text-cream transition hover:-translate-y-0.5"
                    >
                      Reservar <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                    </button>
                  </span>
                </div>
              </div>
            </article>
          </div>
        ))}
      </Reveal>

      {visible < filtered.length && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="min-h-[48px] rounded-full border border-mauve/35 px-8 text-sm font-semibold text-charcoal transition hover:border-mauve/70"
          >
            Ver más servicios ({filtered.length - visible} restantes)
          </button>
        </div>
      )}
    </section>
  );
}
