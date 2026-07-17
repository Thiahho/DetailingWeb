namespace TTurnos.Api.Core.Notifications;

public static class NotificationEventType
{
    public const string BookingCreated = "BookingCreated";
    public const string BookingConfirmed = "BookingConfirmed";
    public const string BookingReminder24h = "BookingReminder24h";

    // Aviso al profesional asignado (no al cliente) de que se le cargó un turno nuevo.
    public const string ProfessionalBookingCreated = "ProfessionalBookingCreated";
}
