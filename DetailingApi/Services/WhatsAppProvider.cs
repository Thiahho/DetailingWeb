using System.Text;
using System.Text.Json;
using DetailingApi.Models;

namespace DetailingApi.Services;

public class WhatsAppProvider : INotificationProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public string Channel => "WhatsApp";
    public string ProviderName => _configuration["Notifications:WhatsApp:Provider"] ?? "GenericWhatsApp";
    public bool IsEnabled => !string.IsNullOrWhiteSpace(_configuration["Notifications:WhatsApp:Endpoint"]) &&
                             !string.IsNullOrWhiteSpace(_configuration["Notifications:WhatsApp:ApiKey"]);

    public WhatsAppProvider(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            return new NotificationSendResult { Success = false, Error = "WhatsApp provider no configurado", IsTransientFailure = false };
        }

        var endpoint = _configuration["Notifications:WhatsApp:Endpoint"]!;
        var payload = new
        {
            to = booking.CustomerPhone,
            message = message.Body
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        request.Headers.Add("Authorization", $"Bearer {_configuration["Notifications:WhatsApp:ApiKey"]}");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            return new NotificationSendResult
            {
                Success = true,
                ProviderMessageId = TryExtractMessageId(responseBody)
            };
        }

        return new NotificationSendResult
        {
            Success = false,
            Error = responseBody,
            IsTransientFailure = (int)response.StatusCode >= 500 || (int)response.StatusCode == 429
        };
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
