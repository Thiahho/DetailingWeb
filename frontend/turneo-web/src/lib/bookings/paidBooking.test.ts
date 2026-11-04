import { describe, expect, it } from "vitest";
import {
  PAID_CANCEL_NOTICE,
  buildPaidCancellationMessage,
  canCancelAndRefund,
  isPaid,
  isPaidCancellationRejection,
  withPaymentInfo,
} from "@/src/lib/bookings/paidBooking";

describe("isPaid", () => {
  it("is true only for an approved payment", () => {
    expect(isPaid("Approved")).toBe(true);
    for (const status of ["Pending", "Refunded", "Rejected", "Cancelled", "", null, undefined]) {
      expect(isPaid(status)).toBe(false);
    }
  });
});

describe("canCancelAndRefund", () => {
  it("allows an approved payment on a booking that is not cancelled", () => {
    expect(canCancelAndRefund({ status: "Pending", paymentStatus: "Approved" })).toBe(true);
    expect(canCancelAndRefund({ status: "Confirmed", paymentStatus: "Approved" })).toBe(true);
  });

  it("rejects cancelled bookings and bookings without an approved payment", () => {
    expect(canCancelAndRefund({ status: "Cancelled", paymentStatus: "Approved" })).toBe(false);
    expect(canCancelAndRefund({ status: "Confirmed", paymentStatus: "Refunded" })).toBe(false);
    expect(canCancelAndRefund({ status: "Pending", paymentStatus: null })).toBe(false);
    expect(canCancelAndRefund({ status: "Pending" })).toBe(false);
  });
});

describe("isPaidCancellationRejection", () => {
  const backendMessage = "Esta reserva ya está pagada. Escribinos por WhatsApp para cancelarla";

  it("recognizes the backend 400 for a paid booking", () => {
    expect(isPaidCancellationRejection(400, backendMessage)).toBe(true);
  });

  it("ignores other statuses and other messages", () => {
    expect(isPaidCancellationRejection(500, backendMessage)).toBe(false);
    expect(isPaidCancellationRejection(400, "Este turno ya expiró")).toBe(false);
    expect(isPaidCancellationRejection(400, undefined)).toBe(false);
  });
});

describe("buildPaidCancellationMessage", () => {
  it("includes booking id, service and date", () => {
    expect(
      buildPaidCancellationMessage({ bookingId: 42, service: "Lavado premium", whenLabel: "lunes 3 de noviembre, 10:00" })
    ).toBe(
      "Hola, quiero cancelar mi turno #42 de Lavado premium del lunes 3 de noviembre, 10:00. Ya está pagado."
    );
  });

  it("omits the service when it is missing or blank", () => {
    expect(buildPaidCancellationMessage({ bookingId: 7, service: "  ", whenLabel: "martes 4 de noviembre, 09:30" })).toBe(
      "Hola, quiero cancelar mi turno #7 del martes 4 de noviembre, 09:30. Ya está pagado."
    );
    expect(buildPaidCancellationMessage({ bookingId: 7, service: null, whenLabel: "jueves 6 de noviembre, 18:00" })).toBe(
      "Hola, quiero cancelar mi turno #7 del jueves 6 de noviembre, 18:00. Ya está pagado."
    );
  });

  it("exposes the client notice copy", () => {
    expect(PAID_CANCEL_NOTICE).toBe("Esta reserva ya está pagada. Para cancelarla, escribinos por WhatsApp.");
  });
});

describe("withPaymentInfo", () => {
  const adminList = [
    { id: 1, status: "Confirmed", paymentStatus: "Approved", paymentAmount: 15000, paymentPaidAt: "2026-11-01T10:00:00", paymentProvider: "MercadoPago" },
    { id: 2, status: "Pending", paymentStatus: null, paymentAmount: null, paymentPaidAt: null, paymentProvider: null },
  ];

  it("copies the payment fields of the admin list onto the matching booking", () => {
    expect(withPaymentInfo({ id: 1, status: "Confirmed", customerName: "Ana" }, adminList)).toEqual({
      id: 1,
      status: "Confirmed",
      customerName: "Ana",
      paymentStatus: "Approved",
      paymentAmount: 15000,
      paymentPaidAt: "2026-11-01T10:00:00",
      paymentProvider: "MercadoPago",
    });
  });

  it("keeps the booking unchanged when it is not in the list or the list is not an array", () => {
    const booking = { id: 3, status: "Pending", paymentStatus: "Pending" };
    expect(withPaymentInfo(booking, adminList)).toEqual(booking);
    expect(withPaymentInfo(booking, { message: "error" })).toEqual(booking);
    expect(withPaymentInfo(booking, null)).toEqual(booking);
  });
});
