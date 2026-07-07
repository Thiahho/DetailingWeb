using System.Text;
using System.Text.Json;

namespace TTurnos.Api.Infrastructure.Integrations;

public class WhatsAppProvider : INotificationProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WhatsAppProvider> _logger;

    public string Channel => "WhatsApp";
    public string ProviderName => _configuration["Notifications:WhatsApp:Provider"] ?? "Meta";
    public bool IsEnabled =>
        !string.IsNullOrWhiteSpace(_configuration["Notifications:WhatsApp:Endpoint"]) &&
        !string.IsNullOrWhiteSpace(_configuration["Notifications:WhatsApp:ApiKey"]);

    public WhatsAppProvider(HttpClient httpClient, IConfiguration configuration, ILogger<WhatsAppProvider> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public Task<NotificationSendResult> SendAsync(
        Booking booking,
        NotificationMessage message,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
            return Task.FromResult(new NotificationSendResult
            {
                Success = false,
                Error = "WhatsApp no configurado (Endpoint o ApiKey vacíos).",
                IsTransientFailure = false
            });

        return SendToPhoneAsync(NormalizePhone(booking.CustomerPhone), message.Body, cancellationToken);
    }

    public Task<NotificationSendResult> SendDirectAsync(
        string phone,
        string messageBody,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
            return Task.FromResult(new NotificationSendResult
            {
                Success = false,
                Error = "WhatsApp no configurado (Endpoint o ApiKey vacíos).",
                IsTransientFailure = false
            });

        return SendToPhoneAsync(NormalizePhone(phone), messageBody, cancellationToken);
    }

    // ── Core send ──────────────────────────────────────────────────────────────

    private async Task<NotificationSendResult> SendToPhoneAsync(
        string phone,
        string messageBody,
        CancellationToken cancellationToken)
    {
        var endpoint  = _configuration["Notifications:WhatsApp:Endpoint"]!;
        var apiKey    = _configuration["Notifications:WhatsApp:ApiKey"]!;
        var template  = _configuration["Notifications:WhatsApp:TemplateName"];

        // Si hay template configurado → template message (producción)
        // Si no → texto libre (desarrollo/sandbox)
        var payload = string.IsNullOrWhiteSpace(template)
            ? BuildTextPayload(phone, messageBody)
            : BuildTemplatePayload(phone, template, messageBody);

        var json = JsonSerializer.Serialize(payload);
        _logger.LogDebug("[WhatsApp] → {Phone} | payload: {Payload}", phone, json);

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        var body     = await response.Content.ReadAsStringAsync(cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            _logger.LogInformation("[WhatsApp] Enviado a {Phone}. MessageId: {Id}", phone, TryExtractMessageId(body));
            return new NotificationSendResult
            {
                Success           = true,
                ProviderMessageId = TryExtractMessageId(body)
            };
        }

        _logger.LogWarning("[WhatsApp] Error {Status} al enviar a {Phone}: {Body}", (int)response.StatusCode, phone, body);
        return new NotificationSendResult
        {
            Success           = false,
            Error             = body,
            IsTransientFailure = (int)response.StatusCode >= 500 || (int)response.StatusCode == 429
        };
    }

    // ── Payload builders ───────────────────────────────────────────────────────

    private static object BuildTextPayload(string phone, string body) => new
    {
        messaging_product = "whatsapp",
        to                = phone,
        type              = "text",
        text              = new { body }
    };

    private object BuildTemplatePayload(string phone, string templateName, string body)
    {
        var language = _configuration["Notifications:WhatsApp:TemplateLanguage"] ?? "es_AR";

        return new
        {
            messaging_product = "whatsapp",
            to                = phone,
            type              = "template",
            template          = new
            {
                name     = templateName,
                language = new { code = language },
                components = new[]
                {
                    new
                    {
                        type       = "body",
                        parameters = new[]
                        {
                            new { type = "text", text = body }
                        }
                    }
                }
            }
        };
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Normaliza el teléfono a formato E.164 sin el signo +.
    /// Ej: "+54 9 11 1234-5678" → "5491112345678"
    /// </summary>
    private static string NormalizePhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        // Argentina: strip mobile 9 (549XXXXXXXXXX → 54XXXXXXXXXX)
        // to match format +54 11 XXXX-XXXX registered in Meta
        if (digits.StartsWith("549") && digits.Length == 13)
            digits = "54" + digits[3..];
        return digits;
    }

    private static string? TryExtractMessageId(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            // Meta devuelve: { "messages": [{ "id": "wamid.xxx" }] }
            if (doc.RootElement.TryGetProperty("messages", out var msgs) &&
                msgs.GetArrayLength() > 0 &&
                msgs[0].TryGetProperty("id", out var id))
                return id.GetString();

            // Fallback para otros formatos
            if (doc.RootElement.TryGetProperty("id", out var flatId))
                return flatId.GetString();
        }
        catch { /* ignorar */ }
        return null;
    }
}
