import { describe, expect, it } from "vitest";
import {
  DURATION_MINUTES_ERROR,
  durationMinutesToInput,
  parseDurationMinutes,
  validateDurationMinutesInput,
  withDurationMinutes,
} from "@/src/lib/services/serviceDuration";

describe("parseDurationMinutes", () => {
  it("parses whole minutes from the form input or the backend value", () => {
    expect(parseDurationMinutes("180")).toBe(180);
    expect(parseDurationMinutes(" 90 ")).toBe(90);
    expect(parseDurationMinutes(45)).toBe(45);
  });

  it("returns null for an empty value (the booking lasts its start slot)", () => {
    expect(parseDurationMinutes("")).toBeNull();
    expect(parseDurationMinutes("   ")).toBeNull();
    expect(parseDurationMinutes(null)).toBeNull();
    expect(parseDurationMinutes(undefined)).toBeNull();
  });

  it("returns null for values the backend would reject", () => {
    expect(parseDurationMinutes("abc")).toBeNull();
    expect(parseDurationMinutes("90.5")).toBeNull();
    expect(parseDurationMinutes(90.5)).toBeNull();
    expect(parseDurationMinutes("-30")).toBeNull();
    expect(parseDurationMinutes("4")).toBeNull();
    expect(parseDurationMinutes("1441")).toBeNull();
    expect(parseDurationMinutes(Number.NaN)).toBeNull();
  });

  it("accepts the bounds", () => {
    expect(parseDurationMinutes("5")).toBe(5);
    expect(parseDurationMinutes("1440")).toBe(1440);
  });
});

describe("validateDurationMinutesInput", () => {
  it("accepts an empty input and whole minutes in range", () => {
    expect(validateDurationMinutesInput("")).toBeNull();
    expect(validateDurationMinutesInput("  ")).toBeNull();
    expect(validateDurationMinutesInput("180")).toBeNull();
  });

  it("rejects a non-empty input the backend would reject", () => {
    expect(validateDurationMinutesInput("abc")).toBe(DURATION_MINUTES_ERROR);
    expect(validateDurationMinutesInput("4")).toBe(DURATION_MINUTES_ERROR);
    expect(validateDurationMinutesInput("1441")).toBe(DURATION_MINUTES_ERROR);
    expect(validateDurationMinutesInput("90.5")).toBe(DURATION_MINUTES_ERROR);
  });
});

describe("durationMinutesToInput", () => {
  it("shows the stored minutes, or an empty input when the service has none", () => {
    expect(durationMinutesToInput(180)).toBe("180");
    expect(durationMinutesToInput(null)).toBe("");
    expect(durationMinutesToInput(undefined)).toBe("");
  });
});

describe("withDurationMinutes", () => {
  it("always sets durationMinutes, even when the source object lacks it", () => {
    expect(withDurationMinutes({ title: "Lavado" }, "180")).toEqual({ title: "Lavado", durationMinutes: 180 });
  });

  it("sends null for an empty value so the full-replace PUT clears it explicitly", () => {
    const payload = withDurationMinutes({ title: "Lavado" }, "");
    expect(payload).toHaveProperty("durationMinutes", null);
    expect(JSON.parse(JSON.stringify(payload))).toEqual({ title: "Lavado", durationMinutes: null });
  });

  it("overrides the form string with the parsed number", () => {
    const source = { title: "Lavado", durationMinutes: "90" };
    expect(withDurationMinutes(source, source.durationMinutes).durationMinutes).toBe(90);
  });

  it("keeps the backend value on a bulk resend", () => {
    expect(withDurationMinutes({ isActive: false }, 240).durationMinutes).toBe(240);
    expect(withDurationMinutes({ isActive: false }, null).durationMinutes).toBeNull();
  });
});
