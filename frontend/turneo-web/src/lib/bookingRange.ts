// Real time range of a booking. A booking starts at its slot but occupies
// [bookingStartDateTime, bookingEndDateTime) — slot start + service duration —
// which can cover several slots. Booking responses carry that range next to the
// slot times (`startDateTime`/`endDateTime`); every value is the business' wall
// clock (no offset), so times are read from the string, never through a Date.

export interface SlotTimes {
  startDateTime: string;
  endDateTime: string;
}

export interface BookingRangeFields {
  bookingStartDateTime?: string | null;
  bookingEndDateTime?: string | null;
}

export interface TimeRange {
  start: string;
  end: string;
}

/** The booking's real range, falling back to the slot times when the API does not send it. */
export function bookingRange(source: SlotTimes & BookingRangeFields): TimeRange {
  return {
    start: source.bookingStartDateTime || source.startDateTime,
    end: source.bookingEndDateTime || source.endDateTime,
  };
}

/** "HH:mm" of a wall-clock date time ("2026-11-05T10:00:00"), "" when it has no time. */
export function wallClockTime(dateTime: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(dateTime ?? "");
  return match ? `${match[1]}:${match[2]}` : "";
}

/** "10:00 – 13:00"; only the start when the end is unknown. */
export function formatTimeRange(range: TimeRange): string {
  const start = wallClockTime(range.start);
  const end = wallClockTime(range.end);
  return end && end !== start ? `${start} – ${end}` : start;
}

/**
 * Time of a booking for lists and cards: "10:00 – 13:00" when its real range
 * ends after its slot (a long service), else just the start "10:00" as before.
 */
export function bookingTimeLabel(source: SlotTimes & BookingRangeFields): string {
  const range = bookingRange(source);
  const minute = (dateTime: string) => (dateTime ?? "").replace("Z", "").slice(0, 16);
  return minute(range.end) !== minute(source.endDateTime) ? formatTimeRange(range) : wallClockTime(range.start);
}

/** Wall-clock date time plus `minutes`, in the same "yyyy-MM-ddTHH:mm:ss" format. */
export function addMinutesToWallClock(dateTime: string, minutes: number): string {
  const [datePart, timePart = "00:00"] = dateTime.replace("Z", "").split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const date = new Date(y, m - 1, d, h, min + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export type SlotOccupancy = "booked" | "continuation" | "free" | "closed";

/**
 * How an agenda slot is taken (GET api/timeslots, api/timeslots/mine):
 * - booked: an active booking starts in it;
 * - continuation: another booking's range covers it (`occupiedByBookingId`);
 * - free: open and not covered by any booking;
 * - closed: not available and not occupied (blocked or disabled).
 */
export function slotOccupancy(slot: {
  isAvailable: boolean;
  booking?: { id: number } | null;
  occupiedByBookingId?: number | null;
}): SlotOccupancy {
  if (slot.booking) return "booked";
  if (slot.occupiedByBookingId != null) return "continuation";
  return slot.isAvailable ? "free" : "closed";
}

/**
 * `GET /api/timeslots/available`. The service slug is sent for every service:
 * the API only lists start slots where that service's whole range fits.
 */
export function buildAvailableSlotsUrl(
  params: { professionalId?: number | null; serviceSlug?: string | null } = {}
): string {
  const query = new URLSearchParams();
  if (params.professionalId) query.set("professionalId", String(params.professionalId));
  if (params.serviceSlug) query.set("serviceSlug", params.serviceSlug);
  const qs = query.toString();
  return qs ? `/api/timeslots/available?${qs}` : "/api/timeslots/available";
}

/**
 * GET api/timeslots does not carry the booking range in the nested booking;
 * copy it from a booking list (GET api/bookings) that does.
 */
export function mergeBookingRanges<B extends { id: number }, S extends { booking?: B | null }>(
  slots: S[],
  bookings: ({ id: number } & BookingRangeFields)[]
): S[] {
  const ranges = new Map(bookings.map((b) => [b.id, b]));
  return slots.map((slot) => {
    const range = slot.booking ? ranges.get(slot.booking.id) : undefined;
    if (!slot.booking || !range?.bookingEndDateTime) return slot;
    return {
      ...slot,
      booking: {
        ...slot.booking,
        bookingStartDateTime: range.bookingStartDateTime,
        bookingEndDateTime: range.bookingEndDateTime,
      },
    };
  });
}
