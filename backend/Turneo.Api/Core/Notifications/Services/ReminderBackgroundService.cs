using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Notifications;

public class ReminderBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReminderBackgroundService> _logger;
    private readonly IConfiguration _configuration;

    public ReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ReminderBackgroundService> logger, IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // Leer config fuera del try para poder usar checkIntervalMinutes en el delay
            var windowMinutesStart = _configuration.GetValue<int?>("Notifications:ReminderWindowMinutesStart") ?? (23 * 60);
            var windowMinutesEnd = _configuration.GetValue<int?>("Notifications:ReminderWindowMinutesEnd") ?? (25 * 60);
            var checkIntervalMinutes = _configuration.GetValue<int?>("Notifications:ReminderCheckIntervalMinutes") ?? 60;

            try
            {
                using var scope = _scopeFactory.CreateScope();
                // Cross-tenant a propósito (revisa turnos de todos los tenants) — sin
                // esto, RLS filtraría todas las queries de este job al tenant "vacío"
                // por default de una CurrentTenantService recién creada.
                scope.ServiceProvider.GetRequiredService<ICurrentTenant>().SetBypass();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var notificationService = scope.ServiceProvider.GetRequiredService<NotificationService>();

                // Los slots se guardan en hora de Argentina (igual que TimeSlotsController),
                // independiente de la timezone del servidor donde corra el proceso.
                var now = ArgentinaClock.Now();
                var windowStart = now.AddMinutes(windowMinutesStart);
                var windowEnd = now.AddMinutes(windowMinutesEnd);

                _logger.LogInformation("[Reminder] Ventana: {WindowStart:HH:mm} - {WindowEnd:HH:mm} (ahora: {Now:HH:mm})",
                    windowStart, windowEnd, now);

                // Cross-tenant a propósito: este job revisa turnos de todos los tenants.
                var bookingsToRemind = await context.Bookings
                    .IgnoreQueryFilters()
                    .Include(b => b.TimeSlot)
                    .Where(b => b.Status == BookingStatus.Confirmed)
                    .Where(b => b.TimeSlot.StartDateTime >= windowStart && b.TimeSlot.StartDateTime < windowEnd)
                    .Where(b => !context.NotificationLogs.IgnoreQueryFilters().Any(l =>
                        l.BookingId == b.Id &&
                        l.EventType == NotificationEventType.BookingReminder24h &&
                        (l.Status == NotificationDeliveryStatus.Sent || l.Status == NotificationDeliveryStatus.Pending)))
                    .ToListAsync(stoppingToken);

                _logger.LogInformation("[Reminder] {Count} turno(s) encontrado(s) para notificar", bookingsToRemind.Count);

                foreach (var booking in bookingsToRemind)
                {
                    _logger.LogInformation("[Reminder] Enviando recordatorio para turno {BookingId} ({StartDateTime:HH:mm})",
                        booking.Id, booking.TimeSlot.StartDateTime);
                    await notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingReminder24h, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando recordatorios 24h");
            }

            await Task.Delay(TimeSpan.FromMinutes(checkIntervalMinutes), stoppingToken);
        }
    }
}
