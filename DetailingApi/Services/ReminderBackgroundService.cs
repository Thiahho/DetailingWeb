using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Services;

public class ReminderBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReminderBackgroundService> _logger;
    private static readonly TimeZoneInfo _argentinaZone =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    public ReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ReminderBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    private static DateTime NowArgentina() =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _argentinaZone);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var notificationService = scope.ServiceProvider.GetRequiredService<NotificationService>();

                var now = NowArgentina();
                var windowStart = now.AddHours(23);
                var windowEnd = now.AddHours(25);

                _logger.LogInformation("[Reminder] Buscando turnos entre {WindowStart:HH:mm} y {WindowEnd:HH:mm} (ahora: {Now:HH:mm})",
                    windowStart, windowEnd, now);

                var bookingsToRemind = await context.Bookings
                    .Include(b => b.TimeSlot)
                    .Where(b => b.Status == BookingStatus.Confirmed)
                    .Where(b => b.TimeSlot.StartDateTime >= windowStart && b.TimeSlot.StartDateTime < windowEnd)
                    .Where(b => !context.NotificationLogs.Any(l =>
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

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
