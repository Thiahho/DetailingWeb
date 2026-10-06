"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import ReviewSubmitForm from "./ReviewSubmitForm";
import Reveal from "./Reveal";

export interface NativeReview {
  id: number;
  authorName: string | null;
  rating: number;
  comment: string | null;
}

export interface GoogleReview {
  authorName: string;
  profilePhotoUrl: string | null;
  rating: number;
  relativeTimeDescription: string;
  text: string;
  time: number;
}

interface ReviewsSectionProps {
  nativeReviews: NativeReview[];
  googleReviews: GoogleReview[];
}

const AUTO_ADVANCE_MS = 4500;

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-0.5 text-champagne" aria-label={`${rating} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} fill={i < filled ? "currentColor" : "none"} strokeWidth={1.6} />
      ))}
    </div>
  );
}

export default function ReviewsSection({ nativeReviews, googleReviews }: ReviewsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false);

  // Reseñas propias primero (curadas manualmente por orden), después las de Google.
  const combined = [
    ...nativeReviews.map((r) => ({
      key: `native-${r.id}`,
      rating: r.rating,
      text: r.comment,
      author: r.authorName || "Cliente",
      source: "Reseña en el sitio",
      photo: null as string | null,
    })),
    ...googleReviews.map((r, i) => ({
      key: `google-${r.time}-${i}`,
      rating: r.rating,
      text: r.text,
      author: r.authorName,
      source: `Reseña de Google · ${r.relativeTimeDescription}`,
      photo: r.profilePhotoUrl,
    })),
  ];
  const total = combined.length;
  const average = total > 0 ? combined.reduce((sum, r) => sum + r.rating, 0) / total : 0;

  // Se mueve a mano (flechas, dedo, trackpad) en los dos sentidos y da la
  // vuelta en los extremos.
  const move = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? 320) + 20;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    if (dir > 0 && atEnd) track.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir < 0 && track.scrollLeft <= 4) track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
    else track.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  // Avance automático: solo si la fila desborda, está en pantalla y nadie la
  // está usando (mouse, foco o dedo encima).
  useEffect(() => {
    const track = trackRef.current;
    if (!track || total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const rect = track.getBoundingClientRect();
      const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
      if (holdRef.current || !onScreen || track.scrollWidth <= track.clientWidth + 4) return;
      move(1);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [total]);

  const hold = (value: boolean) => () => {
    holdRef.current = value;
  };

  return (
    <section id="resenas" className="scroll-mt-20 space-y-10 bg-porcelain py-20 md:space-y-12 md:py-28">
      <Reveal className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-6">
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">Reseñas</span>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-charcoal md:text-[3.25rem]">
            Lo que dicen <span className="accent-serif">quienes ya vinieron</span>
          </h2>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-5xl font-semibold leading-none tracking-tight text-charcoal md:text-[3.4rem]">
              {average.toFixed(1).replace(".", ",")}
            </span>
            <span className="flex flex-col gap-1.5">
              <Stars rating={average} size={18} />
              <span className="text-sm text-charcoal/70">
                {total} {total === 1 ? "reseña" : "reseñas"}
              </span>
            </span>
          </div>
        )}
      </Reveal>

      {total > 0 ? (
        <>
          <div
            ref={trackRef}
            data-testid="reviews-track"
            onMouseEnter={hold(true)}
            onMouseLeave={hold(false)}
            onFocus={hold(true)}
            onBlur={hold(false)}
            onTouchStart={hold(true)}
            onTouchEnd={() => setTimeout(hold(false), 4000)}
            className="snap-row gap-5 px-6 pb-2 [scroll-padding-left:1.5rem] lg:px-[calc((100vw-72rem)/2+1.5rem)] lg:[scroll-padding-left:calc((100vw-72rem)/2+1.5rem)]"
          >
            {combined.map((review) => (
              <figure
                key={review.key}
                className="m-0 flex w-[290px] flex-col gap-4 rounded-[1.75rem] bg-ivory p-6 sm:w-[380px] sm:p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" className="font-serif text-6xl italic leading-[0.6] text-blush">
                    “
                  </span>
                  <Stars rating={review.rating} />
                </div>
                {review.text && (
                  <blockquote className="m-0 text-base leading-relaxed text-charcoal sm:text-[17px]">{review.text}</blockquote>
                )}
                <figcaption className="mt-auto flex items-center gap-3 border-t border-mauve/15 pt-4">
                  {review.photo ? (
                    <img src={review.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-porcelain text-sm font-semibold text-charcoal/70"
                    >
                      {review.author[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-charcoal">{review.author}</span>
                    <span className="truncate text-xs text-charcoal/70">{review.source}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          {total > 1 && (
            <div className="mx-auto flex max-w-6xl justify-center gap-2.5 px-6 md:justify-end">
              <button
                type="button"
                aria-label="Reseñas anteriores"
                onClick={() => move(-1)}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-mauve/40 bg-ivory text-charcoal transition hover:-translate-y-0.5"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Reseñas siguientes"
                onClick={() => move(1)}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ink text-cream transition hover:-translate-y-0.5"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="mx-auto max-w-6xl px-6 text-charcoal/70">
          Todavía no hay reseñas — sé la primera persona en dejar tu opinión.
        </p>
      )}

      <div className="mx-auto max-w-6xl px-6">
        {showForm ? (
          <div className="mx-auto max-w-md">
            <ReviewSubmitForm />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="min-h-[48px] rounded-full border border-mauve/40 px-6 text-sm font-semibold text-charcoal transition hover:border-mauve/80"
          >
            Dejanos tu opinión
          </button>
        )}
      </div>
    </section>
  );
}
