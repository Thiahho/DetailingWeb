"use client";

import type { ReactNode } from "react";
import { X, Phone, Scissors, Tag, UserRound, MessageSquare, Wallet } from "lucide-react";
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
  return `${dayName} ${day}/${month}/${year} · ${hours}:${minutes}`;
}

// Mismos tonos que ya usa el resto del sitio (emerald=éxito, champagne=pendiente,
// mauve=cancelado/destructivo) en vez del rojo/verde/amarillo crudo de Tailwind.
function StatusBadge({ label, tone }: { label: string; tone: "success" | "pending" | "cancelled" | "muted" }) {
  const toneClasses: Record<typeof tone, string> = {
    success: "bg-emerald-100 text-emerald-700",
    pending: "bg-champagne/20 text-champagne",
    cancelled: "bg-mauve/15 text-mauve",
    muted: "bg-porcelain/15 text-charcoal/40",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-charcoal/25 shrink-0">{icon}</span>
      <div className="flex-1 flex items-start justify-between gap-4 min-w-0">
        <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
        <span className="text-charcoal text-sm text-right font-medium">{value}</span>
      </div>
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
  emailHref,
}: {
  slot: TimeSlot;
  booking: Booking;
  onClose: () => void;
  onConfirmAndWhatsApp: (slot: TimeSlot) => void;
  onConfirm: (bookingId: number, booking: Booking, startDateTime: string) => void;
  onRelease: (id: number, isConfirmed: boolean) => void;
  onDeleteExpired: (id: number) => void;
  // Link "mailto:" ya armado por el caller — opcional, solo algunas pantallas
  // (Panel principal) ofrecen contacto directo por email además de WhatsApp.
  emailHref?: string;
}) {
  useModalHotkeys(true, { onClose });
  const slotExpired = isExpired(slot.startDateTime);

  const statusBadge = slotExpired
    ? <StatusBadge label="Expirado" tone="muted" />
    : booking.status === "Confirmed"
    ? <StatusBadge label="Confirmado" tone="success" />
    : booking.status === "Cancelled"
    ? <StatusBadge label="Cancelado" tone="cancelled" />
    : <StatusBadge label="Pendiente" tone="pending" />;

  const paymentBadge =
    booking.paymentStatus === "Approved" ? (
      <StatusBadge
        label={`Pagado${booking.paymentAmount ? ` · $${booking.paymentAmount.toLocaleString("es-AR")}` : ""}`}
        tone="success"
      />
    ) : booking.paymentStatus === "Pending" ? (
      <StatusBadge label="Pago pendiente" tone="pending" />
    ) : (
      <StatusBadge label="Sin pago" tone="muted" />
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-mauve/5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-charcoal font-semibold text-lg">{booking.customerName}</h2>
              {statusBadge}
            </div>
            <p className="text-charcoal/40 text-xs mt-1">{formatDateFriendly(slot.startDateTime)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-full p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-porcelain/10 transition"
          >
            <X className="w-4.5 h-4.5" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3.5">
          <InfoRow
            icon={<Phone className="w-4 h-4" strokeWidth={2} />}
            label="Teléfono"
            value={
              <a href={`tel:${booking.customerPhone}`} className="text-blue-700 hover:underline">
                {booking.customerPhone}
              </a>
            }
          />
          <InfoRow icon={<Tag className="w-4 h-4" strokeWidth={2} />} label="Trabajo" value={booking.subject || "—"} />
          <InfoRow icon={<Scissors className="w-4 h-4" strokeWidth={2} />} label="Servicio" value={booking.service || "—"} />
          {booking.professionalName && (
            <InfoRow icon={<UserRound className="w-4 h-4" strokeWidth={2} />} label="Especialista" value={booking.professionalName} />
          )}
          {booking.message && (
            <InfoRow icon={<MessageSquare className="w-4 h-4" strokeWidth={2} />} label="Mensaje" value={booking.message} />
          )}
          <InfoRow icon={<Wallet className="w-4 h-4" strokeWidth={2} />} label="Pago" value={paymentBadge} />

          {booking.customFieldsJson && (() => {
            try {
              const fields = JSON.parse(booking.customFieldsJson!) as Record<string, string>;
              const entries = Object.entries(fields);
              if (entries.length === 0) return null;
              return (
                <div className="pt-2 border-t border-mauve/5">
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-mauve/5 flex flex-col gap-2">
          {slotExpired ? (
            <button
              onClick={() => { onClose(); onDeleteExpired(slot.id); }}
              className="w-full rounded-lg bg-mauve px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-mauve/85"
            >
              Eliminar turno expirado
            </button>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onConfirmAndWhatsApp(slot)}
                  className="flex-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-semibold transition"
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
              {emailHref && (
                <a
                  href={emailHref}
                  className="w-full text-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 py-2.5 rounded-lg text-sm font-semibold transition"
                >
                  Enviar email
                </a>
              )}
              <button
                onClick={() => { onClose(); onRelease(slot.id, booking.status === "Confirmed"); }}
                className="w-full rounded-lg bg-mauve px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-mauve/85"
              >
                {booking.status === "Confirmed" ? "Cancelar turno" : "Liberar turno"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
