namespace Turneo.Api.Core.Bookings;

// The time a booking occupies, Argentina wall-clock like TimeSlot. The single
// rule for every write that places a booking at a time (create, public and
// admin reschedule, admin edit that changes the service): it starts at its
// start slot and lasts the booked service's DurationMinutes, or the slot itself
// when the service has no duration (or is unknown).
public readonly record struct BookingTimeRange(DateTime Start, DateTime End)
{
    public static BookingTimeRange From(DateTime start, DateTime slotEnd, int? serviceDurationMinutes) =>
        new(start, serviceDurationMinutes is int minutes and > 0 ? start.AddMinutes(minutes) : slotEnd);

    public void ApplyTo(Booking booking)
    {
        booking.StartDateTime = Start;
        booking.EndDateTime = End;
    }
}
