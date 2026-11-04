import { formatSurcharge } from "@/src/lib/homeService/coverageLocality";

// Form logic of the admin "Cancelar y devolver" modal and its mapping to
// `POST /api/bookings/{id}/admin-cancel-refund`. Amounts use the same AR
// format as the coverage surcharge: dots group thousands, the comma is the
// decimal separator.

export type RefundMethod = "Cash" | "Transfer";

export const MAX_REFUND_NOTE_LENGTH = 500;

export interface RefundFormValues {
  amount: string;
  method: RefundMethod | null;
  note: string;
}

export interface CancelRefundRequest {
  amount: number;
  method: RefundMethod;
  note?: string;
}

export type RefundFormErrors = Partial<Record<keyof RefundFormValues, string>>;

export type RefundFormResult = { ok: true; body: CancelRefundRequest } | { ok: false; errors: RefundFormErrors };

const AMOUNT_RE = /^\d+(,\d{1,2})?$/;

/** "1.500", "$ 12.345,50" -> number; null when empty or malformed. */
export function parseRefundAmount(input: string): number | null {
  const digits = input.replace(/[\s$]/g, "").replace(/\./g, "");
  if (!AMOUNT_RE.test(digits)) return null;
  return Number(digits.replace(",", "."));
}

/** 1500.5 -> "1.500,50" (inverse of `parseRefundAmount`). */
export function formatRefundAmount(value: number): string {
  return formatSurcharge(value);
}

export function validateRefundForm(values: RefundFormValues, paymentAmount: number): RefundFormResult {
  const errors: RefundFormErrors = {};

  const amount = parseRefundAmount(values.amount);
  if (amount === null) {
    errors.amount = "Ingresá un importe válido, con hasta 2 decimales";
  } else if (amount <= 0) {
    errors.amount = "El importe debe ser mayor a 0";
  } else if (amount > paymentAmount) {
    errors.amount = `El importe no puede superar lo pagado ($ ${formatRefundAmount(paymentAmount)})`;
  }

  if (!values.method) errors.method = "Elegí cómo devolviste el dinero";

  const note = values.note.trim();
  if (note.length > MAX_REFUND_NOTE_LENGTH) {
    errors.note = `La nota puede tener hasta ${MAX_REFUND_NOTE_LENGTH} caracteres`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: { amount: amount as number, method: values.method as RefundMethod, ...(note ? { note } : {}) },
  };
}

/** Backend 400 when no caja session is open (same text as `POST /api/caja/movements`). */
export function isNoOpenCajaError(message: string | null | undefined): boolean {
  return typeof message === "string" && message.includes("No hay ninguna caja abierta");
}
