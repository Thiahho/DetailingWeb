// Paid-booking rules shared by the client portal, the cancel-by-link page and
// the admin agenda. A booking counts as paid only while its payment is
// Approved (a Refunded payment is no longer paid).

export const APPROVED_PAYMENT_STATUS = "Approved";

/** Client-facing copy shown instead of the cancel button on a paid booking. */
export const PAID_CANCEL_NOTICE = "Esta reserva ya está pagada. Para cancelarla, escribinos por WhatsApp.";

export function isPaid(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === APPROVED_PAYMENT_STATUS;
}

/** Admin "Cancelar y devolver" applies to an approved payment on a booking that is still active. */
export function canCancelAndRefund(booking: { status: string; paymentStatus?: string | null }): boolean {
  return isPaid(booking.paymentStatus) && booking.status !== "Cancelled";
}

/**
 * Public cancel answers 400 "Esta reserva ya está pagada. Escribinos por
 * WhatsApp para cancelarla" for a paid booking. Screens that cannot see the
 * payment status detect it from that response.
 */
export function isPaidCancellationRejection(status: number, message: string | null | undefined): boolean {
  return status === 400 && typeof message === "string" && message.includes("ya está pagada");
}

/** Prefilled WhatsApp text asking the business to cancel a paid booking. */
export function buildPaidCancellationMessage({
  bookingId,
  service,
  whenLabel,
}: {
  bookingId: number;
  service?: string | null;
  whenLabel: string;
}): string {
  const serviceName = service?.trim();
  const servicePart = serviceName ? ` de ${serviceName}` : "";
  return `Hola, quiero cancelar mi turno #${bookingId}${servicePart} del ${whenLabel}. Ya está pagado.`;
}

export interface BookingPaymentInfo {
  paymentStatus: string | null;
  paymentAmount: number | null;
  paymentPaidAt: string | null;
  paymentProvider: string | null;
}

type PaymentRow = Partial<BookingPaymentInfo> & { id?: unknown };

/** Indexes the payment fields of the admin `GET /api/bookings` list by booking id. Anything but an array yields an empty index. */
export function indexPaymentInfo(list: unknown): Map<number, BookingPaymentInfo> {
  const index = new Map<number, BookingPaymentInfo>();
  if (!Array.isArray(list)) return index;
  for (const row of list as PaymentRow[]) {
    if (!row || typeof row.id !== "number") continue;
    index.set(row.id, {
      paymentStatus: row.paymentStatus ?? null,
      paymentAmount: row.paymentAmount ?? null,
      paymentPaidAt: row.paymentPaidAt ?? null,
      paymentProvider: row.paymentProvider ?? null,
    });
  }
  return index;
}

/**
 * `GET /api/timeslots` does not carry the payment of the slot's booking; the
 * admin agenda copies it from the bookings list. `source` is that list or an
 * index built with `indexPaymentInfo`.
 */
export function withPaymentInfo<T extends { id: number }>(
  booking: T,
  source: unknown
): T & Partial<BookingPaymentInfo> {
  const index = source instanceof Map ? (source as Map<number, BookingPaymentInfo>) : indexPaymentInfo(source);
  const info = index.get(booking.id);
  return info ? { ...booking, ...info } : booking;
}
