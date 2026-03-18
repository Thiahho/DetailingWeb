using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Services;

public class NotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly NotificationTemplateService _templateService;
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly IConfiguration _configuration;

    public NotificationService(
        ApplicationDbContext context,
        NotificationTemplateService templateService,
        IEnumerable<INotificationProvider> providers,
        IConfiguration configuration)
    {
        _context = context;
        _templateService = templateService;
        _providers = providers;
        _configuration = configuration;
    }

    public async Task DispatchForBookingAsync(int bookingId, string eventType, CancellationToken cancellationToken = default)
    {
        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);

        if (booking == null)
        {
            return;
        }

        var baseCancellationUrl = _configuration["Notifications:CancellationBaseUrl"] ?? "https://detailing-web-five.vercel.app/cancelar";
        var location = _configuration["Notifications:Location"] ?? "Sucursal principal";
        var templateData = new NotificationTemplateData
        {
            CustomerName = booking.CustomerName,
            Service = booking.Service ?? "Servicio no informado",
            StartDateTime = booking.TimeSlot.StartDateTime,
            Location = location,
            CancellationLink = $"{baseCancellationUrl}?bookingId={booking.Id}"
        };

        var message = _templateService.Build(eventType, templateData);

        foreach (var provider in _providers)
        {
            var log = new NotificationLog
            {
                BookingId = booking.Id,
                EventType = eventType,
                Channel = provider.Channel,
                Provider = provider.ProviderName,
                Status = NotificationDeliveryStatus.Pending,
                NextRetryAt = DateTime.Now
            };

            _context.NotificationLogs.Add(log);
            await _context.SaveChangesAsync(cancellationToken);
            await TrySendAsync(log.Id, booking, message, cancellationToken);
        }
    }

    public async Task RetryPendingAsync(CancellationToken cancellationToken = default)
    {
        var maxRetries = Math.Max(1, _configuration.GetValue<int?>("Notifications:Retry:MaxAttempts") ?? 3);

        var logs = await _context.NotificationLogs
            .Where(l => l.Status == NotificationDeliveryStatus.Failed && l.IsRetryable && l.RetryCount < maxRetries)
            .Where(l => l.NextRetryAt == null || l.NextRetryAt <= DateTime.Now)
            .ToListAsync(cancellationToken);

        foreach (var log in logs)
        {
            var booking = await _context.Bookings
                .Include(b => b.TimeSlot)
                .FirstOrDefaultAsync(b => b.Id == log.BookingId, cancellationToken);

            if (booking == null)
            {
                continue;
            }

            var message = _templateService.Build(log.EventType, new NotificationTemplateData
            {
                CustomerName = booking.CustomerName,
                Service = booking.Service ?? "Servicio no informado",
                StartDateTime = booking.TimeSlot.StartDateTime,
                Location = _configuration["Notifications:Location"] ?? "Sucursal principal",
                CancellationLink = $"{_configuration["Notifications:CancellationBaseUrl"] ?? "https://detailing-web-five.vercel.app/cancelar"}?bookingId={booking.Id}"
            });

            await TrySendAsync(log.Id, booking, message, cancellationToken);
        }
    }

    private async Task TrySendAsync(int logId, Booking booking, NotificationMessage message, CancellationToken cancellationToken)
    {
        var log = await _context.NotificationLogs.FirstAsync(x => x.Id == logId, cancellationToken);
        var provider = _providers.First(p => p.Channel == log.Channel);

        log.LastAttemptAt = DateTime.Now;
        log.RetryCount += 1;

        var result = await provider.SendAsync(booking, message, cancellationToken);

        if (result.Success)
        {
            log.Status = NotificationDeliveryStatus.Sent;
            log.ProviderMessageId = result.ProviderMessageId;
            log.ErrorMessage = null;
            log.SentAt = DateTime.Now;
            log.NextRetryAt = null;
        }
        else
        {
            var backoffMinutes = Math.Pow(2, Math.Max(0, log.RetryCount - 1));
            log.Status = NotificationDeliveryStatus.Failed;
            log.ErrorMessage = result.Error;
            log.IsRetryable = result.IsTransientFailure;
            log.NextRetryAt = result.IsTransientFailure ? DateTime.Now.AddMinutes(backoffMinutes) : null;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
