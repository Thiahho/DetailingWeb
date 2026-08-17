using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Notifications;

public class HangfireReminderJob(
    ApplicationDbContext db,
    ICurrentTenant currentTenant,
    IEnumerable<INotificationProvider> notificationProviders,
    NotificationService notificationService,
    IConfiguration configuration,
    ILogger<HangfireReminderJob> logger
)
{
    // Margen para no perder reminders en el borde del ciclo de 5 min
    private readonly TimeSpan _lookahead = TimeSpan.FromMinutes(6);

    // En Testing solo hay un provider (Noop, Channel="Noop") — en ese caso caemos al
    // único disponible, igual que la vieja inyección directa de INotificationProvider.
    private INotificationProvider Whatsapp =>
        notificationProviders.FirstOrDefault(p => p.Channel == "WhatsApp")
        ?? notificationProviders.Last();

    private INotificationProvider? Email =>
        notificationProviders.FirstOrDefault(p => p.Channel == "Email");

    public async Task ProcessPendingRemindersAsync()
    {
        // Cross-tenant a propósito (procesa recordatorios de todos los tenants) —
        // sin esto, RLS filtraría todas las queries de este job.
        currentTenant.SetBypass();

        // Cuántos minutos antes del turno se envía el aviso.
        // Dev/test: 5 | Prod: 1440 (24h)
        var notifyBeforeMinutes = configuration.GetValue<int?>("Notifications:ReminderNotifyBeforeMinutes") ?? (24 * 60);

        // Buscar reminders cuyo turno esté dentro de la ventana: ahora + notifyBefore ± lookahead
        var threshold = DateTime.UtcNow.AddMinutes(notifyBeforeMinutes).Add(_lookahead);

        // Cross-tenant a propósito: este job procesa recordatorios de todos los tenants.
        var pending = await db.ScheduledReminders
            .IgnoreQueryFilters()
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
            TenantId = reminder.TenantId,
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
                // ── Sin booking: WhatsApp directo + email si el cliente tiene uno cargado ──
                var message = BuildMessage(reminder);
                var result = await Whatsapp.SendDirectAsync(reminder.CustomerProfile.Phone, message);
                log.Status = "Sent";
                log.ProviderMessageId = result.ProviderMessageId;
                log.Channel = "WhatsApp";

                // Best-effort: si falla el email no marcamos el recordatorio como fallido,
                // el WhatsApp ya se mandó (canal principal para este tipo de aviso).
                if (Email is not null && !string.IsNullOrWhiteSpace(reminder.CustomerProfile.Email))
                {
                    try
                    {
                        var emailResult = await Email.SendToAddressAsync(
                            reminder.CustomerProfile.Email!,
                            new NotificationMessage { Subject = reminder.ServiceLabel, Body = message });

                        if (emailResult.Success)
                            log.Channel = "WhatsApp+Email";
                        else
                            logger.LogWarning("Email a {Email} no enviado: {Error}", reminder.CustomerProfile.Email, emailResult.Error);
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Error enviando email a {Email}", reminder.CustomerProfile.Email);
                    }
                }
            }

            reminder.Status = ReminderStatus.Sent;
            reminder.SentAt = DateTime.UtcNow;

            // Programar siguiente si es recurrente
            if (reminder.IntervalDays.HasValue)
            {
                var next = new ScheduledReminder
                {
                    TenantId          = reminder.TenantId,
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
