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

    private readonly IConfiguration _configuration;

    public ReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ReminderBackgroundService> logger, IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _configuration = configuration;
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

                var windowMinutesStart = _configuration.GetValue<int?>("Notifications:ReminderWindowMinutesStart") ?? (23 * 60);
                var windowMinutesEnd = _configuration.GetValue<int?>("Notifications:ReminderWindowMinutesEnd") ?? (25 * 60);
                var checkIntervalMinutes = _configuration.GetValue<int?>("Notifications:ReminderCheckIntervalMinutes") ?? 60;

                var nowUtc = DateTime.UtcNow;
                var windowStart = nowUtc.AddMinutes(windowMinutesStart);
                var windowEnd = nowUtc.AddMinutes(windowMinutesEnd);
                var nowArg = NowArgentina();

                _logger.LogInformation("[Reminder] Ventana: +{Start}min a +{End}min UTC | Ahora Argentina: {Now:HH:mm}",
                    windowMinutesStart, windowMinutesEnd, nowArg);

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

            await Task.Delay(TimeSpan.FromMinutes(checkIntervalMinutes), stoppingToken);
        }
    }
}
