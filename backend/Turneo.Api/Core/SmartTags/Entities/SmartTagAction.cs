namespace Turneo.Api.Core.SmartTags;

// Constantes en vez de enum para poder extender sin migraciones de tipo (mismo
// criterio que AutomationTriggerType/NotificationEventType/BookingStatus).
public static class SmartTagAction
{
    public const string Booking = "BOOKING";
    public const string Rebook = "REBOOK";
    public const string Review = "REVIEW";
    // Redirecciones simples (docs/NFC.md sección 7, "futuras acciones"): sin
    // paso de "completado" propio — la propia INTERACTION ya marca el tap,
    // no hay un evento de negocio distinto que grabar después de redirigir.
    public const string Whatsapp = "WHATSAPP";
    public const string Instagram = "INSTAGRAM";

    public static readonly string[] All = { Booking, Rebook, Review, Whatsapp, Instagram };

    public static bool IsValid(string action) => All.Contains(action);
}
