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

/** Admin hint shown instead of "Liberar"/"Cancelar turno" on a paid booking. */
export const PAID_RELEASE_HINT = "Reserva pagada: para cancelarla usá \"Cancelar y devolver\".";

/** Reason shown instead of "Editar" (mirrors the backend 400 of `PUT /api/bookings/{id}`). */
export const BOOKING_EDIT_LOCKED_REASON = "No se puede editar una reserva confirmada o pagada";

/**
 * `PUT /api/timeslots/{id}/release` rejects a booking with an approved payment:
 * it is cancelled only through "Cancelar y devolver", which records the refund.
 */
export function canReleaseBooking(booking: { paymentStatus?: string | null }): boolean {
  return !isPaid(booking.paymentStatus);
}

/** `PUT /api/bookings/{id}` rejects confirmed bookings and bookings with an approved payment. */
export function canEditBooking(booking: { status: string; paymentStatus?: string | null }): boolean {
  return booking.status !== "Confirmed" && !isPaid(booking.paymentStatus);
}
