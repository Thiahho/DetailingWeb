namespace TTurnos.Api.Infrastructure.Integrations;

// Usado solo en ASPNETCORE_ENVIRONMENT=Testing (ver Program.cs) para que los
// e2e de Playwright no manden WhatsApp/emails reales — reemplaza a
// GmailProvider/WhatsAppProvider, que en este repo ya tienen credenciales
// reales cargadas en appsettings.json.
public class NoopNotificationProvider : INotificationProvider
{
    public string Channel => "Noop";
    public string ProviderName => "Noop";
    public bool IsEnabled => true;

    public Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = true, ProviderMessageId = "noop" });

    public Task<NotificationSendResult> SendDirectAsync(string phone, string messageBody, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = true, ProviderMessageId = "noop" });

    public Task<NotificationSendResult> SendToAddressAsync(string toEmail, NotificationMessage message, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = true, ProviderMessageId = "noop" });
}
