namespace Turneo.Api.Core.Notifications;

// Wrapper Hangfire (ver BackgroundJobsSetup) para que las notificaciones de un
// booking (email/WhatsApp/Telegram al cliente, profesional y admins) no bloqueen
// la respuesta HTTP del endpoint que las dispara — un SMTP lento (hasta 30s en
// GmailProvider) o una API externa caída dejaba al cliente esperando la reserva
// en el navegador. Encolado, la respuesta HTTP vuelve apenas se persiste el booking.
public class BookingNotificationJob(
    NotificationService notificationService,
    ICurrentTenant currentTenant,
    ILogger<BookingNotificationJob> logger)
{
    public async Task DispatchAsync(int bookingId, string eventType)
    {
        // Cross-tenant a propósito: el job corre en un scope propio sin tenant
        // ambiental (el HTTP request que lo encoló ya terminó) — sin esto, RLS
        // filtraría todas las queries. El bookingId ya identifica un único
        // tenant sin ambigüedad, igual que en NotificationService.DispatchForBookingAsync.
        currentTenant.SetBypass();

        try
        {
            await notificationService.DispatchForBookingAsync(bookingId, eventType);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error despachando notificaciones del booking {BookingId} ({EventType})", bookingId, eventType);
            throw; // Hangfire reintenta automáticamente los jobs fallidos
        }
    }
}
