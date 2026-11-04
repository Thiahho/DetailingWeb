using Turneo.Api.Modules.HomeService.TravelBuffer;

namespace Turneo.Api.Core.Scheduling;

// The single availability rule for placing a booking at a start slot, used by
// the public listing and by every booking write (create, public and admin
// reschedule, admin edit that changes the service). Pure: the data comes from
// BookingAvailability, so the rule is unit-testable without a database.
//
// A booking occupies [start slot start, start + service duration), or its start
// slot when the service has no duration (BookingTimeRange). The range is
// bookable when, in this order:
//   1. it overlaps no active booking of the same professional (bookings without
//      professional share one resource, like the database exclusion constraint);
//      the booking being moved or edited is left out;
//   2. it is covered by the business' open slots of the start slot's
//      professional scope, chained from the start slot (AgendaCoverage);
//   3. for an at-home booking, it keeps the travel buffer with the
//      professional's other active at-home bookings, on their real ranges.

// A TimeSlot as the rule sees it. IsAvailable is not part of it: a slot taken
// by another booking breaks a range only through the overlap check.
public readonly record struct AgendaSlot(int Id, int? ProfessionalId, DateTime Start, DateTime End, bool IsBlocked);

// An active (not cancelled) booking's real range. AtHome = the booking has the
// at-home snapshot (HomeServiceSurcharge).
public readonly record struct OccupiedRange(int BookingId, int? ProfessionalId, DateTime Start, DateTime End, bool AtHome, int? TimeSlotId = null);

// A BlockedDates row: null professional blocks the whole business that day.
public readonly record struct BlockedDay(DateTime Date, int? ProfessionalId);

// ProfessionalId is the professional the booking would store (the start
// slot's, or the one chosen by the client for an unassigned slot).
public sealed record BookingCandidate(AgendaSlot StartSlot, int? ProfessionalId, DateTime End, bool AtHome, int? ExcludeBookingId = null)
{
    public DateTime Start => StartSlot.Start;
}

public enum AvailabilityVerdict
{
    Available,
    Overlap,
    NotCovered,
    InsideTravelBuffer
}

public static class AgendaCoverage
{
    // User decision (2026-11-04): a gap up to 30 min between one open slot's
    // end and the next one's start still counts as continuous agenda; a longer
    // gap (lunch, end of day) breaks coverage.
    public const int MaxCoverageGapMinutes = 30;

    private static readonly TimeSpan MaxGap = TimeSpan.FromMinutes(MaxCoverageGapMinutes);

    // True when [start, end) is covered by the given open slots chained from a
    // slot that contains start. No tolerance before the start itself.
    public static bool IsCovered(DateTime start, DateTime end, IEnumerable<(DateTime Start, DateTime End)> openSlots)
    {
        var slots = openSlots.Where(s => s.End > s.Start).ToList();
        var coveredUntil = start;
        var tolerance = TimeSpan.Zero;

        while (coveredUntil < end)
        {
            DateTime? reach = null;
            foreach (var slot in slots)
            {
                if (slot.Start <= coveredUntil + tolerance && slot.End > coveredUntil && (reach is null || slot.End > reach))
                    reach = slot.End;
            }

            if (reach is null)
                return false;

            coveredUntil = reach.Value;
            tolerance = MaxGap;
        }

        return true;
    }
}

// Slots, active bookings and blocked days of one time window, evaluated in memory.
public sealed class AgendaSnapshot
{
    private readonly ILookup<int, AgendaSlot> _slotsByProfessional;
    private readonly ILookup<int, OccupiedRange> _bookingsByProfessional;
    private readonly IReadOnlyList<OccupiedRange> _bookings;
    private readonly IReadOnlyList<BlockedDay> _blockedDays;
    private readonly TimeSpan _travelBuffer;

    public AgendaSnapshot(IEnumerable<AgendaSlot> slots, IEnumerable<OccupiedRange> bookings, IEnumerable<BlockedDay> blockedDays, TimeSpan travelBuffer)
    {
        _slotsByProfessional = slots.ToLookup(s => Resource(s.ProfessionalId));
        _bookings = bookings.ToList();
        _bookingsByProfessional = _bookings.ToLookup(b => Resource(b.ProfessionalId));
        _blockedDays = blockedDays.ToList();
        _travelBuffer = travelBuffer;
    }

    // Same resource key as the database constraint: COALESCE(ProfessionalId, 0).
    private static int Resource(int? professionalId) => professionalId ?? 0;

    private static bool Overlaps(DateTime start, DateTime end, DateTime otherStart, DateTime otherEnd) =>
        start < otherEnd && end > otherStart;

    public AvailabilityVerdict Evaluate(BookingCandidate candidate)
    {
        var start = candidate.Start;
        var end = candidate.End;
        var sameProfessional = _bookingsByProfessional[Resource(candidate.ProfessionalId)]
            .Where(b => b.BookingId != candidate.ExcludeBookingId)
            .ToList();

        if (sameProfessional.Any(b => Overlaps(start, end, b.Start, b.End)))
            return AvailabilityVerdict.Overlap;

        if (!IsCovered(candidate))
            return AvailabilityVerdict.NotCovered;

        if (candidate.AtHome && _travelBuffer > TimeSpan.Zero
            && sameProfessional.Any(b => b.AtHome && HomeServiceTravelBuffer.IsInsideBuffer(start, end, b.Start, b.End, _travelBuffer)))
            return AvailabilityVerdict.InsideTravelBuffer;

        return AvailabilityVerdict.Available;
    }

    // The active booking that makes a slot unavailable: its own booking, or one
    // of the slot's professional whose range overlaps it. Null when free.
    public int? OccupyingBookingId(AgendaSlot slot)
    {
        foreach (var booking in _bookings)
        {
            if (booking.TimeSlotId == slot.Id)
                return booking.BookingId;
        }

        foreach (var booking in _bookingsByProfessional[Resource(slot.ProfessionalId)])
        {
            if (booking.ProfessionalId == slot.ProfessionalId && Overlaps(slot.Start, slot.End, booking.Start, booking.End))
                return booking.BookingId;
        }

        return null;
    }

    private bool IsCovered(BookingCandidate candidate)
    {
        var startSlot = candidate.StartSlot;
        if (!IsOpen(startSlot, candidate.ProfessionalId))
            return false;

        var openSlots = _slotsByProfessional[Resource(startSlot.ProfessionalId)]
            .Where(s => s.ProfessionalId == startSlot.ProfessionalId
                && s.Start < candidate.End && s.End > candidate.Start
                && IsOpen(s, candidate.ProfessionalId))
            .Select(s => (s.Start, s.End))
            .Append((startSlot.Start, startSlot.End));

        return AgendaCoverage.IsCovered(candidate.Start, candidate.End, openSlots);
    }

    // Open = not disabled by hand and not on a day blocked for the whole
    // business or for the professional the booking would belong to.
    private bool IsOpen(AgendaSlot slot, int? bookingProfessionalId)
    {
        if (slot.IsBlocked)
            return false;

        var professionalId = slot.ProfessionalId ?? bookingProfessionalId;
        var day = slot.Start.Date;
        return !_blockedDays.Any(d => d.Date.Date == day && (d.ProfessionalId == null || d.ProfessionalId == professionalId));
    }
}
