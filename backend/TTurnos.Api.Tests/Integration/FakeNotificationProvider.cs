namespace TTurnos.Api.Tests.Integration;

// Reemplaza a GmailProvider/WhatsAppProvider en los tests: nunca debe pegarle
// a servicios externos reales (SMTP, Meta API) ni depender de credenciales.
public class FakeNotificationProvider : INotificationProvider
{
    public string Channel => "Fake";
    public string ProviderName => "Fake";
    public bool IsEnabled => true;

    public Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default)
        => Task.FromResult(new NotificationSendResult { Success = true, ProviderMessageId = "fake-message-id" });

    public Task<NotificationSendResult> SendDirectAsync(string phone, string messageBody, CancellationToken cancellationToken = default)
        => Task.FromResult(new NotificationSendResult { Success = true, ProviderMessageId = "fake-message-id" });

    public Task<NotificationSendResult> SendToAddressAsync(string toEmail, NotificationMessage message, CancellationToken cancellationToken = default)
        => Task.FromResult(new NotificationSendResult { Success = true, ProviderMessageId = "fake-message-id" });
}
