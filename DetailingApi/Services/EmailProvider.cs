using System.Text;
using System.Text.Json;
using DetailingApi.Models;

namespace DetailingApi.Services;

public class EmailProvider : INotificationProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public string Channel => "Email";
    public string ProviderName => _configuration["Notifications:Email:Provider"] ?? "GenericEmail";
    public bool IsEnabled => !string.IsNullOrWhiteSpace(_configuration["Notifications:Email:Endpoint"]) &&
                             !string.IsNullOrWhiteSpace(_configuration["Notifications:Email:ApiKey"]);

    public EmailProvider(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            return new NotificationSendResult { Success = false, Error = "Email provider no configurado", IsTransientFailure = false };
        }

        var endpoint = _configuration["Notifications:Email:Endpoint"]!;
        var payload = new
        {
            to = _configuration["Notifications:Email:To"],
            subject = message.Subject,
            text = message.Body,
            customerPhone = booking.CustomerPhone
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        request.Headers.Add("Authorization", $"Bearer {_configuration["Notifications:Email:ApiKey"]}");

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

    public Task<NotificationSendResult> SendDirectAsync(string phone, string messageBody, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = false, Error = "EmailProvider no soporta envío directo por teléfono.", IsTransientFailure = false });

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
