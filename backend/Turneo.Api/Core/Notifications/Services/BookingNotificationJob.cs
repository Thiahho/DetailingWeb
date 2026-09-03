using Hangfire;

namespace Turneo.Api.Core.Notifications;

// Wrapper Hangfire (ver BackgroundJobsSetup) para que las notificaciones de un
// booking (email/WhatsApp/Telegram al cliente, profesional y admins) no bloqueen
// la respuesta HTTP del endpoint que las dispara — un SMTP lento (hasta 30s en
// GmailProvider) o una API externa caída dejaba al cliente esperando la reserva
// en el navegador. Encolado, la respuesta HTTP vuelve apenas se persiste el booking.
//
// AutomaticRetry en 0 a propósito: DispatchForBookingAsync no es idempotente
// (no chequea si un canal ya mandó antes de crear su NotificationLog), así que
// dejar el reintento automático de Hangfire prendido reenviaba TODO de nuevo
// (incluido lo que ya había salido bien, ej. el email) cada vez que algo tiraba
// una excepción — el reintento de verdad ya lo maneja NotificationRetryBackgroundService
// por canal individual, vía NotificationLog.
[AutomaticRetry(Attempts = 0)]
public class BookingNotificationJob(
    NotificationService notificationService,
    ICurrentTenant currentTenant,
    ILogger<BookingNotificationJob> logger)
{
    public async Task DispatchAsync(int bookingId, string eventType, DateTime? previousStartDateTime = null)
    {
        // Cross-tenant a propósito: el job corre en un scope propio sin tenant
        // ambiental (el HTTP request que lo encoló ya terminó) — sin esto, RLS
        // filtraría todas las queries. El bookingId ya identifica un único
        // tenant sin ambigüedad, igual que en NotificationService.DispatchForBookingAsync.
        currentTenant.SetBypass();

        try
        {
            await notificationService.DispatchForBookingAsync(bookingId, eventType, previousStartDateTime);
        }
        catch (Exception ex)
        {
            // No re-throw: con AutomaticRetry(0) Hangfire lo marcaría "Failed" igual,
            // pero preferimos que quede como job completado con el error en el log de
            // aplicación antes que como falla visible en el dashboard de Hangfire sin
            // ninguna acción posible sobre ella (no hay reintento que la resuelva).
            logger.LogError(ex, "Error despachando notificaciones del booking {BookingId} ({EventType})", bookingId, eventType);
        }
    }
}
