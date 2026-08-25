"use client";

import { useState, type FormEvent } from "react";
import BookingForm from "@/src/components/booking/BookingForms";

interface RebookFlowProps {
  token: string;
  tenantSlug: string;
}

interface LastBooking {
  service: string | null;
  subject: string;
  startDateTime: string;
}

// Parseo sin conversión UTC para respetar la hora local del negocio — mismo
// criterio que formatDateTime en app/api/bookings/route.ts.
function formatDateTime(iso: string): string {
  const clean = iso.replace("Z", "");
  const [datePart, timePart] = clean.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = (timePart ?? "00:00").split(":").map(Number);
  const date = new Date(y, m - 1, d, h, min);
  return date.toLocaleString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RebookFlow({ token, tenantSlug }: RebookFlowProps) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lastBooking, setLastBooking] = useState<LastBooking | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setSearching(true);
    try {
      const res = await fetch(
        `/api/bookings/by-email?email=${encodeURIComponent(email)}&tenantSlug=${encodeURIComponent(tenantSlug)}`
      );
      const data = res.ok ? await res.json() : [];
      setLastBooking(Array.isArray(data) && data.length > 0 ? data[0] : null);
    } catch {
      setLastBooking(null);
    } finally {
      setSearched(true);
      setSearching(false);
    }
  };

  if (showForm) {
    return <BookingForm tenantSlugOverride={tenantSlug} smartTagToken={token} />;
  }

  return (
    <div className="glass-card space-y-4 p-6">
      {!searched && (
        <form onSubmit={handleSearch} className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">
              ¿Ya fuiste cliente? Ingresá tu email
            </label>
            <input
              type="email"
              className="form-input mt-2"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.01] disabled:opacity-50"
          >
            {searching ? "Buscando..." : "Buscar mi último turno"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full text-center text-xs text-charcoal/50 hover:text-charcoal underline"
          >
            Prefiero reservar directamente
          </button>
        </form>
      )}

      {searched && (
        <div className="space-y-4">
          {lastBooking ? (
            <div className="rounded-xl border border-mauve/15 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-charcoal/40">Tu turno más reciente</p>
              <p className="text-charcoal font-medium mt-1">{lastBooking.service ?? lastBooking.subject}</p>
              <p className="text-charcoal/50 text-sm mt-0.5">{formatDateTime(lastBooking.startDateTime)}</p>
            </div>
          ) : (
            <p className="text-charcoal/50 text-sm">No encontramos turnos con ese email.</p>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.01]"
          >
            {lastBooking ? "Reservar de nuevo" : "Reservar"}
          </button>
          <button
            onClick={() => {
              setSearched(false);
              setEmail("");
            }}
            className="w-full text-center text-xs text-charcoal/50 hover:text-charcoal underline"
          >
            Buscar con otro email
          </button>
        </div>
      )}
    </div>
  );
}
