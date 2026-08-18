
namespace Turneo.Api.Shared.Interfaces;

public class NotificationTemplateData
{
    public required string CustomerName { get; init; }
    public required string Service { get; init; }
    public required string Subject { get; init; }
    public required DateTime StartDateTime { get; init; }
    public required string Location { get; init; }
    public required string CancellationLink { get; init; }
    public required string MyBookingsLink { get; init; }

    // Solo se completan para el aviso al profesional (ProfessionalBookingCreated).
    public string? ProfessionalName { get; init; }
    public string? CustomerPhone { get; init; }
    public string? AgendaLink { get; init; }

    // Solo para ProfessionalBookingRescheduled — el horario que tenía el turno
    // antes de la reprogramación (booking.TimeSlot ya apunta al nuevo para cuando
    // este dato se arma, así que hay que capturarlo en el controller antes de
    // pisar el TimeSlotId y pasarlo explícito por todo el pipeline).
    public DateTime? PreviousStartDateTime { get; init; }
}

public class NotificationMessage
{
    public required string Subject { get; init; }
    public required string Body { get; init; }

    // Completados por NotificationService antes de pasarle el mensaje a los
    // providers — GmailProvider los usa para armar el HTML; WhatsApp/Telegram
    // los ignoran (solo mandan texto plano).
    public string? BusinessName { get; set; }
    public string? LogoUrl { get; set; }
    public string? EventType { get; set; }
    public string? CtaLabel { get; set; }
    public string? CtaUrl { get; set; }

    // Botón secundario (outline) — solo se completa para estados donde el turno
    // todavía se puede cancelar (creado/confirmado/recordatorio), nunca para el
    // aviso de cancelación en sí ni para los avisos a admin/profesional.
    public string? CancelCtaLabel { get; set; }
    public string? CancelCtaUrl { get; set; }
}

public class NotificationSendResult
{
    public bool Success { get; init; }
    public string? ProviderMessageId { get; init; }
    public string? Error { get; init; }
    public bool IsTransientFailure { get; init; }
}

public interface INotificationProvider
{
    string Channel { get; }
    string ProviderName { get; }
    bool IsEnabled { get; }
    Task<NotificationSendResult>SendAsync(
        Booking booking,
        NotificationMessage message,
        CancellationToken cancellationToken = default);


    Task<NotificationSendResult> SendDirectAsync(string phone, string messageBody, CancellationToken cancellationToken = default);

    // Envío a una dirección de email arbitraria (no la del cliente del booking) — usado
    // para avisarle al profesional asignado. Providers que no sean de email devuelven
    // Success = false con un error descriptivo, igual que SendDirectAsync con teléfono.
    Task<NotificationSendResult> SendToAddressAsync(string toEmail, NotificationMessage message, CancellationToken cancellationToken = default);
}
