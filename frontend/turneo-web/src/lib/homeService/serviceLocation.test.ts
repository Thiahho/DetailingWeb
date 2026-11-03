import { describe, expect, it } from "vitest";
import { normalizeLocationType, withLocationType } from "@/src/lib/homeService/serviceLocation";

describe("normalizeLocationType", () => {
  it("keeps the two backend values", () => {
    expect(normalizeLocationType("OnSite")).toBe("OnSite");
    expect(normalizeLocationType("AtHome")).toBe("AtHome");
  });

  it("accepts the numeric enum value in case the backend serializes it as a number", () => {
    expect(normalizeLocationType(0)).toBe("OnSite");
    expect(normalizeLocationType(1)).toBe("AtHome");
  });

  it("falls back to OnSite for missing or unknown values (services created before the field existed)", () => {
    expect(normalizeLocationType(undefined)).toBe("OnSite");
    expect(normalizeLocationType(null)).toBe("OnSite");
    expect(normalizeLocationType("athome")).toBe("OnSite");
    expect(normalizeLocationType("Delivery")).toBe("OnSite");
  });
});

describe("withLocationType", () => {
  it("always sets locationType on the payload, even when the source object lacks it", () => {
    const payload = withLocationType({ title: "Lavado", isActive: true }, "AtHome");
    expect(payload).toEqual({ title: "Lavado", isActive: true, locationType: "AtHome" });
  });

  it("overrides a stale or invalid locationType coming from the source object", () => {
    const source = { title: "Lavado", locationType: "Delivery" as unknown };
    expect(withLocationType(source, "OnSite").locationType).toBe("OnSite");
  });

  it("normalizes the value it is given, so the PUT never sends an unknown value", () => {
    expect(withLocationType({}, undefined).locationType).toBe("OnSite");
    expect(withLocationType({}, 1).locationType).toBe("AtHome");
  });
});
