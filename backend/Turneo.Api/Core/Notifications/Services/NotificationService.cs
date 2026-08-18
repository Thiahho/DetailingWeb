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

        var baseCancellationUrl = _configuration["Notifications:CancellationBaseUrl"] ?? "https://turneo-barber.vercel.app/cancelar";
        var baseMyBookingsUrl = _configuration["Notifications:MyBookingsBaseUrl"] ?? "https://turneo-barber.vercel.app/mis-turnos";
        var location = _configuration["Notifications:Location"] ?? "Sucursal principal";
        var accessToken = _authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized, booking.TenantId);
        var myBookingsLink = $"{baseMyBookingsUrl}?accessToken={Uri.EscapeDataString(accessToken)}";
        var templateData = new NotificationTemplateData
        {
            CustomerName = booking.CustomerName,
            Service = booking.Service ?? "Servicio no informado",
            Subject = booking.Subject,
            StartDateTime = booking.TimeSlot.StartDateTime,
            Location = location,
            CancellationLink = $"{baseCancellationUrl}?bookingId={booking.Id}",
            MyBookingsLink = myBookingsLink
        };

        var (businessName, logoUrl) = await GetBrandingAsync(booking.TenantId, cancellationToken);
        var message = await _templateService.BuildAsync(eventType, templateData, cancellationToken);
        message.BusinessName = businessName;
        message.LogoUrl = logoUrl;
        message.EventType = eventType;
        message.CtaLabel = "Ver mis turnos";
        message.CtaUrl = myBookingsLink;

        // El botón de cancelar no tiene sentido en el aviso de cancelación en sí
        // (el turno ya está cancelado) — sí en creado/confirmado/recordatorio.
        if (eventType != NotificationEventType.BookingCancelled)
        {
            message.CancelCtaLabel = "Cancelar turno";
            message.CancelCtaUrl = templateData.CancellationLink;
        }

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

        // Avisos aparte (profesional asignado, Admins del tenant) — no deben afectar
        // la creación del turno ni las notificaciones al cliente si fallan.
        if (eventType == NotificationEventType.BookingCreated)
        {
            await TryNotifyProfessionalAsync(booking, businessName, logoUrl, cancellationToken);
            await TryNotifyAdminsAsync(booking, NotificationEventType.AdminBookingCreated, businessName, logoUrl, cancellationToken);
        }
        else if (eventType == NotificationEventType.BookingCancelled)
        {
            await TryNotifyAdminsAsync(booking, NotificationEventType.AdminBookingCancelled, businessName, logoUrl, cancellationToken);
        }
    }

    // "Turneo" a secas si el tenant todavía no cargó su SiteConfig — el mismo
    // fallback que ya usa el resto del sistema para negocios sin configurar.
    private async Task<(string BusinessName, string? LogoUrl)> GetBrandingAsync(int tenantId, CancellationToken cancellationToken)
    {
        var siteConfig = await _context.SiteConfigs
            .IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId)
            .Select(s => new { s.BusinessName, s.LogoUrl })
            .FirstOrDefaultAsync(cancellationToken);

        var businessName = string.IsNullOrWhiteSpace(siteConfig?.BusinessName) ? "Turneo" : siteConfig.BusinessName;
        var logoUrl = string.IsNullOrWhiteSpace(siteConfig?.LogoUrl) ? null : siteConfig.LogoUrl;
        return (businessName, logoUrl);
    }

    private async Task TryNotifyProfessionalAsync(Booking booking, string businessName, string? logoUrl, CancellationToken cancellationToken)
    {
        if (!booking.ProfessionalId.HasValue) return;
        if (!(_configuration.GetValue<bool?>("Notifications:NotifyProfessional") ?? true)) return;

        var account = await _context.Users
            .IgnoreQueryFilters()
            .Where(u => u.Role == "Professional" && u.ProfessionalId == booking.ProfessionalId && u.TenantId == booking.TenantId)
            .Select(u => new { u.TelegramChatId })
            .FirstOrDefaultAsync(cancellationToken);

        if (account == null) return;

        // Solo Telegram para el profesional — no email: el sandbox de Resend rechaza
        // (403) cualquier destinatario que no sea la cuenta dueña del API key hasta
        // verificar un dominio propio, algo que decidimos no hacer por ahora. El
        // cliente sí sigue recibiendo por email (ver DispatchForBookingAsync).
        if (!string.IsNullOrWhiteSpace(account.TelegramChatId))
            await SendProfessionalNotificationAsync(booking, "Telegram", account.TelegramChatId, businessName, logoUrl, cancellationToken);
    }

    // Avisa a todos los Admin del tenant (no solo uno fijo por config) — reemplaza
    // los envíos que antes hacía el frontend Next.js por su cuenta con nodemailer,
    // fuera de este sistema de logs/reintentos.
    private async Task TryNotifyAdminsAsync(Booking booking, string adminEventType, string businessName, string? logoUrl, CancellationToken cancellationToken)
    {
        var admins = await _context.Users
            .IgnoreQueryFilters()
            .Where(u => u.Role == "Admin" && u.TenantId == booking.TenantId)
            .Select(u => new { u.Email, u.TelegramChatId })
            .ToListAsync(cancellationToken);

        foreach (var admin in admins)
        {
            if (!string.IsNullOrWhiteSpace(admin.Email))
                await SendAdminNotificationAsync(booking, adminEventType, "Email", admin.Email, businessName, logoUrl, cancellationToken);

            if (!string.IsNullOrWhiteSpace(admin.TelegramChatId))
                await SendAdminNotificationAsync(booking, adminEventType, "Telegram", admin.TelegramChatId, businessName, logoUrl, cancellationToken);
        }
    }

    private async Task SendAdminNotificationAsync(Booking booking, string adminEventType, string channel, string destination, string businessName, string? logoUrl, CancellationToken cancellationToken)
    {
        try
        {
            var provider = _providers.FirstOrDefault(p => p.Channel == channel);
            if (provider == null) return;

            var templateData = new NotificationTemplateData
            {
                CustomerName     = booking.CustomerName,
                Service          = booking.Service ?? "Servicio no informado",
                Subject          = booking.Subject,
                StartDateTime    = booking.TimeSlot.StartDateTime,
                Location         = _configuration["Notifications:Location"] ?? "Sucursal principal",
                CancellationLink = "",
                MyBookingsLink   = "",
                CustomerPhone    = booking.CustomerPhone
            };

            var message = await _templateService.BuildAsync(adminEventType, templateData, cancellationToken);
            message.BusinessName = businessName;
            message.LogoUrl = logoUrl;
            message.EventType = adminEventType;

            var log = new NotificationLog
            {
                TenantId  = booking.TenantId,
                BookingId = booking.Id,
                EventType = adminEventType,
                Channel   = channel,
                Provider  = provider.ProviderName,
                Status    = NotificationDeliveryStatus.Pending,
                IsRetryable = false
            };
            _context.NotificationLogs.Add(log);
            await _context.SaveChangesAsync(cancellationToken);

            var result = await provider.SendToAddressAsync(destination, message, cancellationToken);

            log.LastAttemptAt = DateTime.Now;
            log.RetryCount = 1;

            if (result.Success)
            {
                log.Status = NotificationDeliveryStatus.Sent;
                log.ProviderMessageId = result.ProviderMessageId;
                log.SentAt = DateTime.Now;
                _logger.LogInformation("[Notification] {Channel} a admin enviado OK para booking {BookingId}", channel, booking.Id);
            }
            else
            {
                log.Status = NotificationDeliveryStatus.Failed;
                log.ErrorMessage = result.Error;
                _logger.LogWarning("[Notification] {Channel} a admin falló para booking {BookingId}: {Error}", channel, booking.Id, result.Error);
            }

            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Notification] Error notificando a admin ({Channel}) del booking {BookingId}", channel, booking.Id);
        }
    }

    private async Task SendProfessionalNotificationAsync(Booking booking, string channel, string destination, string businessName, string? logoUrl, CancellationToken cancellationToken)
    {
        try
        {
            var provider = _providers.FirstOrDefault(p => p.Channel == channel);
            if (provider == null) return;

            var agendaBaseUrl = _configuration["Notifications:ProfessionalAgendaBaseUrl"]
                ?? "https://turneo-barber.vercel.app/profesional/agenda";
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
            message.BusinessName = businessName;
            message.LogoUrl = logoUrl;
            message.EventType = NotificationEventType.ProfessionalBookingCreated;

            var log = new NotificationLog
            {
                TenantId  = booking.TenantId,
                BookingId = booking.Id,
                EventType = NotificationEventType.ProfessionalBookingCreated,
                Channel   = channel,
                Provider  = provider.ProviderName,
                Status    = NotificationDeliveryStatus.Pending,
                // No se reintenta con RetryPendingAsync: ese job reconstruye datos
                // orientados al cliente y no sabe nada de profesionales/agenda.
                IsRetryable = false
            };
            _context.NotificationLogs.Add(log);
            await _context.SaveChangesAsync(cancellationToken);

            var result = await provider.SendToAddressAsync(destination, message, cancellationToken);

            log.LastAttemptAt = DateTime.Now;
            log.RetryCount = 1;

            if (result.Success)
            {
                log.Status = NotificationDeliveryStatus.Sent;
                log.ProviderMessageId = result.ProviderMessageId;
                log.SentAt = DateTime.Now;
                _logger.LogInformation("[Notification] {Channel} a profesional enviado OK para booking {BookingId}", channel, booking.Id);
            }
            else
            {
                log.Status = NotificationDeliveryStatus.Failed;
                log.ErrorMessage = result.Error;
                _logger.LogWarning("[Notification] {Channel} a profesional falló para booking {BookingId}: {Error}", channel, booking.Id, result.Error);
            }

            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Notification] Error notificando al profesional ({Channel}) del booking {BookingId}", channel, booking.Id);
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

            var myBookingsLink = $"{_configuration["Notifications:MyBookingsBaseUrl"] ?? "https://turneo-barber.vercel.app/mis-turnos"}?accessToken={Uri.EscapeDataString(_authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized, booking.TenantId))}";
            var cancellationLink = $"{_configuration["Notifications:CancellationBaseUrl"] ?? "https://turneo-barber.vercel.app/cancelar"}?bookingId={booking.Id}";
            var message = await _templateService.BuildAsync(log.EventType, new NotificationTemplateData
            {
                CustomerName = booking.CustomerName,
                Service = booking.Service ?? "Servicio no informado",
                Subject = booking.Subject,
                StartDateTime = booking.TimeSlot.StartDateTime,
                Location = _configuration["Notifications:Location"] ?? "Sucursal principal",
                CancellationLink = cancellationLink,
                MyBookingsLink = myBookingsLink
            });

            var (businessName, logoUrl) = await GetBrandingAsync(booking.TenantId, cancellationToken);
            message.BusinessName = businessName;
            message.LogoUrl = logoUrl;
            message.EventType = log.EventType;
            message.CtaLabel = "Ver mis turnos";
            message.CtaUrl = myBookingsLink;

            if (log.EventType != NotificationEventType.BookingCancelled)
            {
                message.CancelCtaLabel = "Cancelar turno";
                message.CancelCtaUrl = cancellationLink;
            }

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
