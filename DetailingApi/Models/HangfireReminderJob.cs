using DetailingApi.Data;
using DetailingApi.Models;
using DetailingApi.Services;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Models;

public class HangfireReminderJob(
    ApplicationDbContext db,
    INotificationProvider wsp,
    NotificationService notificationService,
    IConfiguration configuration,
    ILogger<HangfireReminderJob> logger
)
{
    // Margen para no perder reminders en el borde del ciclo de 5 min
    private readonly TimeSpan _lookahead = TimeSpan.FromMinutes(6);

    public async Task ProcessPendingRemindersAsync()
    {
        // Cuántos minutos antes del turno se envía el aviso.
        // Dev/test: 5 | Prod: 1440 (24h)
        var notifyBeforeMinutes = configuration.GetValue<int?>("Notifications:ReminderNotifyBeforeMinutes") ?? (24 * 60);

        // Buscar reminders cuyo turno esté dentro de la ventana: ahora + notifyBefore ± lookahead
        var threshold = DateTime.UtcNow.AddMinutes(notifyBeforeMinutes).Add(_lookahead);

        var pending = await db.ScheduledReminders
            .Include(x => x.CustomerProfile)
            .Where(x => x.Status == ReminderStatus.Pending && x.ScheduledFor <= threshold)
            .ToListAsync();

        if (pending.Count == 0) return;

        logger.LogInformation("Procesando {Count} recordatorios pendientes.", pending.Count);

        foreach (var reminder in pending)
            await ProcessSingleReminderAsync(reminder);
    }

    private async Task ProcessSingleReminderAsync(ScheduledReminder reminder)
    {
        var log = new ReminderLog
        {
            ScheduledReminderId = reminder.Id,
            Channel = "WhatsApp",
            AttemptedAt = DateTime.UtcNow
        };

        try
        {
            // ── Con booking vinculado: usar NotificationService completo (email + WhatsApp) ──
            if (reminder.BookingId.HasValue)
            {
                log.Channel = "Email+WhatsApp";
                await notificationService.DispatchForBookingAsync(
                    reminder.BookingId.Value,
                    NotificationEventType.BookingReminder24h
                );
                log.Status = "Sent";
            }
            else
            {
                // ── Sin booking: solo WhatsApp directo ──
                var message = BuildMessage(reminder);
                var result = await wsp.SendDirectAsync(reminder.CustomerProfile.Phone, message);
                log.Status = "Sent";
                log.ProviderMessageId = result.ProviderMessageId;
            }

            reminder.Status = ReminderStatus.Sent;
            reminder.SentAt = DateTime.UtcNow;

            // Programar siguiente si es recurrente
            if (reminder.IntervalDays.HasValue)
            {
                var next = new ScheduledReminder
                {
                    CustomerProfileId = reminder.CustomerProfileId,
                    BookingId         = reminder.BookingId,
                    ServiceLabel      = reminder.ServiceLabel,
                    ScheduledFor      = reminder.ScheduledFor.AddDays(reminder.IntervalDays.Value),
                    IntervalDays      = reminder.IntervalDays,
                    MessageTemplate   = reminder.MessageTemplate,
                    Status            = ReminderStatus.Pending
                };
                db.ScheduledReminders.Add(next);
                reminder.NextReminderDate = next.ScheduledFor;
            }
        }
        catch (Exception ex)
        {
            log.Status = "Failed";
            log.ErrorMessage = ex.Message;
            reminder.Status = ReminderStatus.Failed;
            logger.LogError(ex, "Error enviando recordatorio {ReminderId}", reminder.Id);
        }
        finally
        {
            db.ReminderLogs.Add(log);
            await db.SaveChangesAsync();
        }
    }

    private static string BuildMessage(ScheduledReminder reminder)
    {
        if (!string.IsNullOrEmpty(reminder.MessageTemplate))
            return reminder.MessageTemplate
                .Replace("{nombre}", reminder.CustomerProfile.Name)
                .Replace("{servicio}", reminder.ServiceLabel)
                .Replace("{fecha}", reminder.ScheduledFor.ToString("dd/MM/yyyy HH:mm"));

        return $"Hola {reminder.CustomerProfile.Name} 👋, " +
               $"te recordamos que tenés tu turno de *{reminder.ServiceLabel}* " +
               $"el {reminder.ScheduledFor:dd/MM/yyyy} a las {reminder.ScheduledFor:HH:mm}. " +
               $"¡Te esperamos!";
    }
}
