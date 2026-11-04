import { describe, expect, it } from "vitest";
import {
  MAX_REFUND_NOTE_LENGTH,
  formatRefundAmount,
  isNoOpenCajaError,
  parseRefundAmount,
  validateRefundForm,
} from "@/src/lib/bookings/refundForm";

describe("parseRefundAmount", () => {
  it("parses AR formatted amounts (dot thousands, comma decimals)", () => {
    expect(parseRefundAmount("1.500")).toBe(1500);
    expect(parseRefundAmount("$ 12.345,50")).toBe(12345.5);
    expect(parseRefundAmount(" 800,5 ")).toBe(800.5);
  });

  it("returns null for empty or malformed input", () => {
    for (const input of ["", "  ", "abc", "12,345", "-5", "1,2,3", "1e3"]) {
      expect(parseRefundAmount(input)).toBeNull();
    }
  });
});

describe("formatRefundAmount", () => {
  it("formats the payment amount for the prefilled input", () => {
    expect(formatRefundAmount(15000)).toBe("15.000");
    expect(formatRefundAmount(1500.5)).toBe("1.500,50");
  });

  it("round-trips through parseRefundAmount", () => {
    for (const value of [1, 999.99, 15000, 1234567.8]) {
      expect(parseRefundAmount(formatRefundAmount(value))).toBe(value);
    }
  });
});

describe("validateRefundForm", () => {
  const payment = 15000;

  it("maps a valid form to the request body", () => {
    expect(validateRefundForm({ amount: "15.000", method: "Cash", note: "" }, payment)).toEqual({
      ok: true,
      body: { amount: 15000, method: "Cash" },
    });
    expect(validateRefundForm({ amount: "5.000,25", method: "Transfer", note: "  Alias del cliente  " }, payment)).toEqual({
      ok: true,
      body: { amount: 5000.25, method: "Transfer", note: "Alias del cliente" },
    });
  });

  it("rejects a missing, zero, malformed or too large amount", () => {
    expect(validateRefundForm({ amount: "", method: "Cash", note: "" }, payment)).toEqual({
      ok: false,
      errors: { amount: "Ingresá un importe válido, con hasta 2 decimales" },
    });
    expect(validateRefundForm({ amount: "0", method: "Cash", note: "" }, payment)).toEqual({
      ok: false,
      errors: { amount: "El importe debe ser mayor a 0" },
    });
    expect(validateRefundForm({ amount: "15.000,01", method: "Cash", note: "" }, payment)).toEqual({
      ok: false,
      errors: { amount: "El importe no puede superar lo pagado ($ 15.000)" },
    });
  });

  it("requires a refund method", () => {
    expect(validateRefundForm({ amount: "100", method: null, note: "" }, payment)).toEqual({
      ok: false,
      errors: { method: "Elegí cómo devolviste el dinero" },
    });
  });

  it("limits the note to 500 characters", () => {
    const longNote = "a".repeat(MAX_REFUND_NOTE_LENGTH + 1);
    expect(validateRefundForm({ amount: "100", method: "Cash", note: longNote }, payment)).toEqual({
      ok: false,
      errors: { note: "La nota puede tener hasta 500 caracteres" },
    });
    const okNote = "a".repeat(MAX_REFUND_NOTE_LENGTH);
    expect(validateRefundForm({ amount: "100", method: "Cash", note: okNote }, payment)).toEqual({
      ok: true,
      body: { amount: 100, method: "Cash", note: okNote },
    });
  });

  it("reports every invalid field at once", () => {
    const result = validateRefundForm({ amount: "x", method: null, note: "a".repeat(501) }, payment);
    expect(result.ok).toBe(false);
    if ("errors" in result) expect(Object.keys(result.errors).sort()).toEqual(["amount", "method", "note"]);
  });
});

describe("isNoOpenCajaError", () => {
  it("detects the backend message for a closed caja", () => {
    expect(isNoOpenCajaError("No hay ninguna caja abierta")).toBe(true);
    expect(isNoOpenCajaError("El pago de esta reserva ya fue devuelto")).toBe(false);
    expect(isNoOpenCajaError(undefined)).toBe(false);
  });
});
