// Date range sent to `GET /api/timeslots?from=&to=`. Both bounds are inclusive
// calendar days (yyyy-MM-dd) in the business' wall clock, the same one slot
// StartDateTime is stored in; a missing bound is open-ended on that side.

export interface SlotRange {
  from?: string;
  to?: string;
}

/** Local calendar day as yyyy-MM-dd, without going through UTC. */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function buildTimeslotsUrl(range: SlotRange = {}): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const query = params.toString();
  return query ? `/api/timeslots?${query}` : "/api/timeslots";
}

/** `/admin/turnos` default window: the last 30 days (recent "Expirado") and the next 90. */
export function defaultAgendaRange(today: Date): Required<SlotRange> {
  return { from: toLocalDateStr(addDays(today, -30)), to: toLocalDateStr(addDays(today, 90)) };
}

/**
 * `/admin/calendario` visible range: the displayed month in month view; a week
 * on each side of the agenda date in week/day view (covers the whole week grid
 * whatever its first weekday, and the drag-to-reschedule targets on screen).
 */
export function calendarVisibleRange(
  viewMode: "month" | "week" | "day",
  current: { year: number; month: number },
  agendaDate: Date
): Required<SlotRange> {
  if (viewMode === "month") {
    return {
      from: toLocalDateStr(new Date(current.year, current.month - 1, 1)),
      to: toLocalDateStr(new Date(current.year, current.month, 0)),
    };
  }
  return { from: toLocalDateStr(addDays(agendaDate, -7)), to: toLocalDateStr(addDays(agendaDate, 7)) };
}
