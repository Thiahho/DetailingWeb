import { describe, expect, it } from "vitest";
import { MAX_TRAVEL_BUFFER_MINUTES, isTravelBufferChanged, parseTravelBufferMinutes } from "@/src/lib/homeService/travelBuffer";

const INVALID = "El tiempo de traslado debe ser un número entero de 0 a 240 minutos";

describe("parseTravelBufferMinutes", () => {
  it("accepts whole minutes from 0 to 240, ignoring surrounding spaces", () => {
    expect(parseTravelBufferMinutes("0")).toEqual({ ok: true, value: 0 });
    expect(parseTravelBufferMinutes(" 45 ")).toEqual({ ok: true, value: 45 });
    expect(parseTravelBufferMinutes("240")).toEqual({ ok: true, value: MAX_TRAVEL_BUFFER_MINUTES });
    expect(parseTravelBufferMinutes("030")).toEqual({ ok: true, value: 30 });
  });

  it("rejects empty, negative, decimal, out-of-range or non-numeric input", () => {
    for (const input of ["", "  ", "-1", "241", "1000", "12.5", "12,5", "abc", "1e2", "+5"]) {
      expect(parseTravelBufferMinutes(input)).toEqual({ ok: false, message: INVALID });
    }
  });
});

describe("isTravelBufferChanged", () => {
  it("is true only for a valid value different from the saved one", () => {
    expect(isTravelBufferChanged("45", 30)).toBe(true);
    expect(isTravelBufferChanged("0", 30)).toBe(true);
    expect(isTravelBufferChanged("30", 30)).toBe(false);
    expect(isTravelBufferChanged(" 030 ", 30)).toBe(false);
    expect(isTravelBufferChanged("", 30)).toBe(false);
    expect(isTravelBufferChanged("300", 30)).toBe(false);
  });
});
