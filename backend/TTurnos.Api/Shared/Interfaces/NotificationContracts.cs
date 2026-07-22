
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
}

public class NotificationMessage
{
    public required string Subject { get; init; }
    public required string Body { get; init; }
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
