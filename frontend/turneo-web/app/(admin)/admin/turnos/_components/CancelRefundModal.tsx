"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";
import {
  MAX_REFUND_NOTE_LENGTH,
  formatRefundAmount,
  isNoOpenCajaError,
  validateRefundForm,
  type RefundFormErrors,
  type RefundMethod,
} from "@/src/lib/bookings/refundForm";
import type { Booking } from "./BookingDetailModal";

const METHOD_OPTIONS: { value: RefundMethod; label: string }[] = [
  { value: "Cash", label: "Efectivo" },
  { value: "Transfer", label: "Transferencia" },
];

const INPUT_CLASS =
  "w-full rounded-lg border border-mauve/15 bg-white/70 px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal/30 focus:border-blush focus:outline-none focus:ring-1 focus:ring-blush/40";

/**
 * Admin "Cancelar y devolver": cancels a paid booking and records the refund
 * as a Caja movement (`POST /api/bookings/{id}/admin-cancel-refund`).
 */
export default function CancelRefundModal({
  booking,
  whenLabel,
  onClose,
  onDone,
}: {
  booking: Booking;
  whenLabel: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const paymentAmount = booking.paymentAmount ?? 0;
  const [amount, setAmount] = useState(paymentAmount > 0 ? formatRefundAmount(paymentAmount) : "");
  const [method, setMethod] = useState<RefundMethod | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<RefundFormErrors>({});
  const [serverError, setServerError] = useState("");
  const [noOpenCaja, setNoOpenCaja] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (!saving) onClose();
  };
  useModalHotkeys(true, { onClose: close });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setNoOpenCaja(false);
    const result = validateRefundForm({ amount, method, note }, paymentAmount);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/admin-cancel-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onDone(data.message || "La reserva fue cancelada y la devolución quedó registrada en la caja.");
        return;
      }
      const message: string = data.message || "No se pudo cancelar la reserva.";
      setNoOpenCaja(isNoOpenCajaError(message));
      setServerError(message);
    } catch {
      setServerError("Error de conexión. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm" onClick={close}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-refund-title"
        data-testid="cancel-refund-modal"
        onSubmit={submit}
        noValidate
        className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-mauve/5">
          <div className="min-w-0">
            <h2 id="cancel-refund-title" className="text-charcoal font-semibold text-lg">Cancelar y devolver</h2>
            <p className="text-charcoal/40 text-xs mt-1">
              {booking.customerName} · {whenLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="shrink-0 rounded-full p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-porcelain/10 transition"
          >
            <X className="w-4.5 h-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-charcoal/60 text-sm">
            La reserva se cancela y la devolución se registra como egreso en la caja abierta.
            {paymentAmount > 0 && (
              <>
                {" "}Pagado: <span className="font-semibold text-charcoal">$ {formatRefundAmount(paymentAmount)}</span>.
              </>
            )}
          </p>

          <div className="space-y-1.5">
            <label htmlFor="cancel-refund-amount" className="text-charcoal/60 text-xs font-medium uppercase tracking-wide">
              Importe a devolver
            </label>
            <input
              id="cancel-refund-amount"
              inputMode="decimal"
              autoComplete="off"
              data-testid="cancel-refund-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount}
              className={INPUT_CLASS}
            />
            {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-charcoal/60 text-xs font-medium uppercase tracking-wide">Cómo se devolvió</legend>
            <div className="grid grid-cols-2 gap-2 pt-1.5">
              {METHOD_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    method === option.value
                      ? "border-blush bg-blush/10 text-charcoal"
                      : "border-mauve/15 text-charcoal/70 hover:border-mauve/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-refund-method"
                    value={option.value}
                    checked={method === option.value}
                    onChange={() => setMethod(option.value)}
                    data-testid={`cancel-refund-method-${option.value.toLowerCase()}`}
                    className="accent-blush"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {errors.method && <p className="text-xs text-red-600">{errors.method}</p>}
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="cancel-refund-note" className="text-charcoal/60 text-xs font-medium uppercase tracking-wide">
              Nota (opcional)
            </label>
            <textarea
              id="cancel-refund-note"
              rows={3}
              maxLength={MAX_REFUND_NOTE_LENGTH}
              data-testid="cancel-refund-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={!!errors.note}
              className={`${INPUT_CLASS} resize-none`}
            />
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-red-600">{errors.note}</span>
              <span className="text-charcoal/30">
                {note.length}/{MAX_REFUND_NOTE_LENGTH}
              </span>
            </div>
          </div>

          {serverError && (
            <div role="alert" data-testid="cancel-refund-error" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
              {noOpenCaja && (
                <>
                  {" "}
                  <Link href="/admin/caja" className="font-semibold underline underline-offset-2">
                    Abrir la caja →
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-mauve/5 flex flex-col-reverse sm:flex-row gap-3">
          <Button type="button" variant="secondary" onClick={close} disabled={saving} className="flex-1">
            Volver
          </Button>
          <Button type="submit" variant="danger" disabled={saving} data-testid="cancel-refund-submit" className="flex-1">
            {saving ? "Procesando..." : "Cancelar y devolver"}
          </Button>
        </div>
      </form>
    </div>
  );
}
