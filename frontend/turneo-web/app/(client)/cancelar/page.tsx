"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Clock, AlertTriangle } from "lucide-react";
import { getSiteConfig, DEFAULT_SITE_CONFIG } from "@/src/lib/siteConfig";

interface BookingDetail {
  id: number;
  customerName: string;
  service: string;
  subject: string;
  startDateTime: string;
  status: string;
  cancelledAt?: string;
}

type PageState = "loading" | "confirm" | "cancelled" | "already_cancelled" | "expired" | "error";

// Parseo sin conversión UTC: el backend manda la hora ya en horario de
// Argentina (ver ArgentinaClock), un new Date(iso) directo la corre por la
// timezone del navegador y desfasa la hora mostrada.
function parseLocal(iso: string) {
  const clean = iso.replace("Z", "");
  const [datePart, timePart] = clean.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function formatDateFriendly(iso: string) {
  return parseLocal(iso).toLocaleString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Fecha y hora por separado para el bloque destacado del turno — es el dato
// que más le importa al cliente al decidir si cancela, así que va en grande
// en vez de mezclado en una fila más como el resto de los datos.
function formatAppointmentPieces(iso: string) {
  const date = parseLocal(iso);
  const dateLabel = date.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = date.toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return {
    dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
    timeLabel,
  };
}

function CancelarContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const [state, setState] = useState<PageState>("loading");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [businessName, setBusinessName] = useState(DEFAULT_SITE_CONFIG.businessName);

  useEffect(() => {
    getSiteConfig().then((config) => {
      if (config.businessName) setBusinessName(config.businessName);
    });
  }, []);

  useEffect(() => {
    if (!bookingId) {
      setErrorMsg("No se encontró el ID de la reserva.");
      setState("error");
      return;
    }

    fetch(`/api/bookings/${bookingId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.id) {
          setErrorMsg(data.message || "Reserva no encontrada.");
          setState("error");
          return;
        }
        setBooking(data);
        if (data.status === "Cancelled") {
          setState("already_cancelled");
        } else {
          setState("confirm");
        }
      })
      .catch(() => {
        setErrorMsg("No se pudo cargar la reserva. Intentá de nuevo.");
        setState("error");
      });
  }, [bookingId]);

  const handleCancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setState("cancelled");
      } else if (data.message?.includes("expiró")) {
        setState("expired");
      } else {
        setErrorMsg(data.message || "No se pudo cancelar el turno.");
        setState("error");
      }
    } catch {
      setErrorMsg("Error de conexión. Intentá de nuevo.");
      setState("error");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <h1 className="text-charcoal text-2xl font-semibold tracking-tight">{businessName}</h1>
          <p className="text-charcoal/40 text-sm mt-1">Cancelación de turno</p>
        </div>

        {/* Card */}
        <div className="glass-card overflow-hidden">

          {/* Loading */}
          {state === "loading" && (
            <div className="p-10 flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-mauve/20 border-t-blush rounded-full animate-spin" />
              <p className="text-charcoal/50 text-sm">Cargando reserva...</p>
            </div>
          )}

          {/* Confirm */}
          {state === "confirm" && booking && (() => {
            const { dateLabel, timeLabel } = formatAppointmentPieces(booking.startDateTime);
            return (
              <>
                <div className="bg-champagne/10 border-b border-champagne/20 px-6 py-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-champagne/15 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-champagne" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-charcoal font-semibold text-sm">¿Cancelar este turno?</p>
                    <p className="text-charcoal/40 text-xs mt-0.5">Esta acción no se puede deshacer</p>
                  </div>
                </div>

                <div className="px-6 py-6 space-y-5">
                  <div>
                    <p className="text-charcoal/40 text-xs font-medium uppercase tracking-wide">Reservado por</p>
                    <p className="text-charcoal font-semibold text-base mt-1">{booking.customerName}</p>
                    {booking.subject && (
                      <p className="text-charcoal/60 text-sm mt-0.5">{booking.subject}</p>
                    )}
                  </div>

                  <div className="rounded-xl bg-cream border border-blush/25 px-5 py-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-blush/15 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-blushdark" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-charcoal font-semibold text-sm">{dateLabel}</p>
                      <p className="text-charcoal/60 text-sm mt-0.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                        {timeLabel} hs
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 flex flex-col gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    data-testid="cancel-confirm-button"
                    className="w-full rounded-lg bg-mauve px-6 py-3 text-sm font-semibold text-white transition hover:bg-mauve/85 disabled:opacity-50"
                  >
                    {cancelling ? "Cancelando..." : "Sí, cancelar mi turno"}
                  </button>
                  <a
                    href="/reservar"
                    className="w-full text-center text-charcoal/40 hover:text-charcoal/70 py-2 text-sm transition"
                  >
                    No, mantener mi turno
                  </a>
                </div>
              </>
            );
          })()}

          {/* Cancelled (success) */}
          {state === "cancelled" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center" data-testid="cancel-success">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-charcoal font-semibold text-lg">Turno cancelado</p>
                <p className="text-charcoal/50 text-sm mt-1">Tu turno fue cancelado correctamente. El horario quedó disponible.</p>
              </div>
              <a
                href="/reservar"
                className="mt-2 text-emerald-600 hover:text-emerald-500 text-sm font-medium transition"
              >
                Reservar un nuevo turno →
              </a>
            </div>
          )}

          {/* Already cancelled */}
          {state === "already_cancelled" && booking && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-mauve/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-charcoal/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-charcoal font-semibold text-lg">Ya estaba cancelado</p>
                <p className="text-charcoal/50 text-sm mt-1">
                  Este turno ya fue cancelado{booking.cancelledAt ? ` el ${formatDateFriendly(booking.cancelledAt)}` : ""}.
                </p>
              </div>
              <a
                href="/reservar"
                className="mt-2 text-charcoal/40 hover:text-charcoal/70 text-sm font-medium transition"
              >
                Reservar un nuevo turno →
              </a>
            </div>
          )}

          {/* Expired */}
          {state === "expired" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-mauve/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-charcoal/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-charcoal font-semibold text-lg">Turno expirado</p>
                <p className="text-charcoal/50 text-sm mt-1">Este turno ya pasó y no puede cancelarse.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-charcoal font-semibold text-lg">Algo salió mal</p>
                <p className="text-charcoal/50 text-sm mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

        </div>

        <p className="text-center text-charcoal/30 text-xs mt-6">
          ¿Necesitás ayuda? Contactanos por WhatsApp.
        </p>
      </div>
    </div>
  );
}

export default function CancelarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-mauve/20 border-t-blush rounded-full animate-spin" />
      </div>
    }>
      <CancelarContent />
    </Suspense>
  );
}
