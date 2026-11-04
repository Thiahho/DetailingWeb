import { describe, expect, it } from "vitest";
import { buildTimeslotsUrl, calendarVisibleRange, defaultAgendaRange, toLocalDateStr } from "@/src/lib/bookings/slotRange";

describe("toLocalDateStr", () => {
  it("formats the local calendar day without going through UTC", () => {
    expect(toLocalDateStr(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toLocalDateStr(new Date(2026, 10, 30, 0, 0))).toBe("2026-11-30");
  });
});

describe("buildTimeslotsUrl", () => {
  it("adds only the bounds that are set", () => {
    expect(buildTimeslotsUrl({ from: "2026-11-01", to: "2026-11-30" })).toBe("/api/timeslots?from=2026-11-01&to=2026-11-30");
    expect(buildTimeslotsUrl({ from: "2026-11-01" })).toBe("/api/timeslots?from=2026-11-01");
    expect(buildTimeslotsUrl({ to: "2026-11-30" })).toBe("/api/timeslots?to=2026-11-30");
    expect(buildTimeslotsUrl({})).toBe("/api/timeslots");
    expect(buildTimeslotsUrl()).toBe("/api/timeslots");
  });
});

describe("defaultAgendaRange", () => {
  it("covers the last 30 days and the next 90 days", () => {
    expect(defaultAgendaRange(new Date(2026, 10, 3, 15, 0))).toEqual({ from: "2026-10-04", to: "2027-02-01" });
  });
});

describe("calendarVisibleRange", () => {
  it("month view covers the whole displayed month", () => {
    expect(calendarVisibleRange("month", { year: 2026, month: 2 }, new Date(2026, 10, 3))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(calendarVisibleRange("month", { year: 2026, month: 12 }, new Date(2026, 10, 3))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("week and day views cover a week on each side of the agenda date", () => {
    const agendaDate = new Date(2026, 11, 29);
    expect(calendarVisibleRange("week", { year: 2026, month: 11 }, agendaDate)).toEqual({ from: "2026-12-22", to: "2027-01-05" });
    expect(calendarVisibleRange("day", { year: 2026, month: 11 }, agendaDate)).toEqual({ from: "2026-12-22", to: "2027-01-05" });
  });
});
