using System.Text;
using System.Text.Json;

namespace Turneo.Api.Infrastructure.Integrations;

// Provider de email vía API HTTP (Resend por default) en vez de SMTP crudo —
// Google bloquea/throttlea conexiones SMTP salientes desde IPs de datacenter
// (Render, AWS, Heroku, etc.) como medida antispam, así que GmailProvider
// timeoutea siempre a los 30s desde producción. Un POST HTTPS no tiene ese
// problema. Ver GmailProvider para el provider SMTP (queda sin registrar en
// Program.cs, disponible si algún día se resuelve el bloqueo).
public class EmailProvider : INotificationProvider
{
    private const string DefaultEndpoint = "https://api.resend.com/emails";

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailProvider> _logger;

    public string Channel => "Email";
    public string ProviderName => _configuration["Notifications:Email:Provider"] ?? "Resend";

    public bool IsEnabled =>
        !string.IsNullOrWhiteSpace(_configuration["Notifications:Email:ApiKey"]) &&
        !string.IsNullOrWhiteSpace(_configuration["Notifications:Email:From"]);

    public EmailProvider(HttpClient httpClient, IConfiguration configuration, ILogger<EmailProvider> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(booking.Email))
            return Task.FromResult(new NotificationSendResult { Success = false, Error = "El cliente no tiene email", IsTransientFailure = false });

        return SendToAsync(booking.Email, message, cancellationToken);
    }

    public Task<NotificationSendResult> SendDirectAsync(string phone, string messageBody, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = false, Error = "EmailProvider no soporta envío directo por teléfono.", IsTransientFailure = false });

    public Task<NotificationSendResult> SendToAddressAsync(string toEmail, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(toEmail))
            return Task.FromResult(new NotificationSendResult { Success = false, Error = "Dirección de destino vacía", IsTransientFailure = false });

        return SendToAsync(toEmail, message, cancellationToken);
    }

    private async Task<NotificationSendResult> SendToAsync(string toEmail, NotificationMessage message, CancellationToken cancellationToken)
    {
        if (!IsEnabled)
        {
            _logger.LogWarning("[Email] {Provider} no configurado (ApiKey/From vacíos) — no se envía a {ToEmail}", ProviderName, toEmail);
            return new NotificationSendResult { Success = false, Error = $"{ProviderName} no configurado", IsTransientFailure = false };
        }

        var endpoint = _configuration["Notifications:Email:Endpoint"];
        endpoint = string.IsNullOrWhiteSpace(endpoint) ? DefaultEndpoint : endpoint;
        var from = _configuration["Notifications:Email:From"]!;
        var apiKey = _configuration["Notifications:Email:ApiKey"]!;

        var payload = new
        {
            from,
            to = new[] { toEmail },
            subject = message.Subject,
            html = EmailHtmlBuilder.Build(message),
            text = message.Body
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Authorization", $"Bearer {apiKey}");

        // LogWarning a propósito (no LogInformation): Production tiene Logging:LogLevel:Default
        // en "Warning" (appsettings.Production.json), así que un log Information acá quedaría
        // invisible en los logs de Render.
        _logger.LogWarning("[Email] Enviando '{Subject}' a {ToEmail} vía {Provider} ({Endpoint})", message.Subject, toEmail, ProviderName, endpoint);

        try
        {
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var messageId = TryExtractMessageId(responseBody);
                _logger.LogWarning("[Email] ENVIADO OK a {ToEmail} vía {Provider} (messageId={MessageId})", toEmail, ProviderName, messageId);
                return new NotificationSendResult { Success = true, ProviderMessageId = messageId };
            }

            _logger.LogWarning("[Email] FALLÓ ({Status}) enviando a {ToEmail} vía {Provider}: {Body}", (int)response.StatusCode, toEmail, ProviderName, responseBody);
            return new NotificationSendResult
            {
                Success = false,
                Error = responseBody,
                IsTransientFailure = (int)response.StatusCode >= 500 || (int)response.StatusCode == 429
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Email] FALLÓ (excepción) enviando a {ToEmail} vía {Provider}", toEmail, ProviderName);
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = true };
        }
    }

    private static string? TryExtractMessageId(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() : null;
        }
        catch
        {
            return null;
        }
    }
}
