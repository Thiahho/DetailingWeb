"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  subject?: string;
  service?: string;
  message?: string;
  status: string;
}

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  label: string;
  booking?: Booking;
}

const ITEMS_PER_PAGE = 8;

function isExpired(startDateTime: string) {
  return new Date(startDateTime) < new Date();
}

function ProfessionalAgendaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Viene del link del email "nuevo turno agendado" — resalta y hace scroll a ese turno.
  const highlightedBookingId = searchParams.get("bookingId") ? Number(searchParams.get("bookingId")) : null;
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ date: "", hour: "09", minute: "00" });
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [detailSlot, setDetailSlot] = useState<TimeSlot | null>(null);
  useModalHotkeys(!!detailSlot, { onClose: () => setDetailSlot(null) });

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
      return;
    }
    loadSlots();
  }, [router]);

  const [currentPage, setCurrentPage] = useState(1);

  // El turno resaltado puede no estar en la primera página: saltar a la suya.
  useEffect(() => {
    if (loading || !highlightedBookingId) return;
    const index = slots
      .filter((s) => !isExpired(s.startDateTime))
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
      .findIndex((s) => s.booking?.id === highlightedBookingId);
    if (index >= 0) setCurrentPage(Math.floor(index / ITEMS_PER_PAGE) + 1);
    // Solo al terminar la carga inicial — después el usuario pagina libremente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, highlightedBookingId]);

  useEffect(() => {
    if (!loading && highlightedBookingId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightedBookingId, currentPage]);

  const loadSlots = async () => {
    try {
      const res = await fetch("/api/timeslots/mine");
      if (res.ok) {
        setSlots(await res.json());
      } else if (res.status === 401) {
        router.push("/profesional/login");
      }
    } catch (error) {
      logError("Error cargando agenda:", error);
    } finally {
      setLoading(false);
    }
  };

  const createSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const startDateTime = `${formData.date}T${formData.hour}:${formData.minute}:00`;
      let endHour = parseInt(formData.hour) + 1;
      let endDate = formData.date;
      if (endHour >= 24) {
        endHour -= 24;
        const [y, m, d] = formData.date.split("-").map(Number);
        const nextDay = new Date(y, m - 1, d + 1);
        endDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
      }
      const endDateTime = `${endDate}T${String(endHour).padStart(2, "0")}:${formData.minute}:00`;

      const res = await fetch("/api/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDateTime, endDateTime }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Turno creado en tu agenda");
        setFormData((prev) => ({ ...prev, date: "" }));
        loadSlots();
      } else {
        showToast("error", data.message || "No se pudo crear el turno");
      }
    } catch (error) {
      showToast("error", "Error de conexión");
      logError(error);
    } finally {
      setCreating(false);
    }
  };

  const confirmBooking = async (bookingId: number) => {
    const res = await fetch(`/api/bookings/${bookingId}/confirm`, { method: "PATCH" });
    const data = await res.json();
    if (res.ok) {
      setDetailSlot(null);
      showToast("success", "Turno confirmado");
      loadSlots();
    } else {
      showToast("error", data.message || "No se pudo confirmar el turno");
    }
  };

  const releaseSlot = async (id: number) => {
    if (!(await confirm({ message: "¿Liberar este turno? Si tenía una reserva, se cancela.", confirmLabel: "Liberar turno" }))) return;
    const res = await fetch(`/api/timeslots/${id}/release`, { method: "PUT" });
    if (res.ok) {
      setDetailSlot(null);
      showToast("success", "Turno liberado");
      loadSlots();
    } else {
      showToast("error", "No se pudo liberar el turno");
    }
  };

  const deleteSlot = async (id: number) => {
    if (!(await confirm({ message: "¿Eliminar este turno de tu agenda?", confirmLabel: "Eliminar turno" }))) return;
    const res = await fetch(`/api/timeslots/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showToast("success", "Turno eliminado");
      loadSlots();
    } else {
      showToast("error", data.message || "No se pudo eliminar el turno");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando tu agenda...</p>
      </div>
    );
  }

  const upcoming = slots
    .filter((s) => !isExpired(s.startDateTime))
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));

  // Clamp: al eliminar el último turno de una página, se vuelve a la anterior.
  const totalPages = Math.max(1, Math.ceil(upcoming.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const pageSlots = upcoming.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Mi Agenda</h1>
          <p className="text-charcoal/50 text-sm mt-1">Administrá tus propios turnos disponibles y reservas</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          {/* Crear turno */}
          <div className="bg-ivory border border-mauve/10 rounded-xl p-6 h-fit md:sticky md:top-6">
            <h2 className="text-lg font-semibold text-charcoal mb-4">Agregar turno disponible</h2>
            <form onSubmit={createSlot} className="space-y-4">
              <div>
                <label className="text-charcoal/70 text-sm font-medium">Fecha</label>
                <input
                  type="date"
                  data-testid="agenda-form-date"
                  className="w-full mt-2 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition-colors"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/70 text-sm font-medium">Hora inicio</label>
                <div className="flex gap-2 mt-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="HH"
                    data-testid="agenda-form-hour"
                    className="w-20 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal text-center focus:border-green-500 focus:outline-none transition-colors"
                    value={formData.hour}
                    onChange={(e) => setFormData((prev) => ({ ...prev, hour: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                    onBlur={(e) => setFormData((prev) => ({ ...prev, hour: String(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))).padStart(2, "0") }))}
                    required
                  />
                  <span className="text-charcoal/50 text-xl font-bold">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="MM"
                    data-testid="agenda-form-minute"
                    className="w-20 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal text-center focus:border-green-500 focus:outline-none transition-colors"
                    value={formData.minute}
                    onChange={(e) => setFormData((prev) => ({ ...prev, minute: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                    onBlur={(e) => setFormData((prev) => ({ ...prev, minute: String(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))).padStart(2, "0") }))}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                data-testid="agenda-form-submit"
                className="w-full bg-blush hover:bg-blushdark text-white py-3 rounded-lg font-semibold shadow-glow transition disabled:opacity-50"
              >
                {creating ? "Creando..." : "Crear turno"}
              </button>
            </form>
          </div>

          {/* Lista de turnos */}
          <div className="bg-ivory border border-mauve/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-charcoal mb-4">
              Próximos turnos ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-charcoal/40 text-sm py-8 text-center">No tenés turnos cargados todavía.</p>
            ) : (
              <div className="space-y-2">
                {pageSlots.map((slot) => {
                  const isHighlighted = highlightedBookingId != null && slot.booking?.id === highlightedBookingId;
                  return (
                  <div
                    key={slot.id}
                    ref={isHighlighted ? highlightedRef : undefined}
                    data-testid="agenda-slot-item"
                    data-slot-label={slot.label}
                    onClick={() => !slot.isAvailable && slot.booking && setDetailSlot(slot)}
                    className={`p-4 rounded-xl border ${!slot.isAvailable ? "cursor-pointer hover:brightness-95" : ""} ${
                      isHighlighted
                        ? "border-champagne ring-2 ring-champagne/50 bg-champagne/10"
                        : slot.isAvailable
                        ? "border-green-200 bg-green-50"
                        : slot.booking?.status === "Confirmed"
                        ? "border-blue-200 bg-blue-50"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {isHighlighted && (
                            <span className="text-[9px] font-bold bg-champagne/20 text-champagne px-1.5 py-0.5 rounded">NUEVO</span>
                          )}
                          <p className="text-charcoal font-medium text-sm">{slot.label}</p>
                        </div>
                        {!slot.isAvailable && slot.booking && (
                          <p className="text-charcoal/60 text-xs mt-1">
                            {slot.booking.customerName} · {slot.booking.customerPhone}
                            {slot.booking.service && ` · ${slot.booking.service}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          slot.isAvailable
                            ? "bg-green-500/20 text-green-700"
                            : slot.booking?.status === "Confirmed"
                            ? "bg-blue-500/20 text-blue-700"
                            : "bg-orange-500/20 text-orange-700"
                        }`}>
                          {slot.isAvailable ? "LIBRE" : slot.booking?.status === "Confirmed" ? "CONFIRMADO" : "RESERVADO"}
                        </span>
                        {slot.isAvailable ? (
                          <button
                            onClick={() => deleteSlot(slot.id)}
                            data-testid="agenda-slot-delete"
                            className="text-red-600 hover:text-red-700 text-xs font-medium uppercase tracking-wide transition"
                          >
                            Eliminar
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); releaseSlot(slot.id); }}
                            data-testid="agenda-slot-release"
                            className="text-green-700 hover:text-green-800 text-xs font-medium uppercase tracking-wide transition"
                          >
                            Liberar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            {totalPages > 1 && (
              <div data-testid="agenda-pagination" className="mt-4 pt-4 border-t border-mauve/10 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-charcoal/70 hover:text-charcoal hover:bg-porcelain transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-charcoal/50 text-xs">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-charcoal/70 hover:text-charcoal hover:bg-porcelain transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DETALLE RESERVA */}
      {detailSlot?.booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDetailSlot(null)}>
          <div data-testid="agenda-detail-modal" className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">Detalle de reserva</h2>
                <p className="text-charcoal/40 text-xs mt-0.5">{detailSlot.label}</p>
              </div>
              <button onClick={() => setDetailSlot(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <Row label="Cliente" value={detailSlot.booking.customerName} />
              <Row label="Teléfono" value={
                <a href={`tel:${detailSlot.booking.customerPhone}`} className="text-blue-700 hover:underline">
                  {detailSlot.booking.customerPhone}
                </a>
              } />
              {detailSlot.booking.subject && <Row label="Detalle" value={detailSlot.booking.subject} />}
              <Row label="Servicio" value={detailSlot.booking.service || "—"} />
              {detailSlot.booking.message && <Row label="Mensaje" value={detailSlot.booking.message} />}
              <Row label="Estado" value={detailSlot.booking.status === "Confirmed" ? "Confirmado" : "Pendiente"} />
            </div>
            {detailSlot.booking.status !== "Confirmed" && (
              <div className="px-6 pb-1">
                <button
                  data-testid="agenda-detail-confirm"
                  onClick={() => confirmBooking(detailSlot.booking!.id)}
                  className="w-full bg-blush hover:bg-blushdark text-white py-2.5 rounded-lg text-sm font-semibold uppercase tracking-wide transition"
                >
                  Confirmar turno
                </button>
              </div>
            )}
            <div className="px-6 py-4 border-t border-mauve/5 flex gap-3">
              <a
                href={`https://wa.me/+54${detailSlot.booking.customerPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
              >
                WhatsApp
              </a>
              <button
                data-testid="agenda-detail-release"
                onClick={() => releaseSlot(detailSlot.id)}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-semibold transition"
              >
                Liberar turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
    </div>
  );
}

export default function ProfessionalAgendaPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando tu agenda...</p>
      </div>
    }>
      <ProfessionalAgendaContent />
    </Suspense>
  );
}
