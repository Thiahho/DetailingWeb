using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Notifications;

public class NotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly NotificationTemplateService _templateService;
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationService> _logger;
    private readonly AuthService _authService;
    private readonly IPlanLimitsService _planLimits;

    public NotificationService(
        ApplicationDbContext context,
        NotificationTemplateService templateService,
        IEnumerable<INotificationProvider> providers,
        IConfiguration configuration,
        ILogger<NotificationService> logger,
        AuthService authService,
        IPlanLimitsService planLimits)
    {
        _context = context;
        _templateService = templateService;
        _providers = providers;
        _configuration = configuration;
        _logger = logger;
        _authService = authService;
        _planLimits = planLimits;
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
            .Include(b => b.Professional)
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
            // Tenant explícito (no _currentTenant): este método corre tanto en
            // requests HTTP como en background jobs sin tenant ambiental, ver
            // el IgnoreQueryFilters de arriba.
            if (provider.Channel == "WhatsApp" && !await _planLimits.IsFeatureEnabledAsync(booking.TenantId, "CanUseWhatsapp"))
                continue;

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

        // Aviso aparte al profesional asignado (si tiene cuenta con email cargado) — no
        // debe afectar la creación del turno ni las notificaciones al cliente si falla.
        if (eventType == NotificationEventType.BookingCreated)
        {
            await TryNotifyProfessionalAsync(booking, cancellationToken);
        }
    }

    private async Task TryNotifyProfessionalAsync(Booking booking, CancellationToken cancellationToken)
    {
        if (!booking.ProfessionalId.HasValue) return;
        if (!(_configuration.GetValue<bool?>("Notifications:NotifyProfessional") ?? true)) return;

        try
        {
            var professionalEmail = await _context.Users
                .IgnoreQueryFilters()
                .Where(u => u.Role == "Professional" && u.ProfessionalId == booking.ProfessionalId && u.TenantId == booking.TenantId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync(cancellationToken);

            if (string.IsNullOrWhiteSpace(professionalEmail)) return;

            var emailProvider = _providers.FirstOrDefault(p => p.Channel == "Email");
            if (emailProvider == null) return;

            var agendaBaseUrl = _configuration["Notifications:ProfessionalAgendaBaseUrl"]
                ?? "https://detailing-web-five.vercel.app/profesional/agenda";
            var professionalName = booking.Professional != null
                ? $"{booking.Professional.FirstName} {booking.Professional.LastName}".Trim()
                : "";

            var templateData = new NotificationTemplateData
            {
                CustomerName     = booking.CustomerName,
                Service          = booking.Service ?? "Servicio no informado",
                Subject          = booking.Subject,
                StartDateTime    = booking.TimeSlot.StartDateTime,
                Location         = _configuration["Notifications:Location"] ?? "Sucursal principal",
                CancellationLink = "",
                MyBookingsLink   = "",
                ProfessionalName = professionalName,
                CustomerPhone    = booking.CustomerPhone,
                AgendaLink       = $"{agendaBaseUrl}?bookingId={booking.Id}"
            };

            var message = await _templateService.BuildAsync(NotificationEventType.ProfessionalBookingCreated, templateData, cancellationToken);

            var log = new NotificationLog
            {
                TenantId  = booking.TenantId,
                BookingId = booking.Id,
                EventType = NotificationEventType.ProfessionalBookingCreated,
                Channel   = "Email",
                Provider  = emailProvider.ProviderName,
                Status    = NotificationDeliveryStatus.Pending,
                // No se reintenta con RetryPendingAsync: ese job reconstruye datos
                // orientados al cliente y no sabe nada de profesionales/agenda.
                IsRetryable = false
            };
            _context.NotificationLogs.Add(log);
            await _context.SaveChangesAsync(cancellationToken);

            var result = await emailProvider.SendToAddressAsync(professionalEmail, message, cancellationToken);

            log.LastAttemptAt = DateTime.Now;
            log.RetryCount = 1;

            if (result.Success)
            {
                log.Status = NotificationDeliveryStatus.Sent;
                log.ProviderMessageId = result.ProviderMessageId;
                log.SentAt = DateTime.Now;
                _logger.LogInformation("[Notification] Email a profesional enviado OK para booking {BookingId}", booking.Id);
            }
            else
            {
                log.Status = NotificationDeliveryStatus.Failed;
                log.ErrorMessage = result.Error;
                _logger.LogWarning("[Notification] Email a profesional falló para booking {BookingId}: {Error}", booking.Id, result.Error);
            }

            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Notification] Error notificando al profesional del booking {BookingId}", booking.Id);
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
