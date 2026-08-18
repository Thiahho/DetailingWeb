namespace Turneo.Api.Core.Notifications;

public static class NotificationEventType
{
    public const string BookingCreated = "BookingCreated";
    public const string BookingConfirmed = "BookingConfirmed";
    public const string BookingCancelled = "BookingCancelled";
    public const string BookingReminder24h = "BookingReminder24h";

    // Aviso al profesional asignado (no al cliente) de que se le cargó un turno nuevo.
    public const string ProfessionalBookingCreated = "ProfessionalBookingCreated";

    // Avisos a los Admin del tenant — antes los mandaba el frontend Next.js por
    // su cuenta (nodemailer), migrados acá para que todo el email de reservas
    // salga por un solo canal (ver GmailProvider).
    public const string AdminBookingCreated = "AdminBookingCreated";
    public const string AdminBookingCancelled = "AdminBookingCancelled";
}
