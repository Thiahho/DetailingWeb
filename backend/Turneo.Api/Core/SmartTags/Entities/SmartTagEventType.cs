namespace Turneo.Api.Core.SmartTags;

// Esta implementación (Fases 1-3 del PRD) solo emite Interaction. El resto
// queda definido para que la Fase 4 (acciones BOOKING/REBOOK/REVIEW) no
// necesite una migración nueva.
public static class SmartTagEventType
{
    public const string Interaction = "INTERACTION";
    public const string BookingStarted = "BOOKING_STARTED";
    public const string BookingCompleted = "BOOKING_COMPLETED";
    public const string RebookStarted = "REBOOK_STARTED";
    public const string ReviewStarted = "REVIEW_STARTED";
    public const string ReviewCompleted = "REVIEW_COMPLETED";
}
