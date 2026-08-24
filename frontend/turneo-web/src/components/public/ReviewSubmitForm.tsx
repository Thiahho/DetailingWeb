"use client";

import { useState } from "react";

export default function ReviewSubmitForm() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError("Elegí una calificación de 1 a 5 estrellas.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim() || null,
          rating,
          comment: comment.trim() || null,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("No se pudo enviar tu reseña. Intentá de nuevo en unos minutos.");
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo en unos minutos.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="glass-card space-y-2 p-6 text-center">
        <h4 className="text-lg font-semibold text-charcoal">¡Gracias por tu opinión!</h4>
        <p className="text-charcoal/60 text-sm">
          Tu reseña quedó enviada y se va a publicar apenas la revisemos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card space-y-4 p-6">
      <div className="text-center space-y-2">
        <p className="text-charcoal/70 text-sm">¿Cómo fue tu experiencia?</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`${value} estrellas`}
              className="text-4xl leading-none transition hover:scale-110"
            >
              {value <= (hoverRating || rating) ? "★" : "☆"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
          Tu nombre (opcional)
        </label>
        <input
          className="form-input mt-1.5"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="María López"
          maxLength={100}
        />
      </div>

      <div>
        <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
          Comentario (opcional)
        </label>
        <textarea
          className="form-input mt-1.5 min-h-24"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Contanos qué te pareció"
          maxLength={1000}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
      >
        {submitting ? "Enviando..." : "Enviar reseña"}
      </button>
    </form>
  );
}
