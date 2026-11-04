import { describe, expect, it } from "vitest";
import {
  addMinutesToWallClock,
  bookingRange,
  bookingTimeLabel,
  buildAvailableSlotsUrl,
  continuationOwners,
  formatTimeRange,
  mergeBookingRanges,
  slotOccupancy,
  wallClockTime,
} from "@/src/lib/bookingRange";

const slot = { startDateTime: "2026-11-05T10:00:00", endDateTime: "2026-11-05T11:00:00" };

describe("bookingRange", () => {
  it("uses the booking's own range when the API sends it", () => {
    expect(
      bookingRange({ ...slot, bookingStartDateTime: "2026-11-05T10:00:00", bookingEndDateTime: "2026-11-05T13:00:00" })
    ).toEqual({ start: "2026-11-05T10:00:00", end: "2026-11-05T13:00:00" });
  });

  it("falls back to the slot times when the range is absent", () => {
    expect(bookingRange(slot)).toEqual({ start: "2026-11-05T10:00:00", end: "2026-11-05T11:00:00" });
    expect(bookingRange({ ...slot, bookingStartDateTime: null, bookingEndDateTime: null })).toEqual({
      start: "2026-11-05T10:00:00",
      end: "2026-11-05T11:00:00",
    });
  });
});

describe("wallClockTime", () => {
  it("reads HH:mm from the wall-clock string without going through a time zone", () => {
    expect(wallClockTime("2026-11-05T09:05:00")).toBe("09:05");
    expect(wallClockTime("2026-11-05T23:30:00Z")).toBe("23:30");
    expect(wallClockTime("2026-11-05T13:00:00.000")).toBe("13:00");
  });

  it("returns an empty string for a value without time", () => {
    expect(wallClockTime("")).toBe("");
    expect(wallClockTime("2026-11-05")).toBe("");
  });
});

describe("formatTimeRange", () => {
  it("formats start and end as HH:mm – HH:mm", () => {
    expect(formatTimeRange({ start: "2026-11-05T10:00:00", end: "2026-11-05T13:00:00" })).toBe("10:00 – 13:00");
  });

  it("shows only the start when the end is missing", () => {
    expect(formatTimeRange({ start: "2026-11-05T10:00:00", end: "" })).toBe("10:00");
  });
});

describe("addMinutesToWallClock", () => {
  it("adds minutes keeping the wall-clock format", () => {
    expect(addMinutesToWallClock("2026-11-05T10:00:00", 180)).toBe("2026-11-05T13:00:00");
    expect(addMinutesToWallClock("2026-11-05T23:30:00", 45)).toBe("2026-11-06T00:15:00");
  });
});

describe("slotOccupancy", () => {
  it("is booked when the slot has its own active booking", () => {
    expect(slotOccupancy({ isAvailable: false, booking: { id: 7 }, occupiedByBookingId: 7 })).toBe("booked");
  });

  it("is a continuation when another booking's range covers the slot", () => {
    expect(slotOccupancy({ isAvailable: false, booking: null, occupiedByBookingId: 7 })).toBe("continuation");
    // Even if a stale flag says available, the overlapping booking wins.
    expect(slotOccupancy({ isAvailable: true, occupiedByBookingId: 7 })).toBe("continuation");
  });

  it("is free when available and not occupied", () => {
    expect(slotOccupancy({ isAvailable: true, booking: null, occupiedByBookingId: null })).toBe("free");
    expect(slotOccupancy({ isAvailable: true })).toBe("free");
  });

  it("is closed when not available and nobody occupies it (blocked or disabled)", () => {
    expect(slotOccupancy({ isAvailable: false, occupiedByBookingId: null })).toBe("closed");
  });
});

describe("buildAvailableSlotsUrl", () => {
  it("always sends the service slug when one is chosen", () => {
    expect(buildAvailableSlotsUrl({ serviceSlug: "lavado-completo" })).toBe(
      "/api/timeslots/available?serviceSlug=lavado-completo"
    );
    expect(buildAvailableSlotsUrl({ professionalId: 3, serviceSlug: "ceramico" })).toBe(
      "/api/timeslots/available?professionalId=3&serviceSlug=ceramico"
    );
  });

  it("omits empty parameters", () => {
    expect(buildAvailableSlotsUrl({ professionalId: null, serviceSlug: "" })).toBe("/api/timeslots/available");
    expect(buildAvailableSlotsUrl()).toBe("/api/timeslots/available");
  });
});

describe("mergeBookingRanges", () => {
  it("copies the real range of each booking into the slot's nested booking", () => {
    const slots = [
      { id: 1, ...slot, booking: { id: 7, customerName: "Ana" } },
      { id: 2, ...slot, booking: undefined },
    ];
    const merged = mergeBookingRanges(slots, [
      { id: 7, bookingStartDateTime: "2026-11-05T10:00:00", bookingEndDateTime: "2026-11-05T13:00:00" },
    ]);
    expect(merged[0].booking).toEqual({
      id: 7,
      customerName: "Ana",
      bookingStartDateTime: "2026-11-05T10:00:00",
      bookingEndDateTime: "2026-11-05T13:00:00",
    });
    expect(merged[1].booking).toBeUndefined();
  });

  it("leaves a booking unchanged when the list has no range for it", () => {
    const slots = [{ id: 1, ...slot, booking: { id: 8 } }];
    expect(mergeBookingRanges(slots, [])[0].booking).toEqual({ id: 8 });
  });
});

describe("bookingTimeLabel", () => {
  it("shows the real range when the booking outlasts its slot", () => {
    expect(bookingTimeLabel({ ...slot, bookingStartDateTime: slot.startDateTime, bookingEndDateTime: "2026-11-05T13:00:00" })).toBe(
      "10:00 – 13:00"
    );
  });

  it("shows only the start time when the booking lasts its slot or has no range", () => {
    expect(bookingTimeLabel({ ...slot, bookingStartDateTime: slot.startDateTime, bookingEndDateTime: slot.endDateTime })).toBe("10:00");
    expect(bookingTimeLabel(slot)).toBe("10:00");
  });
});

describe("mergeBookingRanges after a move", () => {
  it("ignores a stale range that no longer starts at the slot", () => {
    const slots = [{ id: 1, ...slot, booking: { id: 7 } }];
    const merged = mergeBookingRanges(slots, [
      { id: 7, bookingStartDateTime: "2026-11-04T09:00:00", bookingEndDateTime: "2026-11-04T12:00:00" },
    ]);
    expect(merged[0].booking).toEqual({ id: 7 });
  });
});

describe("continuationOwners", () => {
  const owner = {
    id: 1,
    startDateTime: "2026-11-05T10:00:00",
    endDateTime: "2026-11-05T11:00:00",
    booking: { id: 7, bookingStartDateTime: "2026-11-05T10:00:00", bookingEndDateTime: "2026-11-05T12:30:00" },
    occupiedByBookingId: 7,
  };
  const covered = { id: 2, startDateTime: "2026-11-05T11:00:00", endDateTime: "2026-11-05T12:00:00", occupiedByBookingId: 7 };
  const partly = { id: 3, startDateTime: "2026-11-05T12:00:00", endDateTime: "2026-11-05T13:00:00", occupiedByBookingId: 7 };
  const orphan = { id: 4, startDateTime: "2026-11-05T15:00:00", endDateTime: "2026-11-05T16:00:00", occupiedByBookingId: 9 };
  const free = { id: 5, startDateTime: "2026-11-05T16:00:00", endDateTime: "2026-11-05T17:00:00", occupiedByBookingId: null };

  it("maps each continuation slot to the slot where its booking starts", () => {
    const owners = continuationOwners([owner, covered, partly, orphan, free]);
    expect(owners.get(2)).toEqual({ ownerSlotId: 1, coveredByOwnerBlock: true });
    // The booking ends at 12:30: the 12:00–13:00 slot is occupied but not covered by the block.
    expect(owners.get(3)).toEqual({ ownerSlotId: 1, coveredByOwnerBlock: false });
  });

  it("keeps a continuation whose booking starts outside the loaded slots, without owner", () => {
    expect(continuationOwners([orphan]).get(4)).toEqual({ ownerSlotId: null, coveredByOwnerBlock: false });
  });

  it("ignores booked and free slots", () => {
    const owners = continuationOwners([owner, free]);
    expect(owners.has(1)).toBe(false);
    expect(owners.has(5)).toBe(false);
  });
});
