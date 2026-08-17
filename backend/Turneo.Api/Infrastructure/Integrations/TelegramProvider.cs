using System.Text;
using System.Text.Json;

namespace Turneo.Api.Infrastructure.Integrations;

public class TelegramProvider : INotificationProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TelegramProvider> _logger;

    public string Channel => "Telegram";
    public string ProviderName => "Telegram";
    public bool IsEnabled => !string.IsNullOrWhiteSpace(_configuration["Notifications:Telegram:BotToken"]);

    public TelegramProvider(HttpClient httpClient, IConfiguration configuration, ILogger<TelegramProvider> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    // Solo se usa para avisar al profesional (SendToAddressAsync con su chat_id) — no
    // hay chat_id de cliente, así que este canal no participa del aviso al cliente.
    public Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = false, Error = "TelegramProvider no soporta envío al cliente.", IsTransientFailure = false });

    public Task<NotificationSendResult> SendDirectAsync(string phone, string messageBody, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = false, Error = "TelegramProvider no soporta envío directo por teléfono.", IsTransientFailure = false });

    // toChatId: el chat_id numérico que el profesional cargó en su cuenta (no un email).
    public async Task<NotificationSendResult> SendToAddressAsync(string toChatId, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
            return new NotificationSendResult { Success = false, Error = "Telegram no configurado (falta BotToken).", IsTransientFailure = false };

        var botToken = _configuration["Notifications:Telegram:BotToken"]!;
        var endpoint = $"https://api.telegram.org/bot{botToken}/sendMessage";
        var text = string.IsNullOrWhiteSpace(message.Subject) ? message.Body : $"{message.Subject}\n\n{message.Body}";

        var payload = new
        {
            chat_id = toChatId,
            text
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        try
        {
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return new NotificationSendResult { Success = true, ProviderMessageId = TryExtractMessageId(body) };
            }

            _logger.LogWarning("[Telegram] Error {Status} al enviar a chat_id {ChatId}: {Body}", (int)response.StatusCode, toChatId, body);
            return new NotificationSendResult
            {
                Success = false,
                Error = TryExtractDescription(body) ?? body,
                // 400 con "chat not found"/"bot was blocked" es permanente (chat_id inválido o
                // el profesional nunca inició conversación con el bot) — no vale la pena reintentar.
                IsTransientFailure = (int)response.StatusCode >= 500 || (int)response.StatusCode == 429
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Telegram] Excepción al enviar a chat_id {ChatId}", toChatId);
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = true };
        }
    }

    private static string? TryExtractMessageId(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("result", out var result) &&
                result.TryGetProperty("message_id", out var id))
                return id.GetRawText();
        }
        catch { /* ignorar */ }
        return null;
    }

    private static string? TryExtractDescription(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("description", out var desc) ? desc.GetString() : null;
        }
        catch
        {
            return null;
        }
    }
}
