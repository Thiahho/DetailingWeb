using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Notifications;

public class NotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly NotificationTemplateService _templateService;
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationService> _logger;
    private readonly AuthService _authService;

    public NotificationService(
        ApplicationDbContext context,
        NotificationTemplateService templateService,
        IEnumerable<INotificationProvider> providers,
        IConfiguration configuration,
        ILogger<NotificationService> logger,
        AuthService authService)
    {
        _context = context;
        _templateService = templateService;
        _providers = providers;
        _configuration = configuration;
        _logger = logger;
        _authService = authService;
    }

    public async Task DispatchForBookingAsync(int bookingId, string eventType, CancellationToken cancellationToken = default)
    {
        // IgnoreQueryFilters: esto lo dispara tanto una request HTTP (tenant ya
        // resuelto) como un background job (sin tenant ambiental) — el bookingId
        // ya identifica un único tenant sin ambigüedad, así que ignorar el filtro
        // acá es seguro.
        var booking = await _context.Bookings
            .IgnoreQueryFilters()
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);

        if (booking == null)
        {
            return;
        }

        var baseCancellationUrl = _configuration["Notifications:CancellationBaseUrl"] ?? "https://detailing-web-five.vercel.app/cancelar";
        var baseMyBookingsUrl = _configuration["Notifications:MyBookingsBaseUrl"] ?? "https://detailing-web-five.vercel.app/mis-turnos";
        var location = _configuration["Notifications:Location"] ?? "Sucursal principal";
        var accessToken = _authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized, booking.TenantId);
        var templateData = new NotificationTemplateData
        {
            CustomerName = booking.CustomerName,
            Service = booking.Service ?? "Servicio no informado",
            Subject = booking.Subject,
            StartDateTime = booking.TimeSlot.StartDateTime,
            Location = location,
            CancellationLink = $"{baseCancellationUrl}?bookingId={booking.Id}",
            MyBookingsLink = $"{baseMyBookingsUrl}?accessToken={Uri.EscapeDataString(accessToken)}"
        };

        var message = await _templateService.BuildAsync(eventType, templateData, cancellationToken);

        foreach (var provider in _providers)
        {
            var log = new NotificationLog
            {
                TenantId = booking.TenantId,
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

        // Cross-tenant a propósito: este job procesa reintentos de todos los tenants.
        var logs = await _context.NotificationLogs
            .IgnoreQueryFilters()
            .Where(l => l.Status == NotificationDeliveryStatus.Failed && l.IsRetryable && l.RetryCount < maxRetries)
            .Where(l => l.NextRetryAt == null || l.NextRetryAt <= DateTime.Now)
            .ToListAsync(cancellationToken);

        foreach (var log in logs)
        {
            var booking = await _context.Bookings
                .IgnoreQueryFilters()
                .Include(b => b.TimeSlot)
                .FirstOrDefaultAsync(b => b.Id == log.BookingId, cancellationToken);

            if (booking == null)
            {
                continue;
            }

            var message = await _templateService.BuildAsync(log.EventType, new NotificationTemplateData
            {
                CustomerName = booking.CustomerName,
                Service = booking.Service ?? "Servicio no informado",
                Subject = booking.Subject,
                StartDateTime = booking.TimeSlot.StartDateTime,
                Location = _configuration["Notifications:Location"] ?? "Sucursal principal",
                CancellationLink = $"{_configuration["Notifications:CancellationBaseUrl"] ?? "https://detailing-web-five.vercel.app/cancelar"}?bookingId={booking.Id}",
                MyBookingsLink = $"{_configuration["Notifications:MyBookingsBaseUrl"] ?? "https://detailing-web-five.vercel.app/mis-turnos"}?accessToken={Uri.EscapeDataString(_authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized, booking.TenantId))}"
            });

            await TrySendAsync(log.Id, booking, message, cancellationToken);
        }
    }

    private async Task TrySendAsync(int logId, Booking booking, NotificationMessage message, CancellationToken cancellationToken)
    {
        var log = await _context.NotificationLogs.IgnoreQueryFilters().FirstAsync(x => x.Id == logId, cancellationToken);
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
            _logger.LogInformation("[Notification] {Channel} enviado OK para booking {BookingId} ({EventType})",
                log.Channel, log.BookingId, log.EventType);
        }
        else
        {
            var backoffMinutes = Math.Pow(2, Math.Max(0, log.RetryCount - 1));
            log.Status = NotificationDeliveryStatus.Failed;
            log.ErrorMessage = result.Error;
            log.IsRetryable = result.IsTransientFailure;
            log.NextRetryAt = result.IsTransientFailure ? DateTime.Now.AddMinutes(backoffMinutes) : null;
            _logger.LogWarning("[Notification] {Channel} falló para booking {BookingId} ({EventType}): {Error}",
                log.Channel, log.BookingId, log.EventType, result.Error);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
