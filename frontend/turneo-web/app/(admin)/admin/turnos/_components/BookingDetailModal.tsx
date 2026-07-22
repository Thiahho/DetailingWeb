"use client";

import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

export interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  email?: string;
  subject: string;
  service: string;
  professionalId?: number | null;
  professionalName?: string | null;
  message?: string;
  status: string;
  customFieldsJson?: string;
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  paymentPaidAt?: string | null;
  paymentProvider?: string | null;
}

export interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  isBlocked?: boolean;
  bookingsCount: number;
  label: string;
  booking?: Booking;
  professionalId?: number | null;
  professionalName?: string | null;
}

function isExpired(isoString: string): boolean {
  const cleanString = isoString.replace("Z", "");
  const [datePart, timePart] = cleanString.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const slotDate = new Date(year, month - 1, day, hours, minutes);
  return slotDate < new Date();
}

function formatDateFriendly(isoString: string) {
  const cleanString = isoString.replace("Z", "");
  const [datePart, timePart] = cleanString.split("T");
  const [year, month, day] = datePart.split("-");
  const [hours, minutes] = timePart.split(":");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dayName = days[date.getDay()];
  return `${dayName} ${day}/${month}/${year} - ${hours}:${minutes}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
    </div>
  );
}

export default function BookingDetailModal({
  slot,
  booking,
  onClose,
  onConfirmAndWhatsApp,
  onConfirm,
  onRelease,
  onDeleteExpired,
}: {
  slot: TimeSlot;
  booking: Booking;
  onClose: () => void;
  onConfirmAndWhatsApp: (slot: TimeSlot) => void;
  onConfirm: (bookingId: number, booking: Booking, startDateTime: string) => void;
  onRelease: (id: number, isConfirmed: boolean) => void;
  onDeleteExpired: (id: number) => void;
}) {
  useModalHotkeys(true, { onClose });
  const slotExpired = isExpired(slot.startDateTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
          <div>
            <h2 className="text-charcoal font-semibold text-lg">Detalle de reserva</h2>
            <p className="text-charcoal/40 text-xs mt-0.5">{formatDateFriendly(slot.startDateTime)}</p>
          </div>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Row label="Cliente" value={booking.customerName} />
          <Row label="Teléfono" value={
            <a href={`tel:${booking.customerPhone}`} className="text-blue-700 hover:underline">
              {booking.customerPhone}
            </a>
          } />
          <Row label="Trabajo" value={booking.subject || "—"} />
          <Row label="Servicio" value={booking.service || "—"} />
          {booking.professionalName && (
            <Row label="Especialista" value={booking.professionalName} />
          )}
          {booking.customFieldsJson && (() => {
            try {
              const fields = JSON.parse(booking.customFieldsJson!) as Record<string, string>;
              const entries = Object.entries(fields);
              if (entries.length === 0) return null;
              return (
                <div>
                  <p className="text-charcoal/40 text-xs uppercase tracking-wider mb-2">Campos adicionales</p>
                  <div className="flex flex-wrap gap-2">
                    {entries.map(([k, v]) => (
                      <span key={k} className="text-xs bg-porcelain/5 border border-mauve/10 rounded-full px-3 py-1 text-charcoal/70">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </div>
              );
            } catch { return null; }
          })()}
          {booking.message && (
            <Row label="Mensaje" value={booking.message} />
          )}
          <Row label="Estado" value={
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              slotExpired
                ? "bg-porcelain/10 text-charcoal/40"
                : booking.status === "Confirmed"
                ? "bg-green-500/20 text-green-700"
                : booking.status === "Cancelled"
                ? "bg-red-500/20 text-red-600"
                : "bg-orange-500/20 text-orange-700"
            }`}>
              {slotExpired ? "Expirado"
                : booking.status === "Confirmed" ? "Confirmado"
                : booking.status === "Cancelled" ? "Cancelado"
                : "Pendiente"}
            </span>
          } />
          <Row label="Pago" value={
            booking.paymentStatus === "Approved"
              ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-700">
                  Pagado{booking.paymentAmount ? ` — $${booking.paymentAmount.toLocaleString("es-AR")}` : ""}
                </span>
              : booking.paymentStatus === "Pending"
              ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-700">Pago pendiente</span>
              : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-porcelain/10 text-charcoal/40">Sin pago</span>
          } />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-mauve/5 flex flex-col gap-2">
          {slotExpired ? (
            <Button
              onClick={() => { onClose(); onDeleteExpired(slot.id); }}
              variant="danger"
              className="w-full"
            >
              Eliminar turno expirado
            </Button>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onConfirmAndWhatsApp(slot)}
                  className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
                >
                  Confirmar + WhatsApp
                </button>
                {booking.status !== "Confirmed" && (
                  <Button
                    onClick={() => onConfirm(booking.id, slot.booking, slot.startDateTime)}
                    variant="primary"
                    className="flex-1"
                  >
                    Confirmar
                  </Button>
                )}
              </div>
              <Button
                onClick={() => { onClose(); onRelease(slot.id, booking.status === "Confirmed"); }}
                variant="danger"
                className="w-full"
              >
                {booking.status === "Confirmed" ? "Cancelar turno" : "Liberar turno"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
