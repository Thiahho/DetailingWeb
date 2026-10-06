"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import ReviewSubmitForm from "./ReviewSubmitForm";
import Reveal from "./Reveal";
import SocialCaptures from "./reviews/SocialCaptures";
import { DEMO_GOOGLE_REVIEWS, DEMO_REVIEWS_ENABLED, DEMO_SOCIAL_CAPTURES } from "./reviews/demoReviews";

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

// Amarillo de las estrellas de Google y colores de los avatares con inicial
// que Google pone a quien no tiene foto: las reseñas vienen de Maps, así que
// la card se parece a la de Maps para que se reconozca el origen de un vistazo.
const GOOGLE_STAR = "#FBBC04";
const GOOGLE_STAR_EMPTY = "#E3E3E3";
const AVATAR_COLORS = ["#7B1FA2", "#00897B", "#C2185B", "#5C6BC0", "#EF6C00", "#455A64"];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Google" className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function Stars({ rating, size = 15, google = false }: { rating: number; size?: number; google?: boolean }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-0.5 text-champagne" aria-label={`${rating} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (!google) {
          return <Star key={i} size={size} fill={i < filled ? "currentColor" : "none"} strokeWidth={1.6} />;
        }
        const color = i < filled ? GOOGLE_STAR : GOOGLE_STAR_EMPTY;
        return <Star key={i} size={size} fill={color} stroke={color} strokeWidth={1.6} />;
      })}
    </div>
  );
}

export default function ReviewsSection({ nativeReviews, googleReviews }: ReviewsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false);

  // Etapa de pruebas: mientras el salón no tenga reseñas reales de Google, se
  // muestran las de ejemplo (ver reviews/demoReviews.ts). Nunca se mezclan.
  const showingDemo = DEMO_REVIEWS_ENABLED && googleReviews.length === 0;
  const shownGoogleReviews = showingDemo ? DEMO_GOOGLE_REVIEWS : googleReviews;
  const captures = showingDemo ? DEMO_SOCIAL_CAPTURES : [];

  // Reseñas propias primero (curadas manualmente por orden), después las de Google.
  const combined = [
    ...nativeReviews.map((r) => ({
      key: `native-${r.id}`,
      rating: r.rating,
      text: r.comment,
      author: r.authorName || "Cliente",
      source: "Reseña en el sitio",
      photo: null as string | null,
      google: false,
    })),
    ...shownGoogleReviews.map((r, i) => ({
      key: `google-${r.time}-${i}`,
      rating: r.rating,
      text: r.text,
      author: r.authorName,
      source: r.relativeTimeDescription,
      photo: r.profilePhotoUrl,
      google: true,
    })),
  ];
  const total = combined.length;
  const googleCount = shownGoogleReviews.length;
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
          <div className="flex items-center gap-4" data-testid="reviews-summary">
            <span className="text-5xl font-semibold leading-none tracking-tight text-charcoal md:text-[3.4rem]">
              {average.toFixed(1).replace(".", ",")}
            </span>
            <span className="flex flex-col gap-1.5">
              <Stars rating={average} size={18} google={googleCount > 0} />
              <span className="flex items-center gap-1.5 text-sm text-charcoal/70">
                {googleCount > 0 && <GoogleMark size={14} />}
                {total} {total === 1 ? "reseña" : "reseñas"}
                {googleCount === total && " en Google"}
              </span>
            </span>
          </div>
        )}
      </Reveal>

      {showingDemo && (
        <p
          data-testid="reviews-demo-note"
          className="mx-auto max-w-6xl px-6 text-xs font-semibold uppercase tracking-[0.16em] text-rosewood"
        >
          Contenido de ejemplo — se reemplaza por las reseñas reales de Google Maps
        </p>
      )}

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
                data-source={review.google ? "google" : "site"}
                className="m-0 flex w-[290px] flex-col gap-4 rounded-[1.75rem] bg-ivory p-6 sm:w-[380px] sm:p-7"
              >
                <figcaption className="flex items-center gap-3">
                  {review.photo ? (
                    <img
                      src={review.photo}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-medium text-white"
                      style={{ backgroundColor: avatarColor(review.author) }}
                    >
                      {review.author[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold text-charcoal">{review.author}</span>
                    <span className="truncate text-xs text-charcoal/70">{review.source}</span>
                  </span>
                  {review.google && <GoogleMark size={20} />}
                </figcaption>
                <Stars rating={review.rating} size={16} google={review.google} />
                {review.text && (
                  <blockquote className="m-0 text-base leading-relaxed text-charcoal sm:text-[17px]">{review.text}</blockquote>
                )}
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

      <SocialCaptures captures={captures} />

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
