"use client";

import { useState } from "react";
import { getWhatsAppLink } from "@/src/lib/siteConfig";
import PaymentButton from "@/src/components/payments/PaymentButton";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";
import { Button } from "@/src/components/shared/Button";

interface MyBooking {
  id: number;
  status: string;
  service: string | null;
  subject: string | null;
  customFieldsJson: string | null;
  customerName: string;
  startDateTime: string;
  endDateTime: string;
  canCancel: boolean;
  canReschedule: boolean;
  paymentStatus: string | null;
  paymentAmount: number | null;
  paymentPaidAt: string | null;
  paymentCheckoutUrl: string | null;
}

interface TimeSlot {
  id: number;
  label: string;
  startDateTime: string;
}

const STATUS_STYLES: Record<string, string> = {
  Pending:   "bg-amber-50 text-amber-700 border border-amber-200",
  Confirmed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Cancelled: "bg-red-50 text-red-600 border border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  Pending:   "Pendiente",
  Confirmed: "Confirmado",
  Cancelled: "Cancelado",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

const parseCustomFields = (json: string | null): Record<string, string> => {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
};

export default function MisTurnosPage() {
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<MyBooking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [waNumber, setWaNumber] = useState("");

  // Estado del modal de reprogramación
  const [rescheduleBooking, setRescheduleBooking] = useState<MyBooking | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  useModalHotkeys(!!rescheduleBooking, { onClose: () => !rescheduling && setRescheduleBooking(null) });
  const [rescheduleError, setRescheduleError] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchWaNumber = async () => {
    try {
      const d = await fetch("/api/siteconfig").then((r) => r.json());
      if (d.whatsAppNumber) setWaNumber(d.whatsAppNumber);
    } catch { /* ignorar */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/by-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudieron cargar los turnos");
      setItems(Array.isArray(data) ? data : []);
      fetchWaNumber();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (id: number) => {
    if (!(await confirm({ message: "¿Confirmás que querés cancelar este turno?", confirmLabel: "Cancelar turno" }))) return;
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST", credentials: "include" });
    if (res.ok) {
      setItems((prev) =>
        prev!.map((item) =>
          item.id === id ? { ...item, status: "Cancelled", canCancel: false, canReschedule: false } : item
        )
      );
    }
  };

  const openReschedule = async (booking: MyBooking) => {
    setRescheduleBooking(booking);
    setSelectedSlotId(null);
    setRescheduleError("");
    setLoadingSlots(true);
    try {
      const res = await fetch("/api/timeslots/available");
      const data = await res.json();
      setAvailableSlots(Array.isArray(data) ? data : []);
    } catch {
      setRescheduleError("No se pudieron cargar los horarios disponibles");
    } finally {
      setLoadingSlots(false);
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleBooking || !selectedSlotId) return;
    setRescheduling(true);
    setRescheduleError("");
    try {
      const res = await fetch(`/api/bookings/${rescheduleBooking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTimeSlotId: selectedSlotId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo reprogramar");

      // Actualizar la lista con la nueva fecha
      setItems((prev) =>
        prev!.map((item) =>
          item.id === rescheduleBooking.id
            ? { ...item, startDateTime: data.newStartDateTime }
            : item
        )
      );
      setRescheduleBooking(null);
    } catch (err: unknown) {
      setRescheduleError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream p-6">
      {ConfirmDialog}
      <div className="max-w-2xl mx-auto">

        {/* Formulario de email */}
        {items === null && (
          <div className="mt-10">
            <h1 className="text-3xl text-charcoal font-semibold mb-2">Mis turnos</h1>
            <p className="text-charcoal/60 mb-8">Ingresá tu email para ver tus reservas.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-charcoal/70 mb-1">Email</label>
                <input
                  type="email"
                  required
                  data-testid="mis-turnos-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="form-input"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                data-testid="mis-turnos-submit"
                shape="pill"
                className="w-full"
              >
                {loading ? "Buscando..." : "Ver mis turnos"}
              </Button>
            </form>
          </div>
        )}

        {/* Lista de turnos */}
        {items !== null && (
          <>
            <div className="mt-10 flex items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl text-charcoal font-semibold">Mis turnos</h1>
                <p className="text-charcoal/40 text-sm mt-0.5">{email}</p>
              </div>
              <button
                onClick={() => { setItems(null); setError(""); }}
                className="text-charcoal/40 hover:text-charcoal text-sm transition"
              >
                Cambiar email
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-16 text-charcoal/40">
                <p className="text-lg">No encontramos turnos para ese email</p>
                <a href="/reservar#contacto" className="mt-4 inline-block text-blushdark hover:underline text-sm">
                  Reservar un turno
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((b) => {
                  const customFields = parseCustomFields(b.customFieldsJson);
                  const statusClass = STATUS_STYLES[b.status] || "bg-mauve/10 text-charcoal/70";
                  const statusLabel = STATUS_LABELS[b.status] || b.status;
                  const waLink = waNumber
                    ? getWhatsAppLink(waNumber, `Hola, quiero reprogramar mi turno #${b.id} del ${formatDate(b.startDateTime)}`)
                    : "#";

                  return (
                    <div
                      key={b.id}
                      data-testid="mis-turnos-booking-card"
                      data-booking-subject={b.subject ?? ""}
                      className="glass-card p-5 space-y-3"
                    >
                      <div className="flex flex-wrap justify-between gap-2 items-start">
                        <div>
                          <p className="text-charcoal font-semibold">{b.service || "Turno"}</p>
                          {b.subject && <p className="text-charcoal/60 text-sm">{b.subject}</p>}
                          <p className="text-charcoal/40 text-xs mt-0.5">{b.customerName}</p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <p className="text-charcoal/80 text-sm capitalize">{formatDate(b.startDateTime)}</p>

                      {Object.keys(customFields).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(customFields).map(([k, v]) => (
                            <span key={k} className="text-xs bg-mauve/5 border border-mauve/15 rounded-full px-3 py-1 text-charcoal/60">
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Payment Status */}
                      {b.paymentStatus === "Approved" && (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-emerald-700 text-sm font-medium">
                            Pagado{b.paymentAmount ? ` — $${b.paymentAmount.toLocaleString("es-AR")}` : ""}
                          </span>
                        </div>
                      )}

                      {b.paymentStatus === "Pending" && b.status !== "Cancelled" && b.paymentCheckoutUrl && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-amber-700 text-sm">Pago pendiente</span>
                          </div>
                          <a
                            href={b.paymentCheckoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
                          >
                            Completar pago
                          </a>
                        </div>
                      )}

                      {!b.paymentStatus && b.status !== "Cancelled" && (
                        <PaymentButton
                          bookingId={b.id}
                          serviceName={b.service || "Servicio"}
                        />
                      )}

                      <div className="flex gap-3 pt-1">
                        <Button
                          onClick={() => cancelBooking(b.id)}
                          disabled={!b.canCancel}
                          data-testid="mis-turnos-cancel-button"
                          variant="danger"
                          size="sm"
                        >
                          Cancelar
                        </Button>

                        {/* Reprogramar: Pending → modal horarios | Confirmed → WhatsApp */}
                        {b.canReschedule && b.status === "Pending" && (
                          <button
                            onClick={() => openReschedule(b)}
                            data-testid="mis-turnos-reschedule-button"
                            className="px-3 py-1.5 rounded-lg border border-blush/40 bg-blush/10 text-blushdark text-xs font-medium hover:bg-blush/20 transition"
                          >
                            Reprogramar
                          </button>
                        )}
                        {b.canReschedule && b.status === "Confirmed" && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                          >
                            Reprogramar por WhatsApp
                          </a>
                        )}
                        {!b.canReschedule && (
                          <button
                            disabled
                            className="px-3 py-1.5 rounded-lg border border-mauve/10 bg-mauve/5 text-charcoal/30 text-xs font-medium cursor-not-allowed"
                          >
                            Reprogramar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal reprogramación (solo Pending) */}
      {rescheduleBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !rescheduling && setRescheduleBooking(null)}
        >
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-charcoal font-semibold text-lg">Elegir nuevo horario</h2>
                <button
                  onClick={() => setRescheduleBooking(null)}
                  className="text-charcoal/40 hover:text-charcoal transition text-xl"
                >✕</button>
              </div>
              <p className="text-charcoal/40 text-sm mb-5">
                Turno actual: <span className="text-charcoal/70 capitalize">{formatDate(rescheduleBooking.startDateTime)}</span>
              </p>

              {loadingSlots && <p className="text-charcoal/50 text-sm text-center py-8">Cargando horarios...</p>}

              {!loadingSlots && availableSlots.length === 0 && (
                <p className="text-charcoal/40 text-sm text-center py-8">No hay horarios disponibles por ahora.</p>
              )}

              {!loadingSlots && availableSlots.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4 max-h-64 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      data-testid="mis-turnos-reschedule-slot"
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`rounded-lg border px-3 py-2.5 text-sm text-left transition ${
                        selectedSlotId === slot.id
                          ? "border-blush bg-blush/10 text-blushdark"
                          : "border-mauve/15 text-charcoal/70 hover:border-mauve/30 hover:bg-mauve/5"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}

              {rescheduleError && <p className="text-red-600 text-sm mb-3">{rescheduleError}</p>}

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={submitReschedule}
                  disabled={!selectedSlotId || rescheduling}
                  data-testid="mis-turnos-reschedule-confirm"
                  shape="pill"
                  className="flex-1"
                >
                  {rescheduling ? "Guardando..." : "Confirmar cambio"}
                </Button>
                <Button
                  onClick={() => setRescheduleBooking(null)}
                  disabled={rescheduling}
                  variant="secondary"
                  shape="pill"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
