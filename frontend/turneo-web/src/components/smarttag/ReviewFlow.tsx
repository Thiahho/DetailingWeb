"use client";

import { useState } from "react";

interface ReviewFlowProps {
  token: string;
}

export default function ReviewFlow({ token }: ReviewFlowProps) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRate = async (value: number) => {
    setRating(value);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/smart/${token}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
      }
    } catch {
      // Igual mostramos el agradecimiento — no hay nada más que el cliente pueda hacer acá.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="glass-card space-y-2 p-6 text-center">
        <h3 className="text-xl font-bold text-charcoal">¡Gracias por tu opinión!</h3>
        <p className="text-charcoal/60 text-sm">Tu valoración nos ayuda a mejorar.</p>
      </div>
    );
  }

  return (
    <div className="glass-card space-y-4 p-6 text-center">
      <p className="text-charcoal/70 text-sm">¿Cómo fue tu experiencia?</p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={submitting}
            onClick={() => handleRate(value)}
            aria-label={`${value} estrellas`}
            className="text-4xl leading-none transition hover:scale-110 disabled:opacity-50"
          >
            {value <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
    </div>
  );
}
