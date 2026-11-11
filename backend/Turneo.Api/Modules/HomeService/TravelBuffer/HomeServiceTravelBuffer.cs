namespace Turneo.Api.Modules.HomeService.TravelBuffer;

// Travel time between at-home bookings: a professional who works at the
// client's address needs the business's travel buffer (BusinessSettings,
// default 30 min, 0 disables it) between two active at-home bookings.
// On-site bookings never take part in the rule. The rule is applied on the
// bookings' real ranges by AgendaAvailability.
public static class HomeServiceTravelBuffer
{
    public const string InsideBufferMessage = "Ese horario no deja tiempo de traslado con otro turno a domicilio";

    // A range is inside the buffer when it starts less than `buffer` after the
    // other booking ends and ends less than `buffer` before it starts.
    public static bool IsInsideBuffer(DateTime start, DateTime end, DateTime otherStart, DateTime otherEnd, TimeSpan buffer) =>
        buffer > TimeSpan.Zero && start < otherEnd + buffer && end > otherStart - buffer;
}
