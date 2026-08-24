"use client";

import { useState } from "react";
import ReviewSubmitForm from "./ReviewSubmitForm";

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

function Stars({ rating }: { rating: number }) {
  return (
    <div className="text-champagne text-sm leading-none" aria-label={`${rating} de 5 estrellas`}>
      {"★".repeat(Math.max(0, Math.min(5, rating))) + "☆".repeat(5 - Math.max(0, Math.min(5, rating)))}
    </div>
  );
}

export default function ReviewsSection({ nativeReviews, googleReviews }: ReviewsSectionProps) {
  const [visibleCount, setVisibleCount] = useState(6);
  const [showForm, setShowForm] = useState(false);

  const total = nativeReviews.length + googleReviews.length;
  // Reseñas propias primero (curadas manualmente por orden), después las de Google.
  const combined = [
    ...nativeReviews.map((r) => ({ kind: "native" as const, review: r })),
    ...googleReviews.map((r) => ({ kind: "google" as const, review: r })),
  ];
  const toShow = combined.slice(0, visibleCount);

  return (
    <section id="resenas" className="mx-auto max-w-6xl space-y-10 px-6 py-16">
      <div className="space-y-3">
        <span className="badge">Reseñas</span>
        <h3 className="text-3xl font-semibold text-charcoal">Lo que dicen nuestros clientes</h3>
      </div>

      {total > 0 ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {toShow.map((item, i) =>
              item.kind === "native" ? (
                <article key={`native-${item.review.id}`} className="glass-card space-y-3 p-5">
                  <Stars rating={item.review.rating} />
                  {item.review.comment && (
                    <p className="text-sm text-charcoal/80 leading-relaxed">{item.review.comment}</p>
                  )}
                  <p className="text-xs uppercase tracking-widest text-charcoal/40">
                    {item.review.authorName || "Cliente"}
                  </p>
                </article>
              ) : (
                <article key={`google-${item.review.time}-${i}`} className="glass-card space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Stars rating={item.review.rating} />
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-charcoal/40">
                      Reseña de Google
                    </span>
                  </div>
                  {item.review.text && (
                    <p className="text-sm text-charcoal/80 leading-relaxed">{item.review.text}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {item.review.profilePhotoUrl && (
                      <img
                        src={item.review.profilePhotoUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    )}
                    <p className="text-xs uppercase tracking-widest text-charcoal/40">
                      {item.review.authorName} · {item.review.relativeTimeDescription}
                    </p>
                  </div>
                </article>
              )
            )}
          </div>

          {visibleCount < combined.length && (
            <div className="text-center pt-4">
              <button
                onClick={() => setVisibleCount((c) => c + 6)}
                className="rounded-full border border-mauve/15 bg-white px-8 py-3 text-sm font-medium text-charcoal/70 transition-all hover:border-mauve/30 hover:text-charcoal"
              >
                Ver más reseñas ({combined.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-charcoal/60 text-sm">Todavía no hay reseñas — sé la primera persona en dejar tu opinión.</p>
      )}

      <div className="pt-2">
        {showForm ? (
          <div className="mx-auto max-w-md">
            <ReviewSubmitForm />
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={() => setShowForm(true)}
              className="rounded-full bg-blush/10 border border-blush/40 px-6 py-3 text-sm font-medium text-blushdark hover:bg-blush/20 transition-all"
            >
              Dejanos tu opinión
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
