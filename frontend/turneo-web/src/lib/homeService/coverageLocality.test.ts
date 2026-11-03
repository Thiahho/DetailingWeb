import { describe, expect, it } from "vitest";
import {
  coverageLocalityFromSuggestion,
  formatSurcharge,
  parseSurcharge,
  toCoverageLocalityRequest,
  type CoverageLocality,
} from "@/src/lib/homeService/coverageLocality";

describe("parseSurcharge", () => {
  it("treats an empty input as no surcharge", () => {
    expect(parseSurcharge("")).toEqual({ ok: true, value: null });
    expect(parseSurcharge("   ")).toEqual({ ok: true, value: null });
  });

  it("parses plain and Argentine-formatted amounts", () => {
    expect(parseSurcharge("1500")).toEqual({ ok: true, value: 1500 });
    expect(parseSurcharge("1.500")).toEqual({ ok: true, value: 1500 });
    expect(parseSurcharge("$ 12.345,50")).toEqual({ ok: true, value: 12345.5 });
    expect(parseSurcharge("0")).toEqual({ ok: true, value: 0 });
  });

  it("rejects negative, non-numeric and over-precise amounts", () => {
    expect(parseSurcharge("-100").ok).toBe(false);
    expect(parseSurcharge("abc").ok).toBe(false);
    expect(parseSurcharge("10,555").ok).toBe(false);
    expect(parseSurcharge("1,2,3").ok).toBe(false);
  });

  it("rejects amounts above the backend maximum", () => {
    expect(parseSurcharge("9999999999,99")).toEqual({ ok: true, value: 9999999999.99 });
    expect(parseSurcharge("10000000000").ok).toBe(false);
  });

  it("returns a Spanish message on failure", () => {
    const result = parseSurcharge("abc");
    expect(result.ok).toBe(false);
    expect("message" in result && result.message).toMatch(/recargo/i);
  });
});

describe("formatSurcharge", () => {
  it("formats the stored value for the edit input", () => {
    expect(formatSurcharge(null)).toBe("");
    expect(formatSurcharge(1500)).toBe("1.500");
    expect(formatSurcharge(1500.5)).toBe("1.500,50");
  });

  it("round-trips through parseSurcharge", () => {
    for (const value of [0, 1500, 1500.5, 9999999999.99]) {
      expect(parseSurcharge(formatSurcharge(value))).toEqual({ ok: true, value });
    }
  });
});

describe("coverageLocalityFromSuggestion", () => {
  it("fills name and province from a Georef suggestion", () => {
    const draft = coverageLocalityFromSuggestion({ nombre: " Quilmes ", partido: "Quilmes", provincia: "Buenos Aires", lat: 1, lng: 2 });
    expect(draft).toEqual({ name: "Quilmes", province: "Buenos Aires", georefId: null });
  });
});

describe("toCoverageLocalityRequest", () => {
  const stored: CoverageLocality = {
    id: 7,
    name: "Quilmes",
    province: "Buenos Aires",
    georefId: "0645",
    surcharge: 1500,
    isActive: true,
  };

  it("keeps every field of the stored locality, so a PUT does not clear georefId", () => {
    expect(toCoverageLocalityRequest(stored)).toEqual({
      name: "Quilmes",
      province: "Buenos Aires",
      georefId: "0645",
      surcharge: 1500,
      isActive: true,
    });
  });

  it("applies a patch on top of the stored values", () => {
    expect(toCoverageLocalityRequest(stored, { surcharge: null, isActive: false })).toEqual({
      name: "Quilmes",
      province: "Buenos Aires",
      georefId: "0645",
      surcharge: null,
      isActive: false,
    });
  });
});
