using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Services;

public class ReminderBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReminderBackgroundService> _logger;

    public ReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ReminderBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var notificationService = scope.ServiceProvider.GetRequiredService<NotificationService>();

                // TEST: ventana de 2-4 minutos (cambiar a AddHours(23)/AddHours(25) para producción)
                // Usar DateTime.Now para coincidir con la zona horaria local usada al guardar los slots
                var windowStart = DateTime.Now.AddMinutes(2);
                var windowEnd = DateTime.Now.AddMinutes(4);

                var bookingsToRemind = await context.Bookings
                    .Include(b => b.TimeSlot)
                    .Where(b => b.Status == BookingStatus.Confirmed)
                    .Where(b => b.TimeSlot.StartDateTime >= windowStart && b.TimeSlot.StartDateTime < windowEnd)
                    .Where(b => !context.NotificationLogs.Any(l =>
                        l.BookingId == b.Id &&
                        l.EventType == NotificationEventType.BookingReminder24h &&
                        (l.Status == NotificationDeliveryStatus.Sent || l.Status == NotificationDeliveryStatus.Pending)))
                    .ToListAsync(stoppingToken);

                foreach (var booking in bookingsToRemind)
                {
                    _logger.LogInformation("Enviando recordatorio 24h para turno {BookingId}", booking.Id);
                    await notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingReminder24h, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando recordatorios 24h");
            }

            // TEST: chequear cada 1 minuto (cambiar a FromHours(1) para producción)
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
