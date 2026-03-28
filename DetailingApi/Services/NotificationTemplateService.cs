using System.Text;
using System.Text.Json;
using DetailingApi.Models;

namespace DetailingApi.Services;

public class NotificationTemplateService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<NotificationTemplateService> _logger;

    public NotificationTemplateService(IConfiguration configuration, HttpClient httpClient, ILogger<NotificationTemplateService> logger)
    {
        _configuration = configuration;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<NotificationMessage> BuildAsync(string eventType, NotificationTemplateData data, CancellationToken cancellationToken = default)
    {
        var subject = BuildSubject(eventType, data);
        string body;

        if (eventType == NotificationEventType.BookingReminder24h && IsOpenAiEnabled())
        {
            body = await GenerateReminderBodyAsync(data, cancellationToken) ?? BuildBody(eventType, data);
        }
        else
        {
            body = BuildBody(eventType, data);
        }

        return new NotificationMessage { Subject = subject, Body = body };
    }

    public NotificationMessage Build(string eventType, NotificationTemplateData data)
    {
        return new NotificationMessage
        {
            Subject = BuildSubject(eventType, data),
            Body = BuildBody(eventType, data)
        };
    }

    private bool IsOpenAiEnabled()
    {
        var apiKey = _configuration["OpenAI:ApiKey"];
        var enabled = _configuration.GetValue<bool?>("OpenAI:Enabled") ?? true;
        return enabled && !string.IsNullOrWhiteSpace(apiKey);
    }

    private async Task<string?> GenerateReminderBodyAsync(NotificationTemplateData data, CancellationToken cancellationToken)
    {
        var apiKey = _configuration["OpenAI:ApiKey"]!;
        var model = _configuration["OpenAI:Model"] ?? "gpt-4o-mini";
        var fechaHora = data.StartDateTime.ToString("dddd d 'de' MMMM 'a las' HH:mm", new System.Globalization.CultureInfo("es-AR"));

       var prompt = $"""
            Generá un mensaje de recordatorio de turno.

            DATOS:
            Nombre: {data.CustomerName}
            Servicio: {data.Service}
            Fecha y hora: {fechaHora}
            Lugar: {data.Location}
            Link: {data.MyBookingsLink}

            REGLAS OBLIGATORIAS:
            - Responder SOLO con el mensaje final, sin explicaciones ni texto adicional
            - Español rioplatense (Argentina)
            - Tono cordial y profesional
            - Máximo 3 oraciones
            - Iniciar con el nombre del cliente
            - Incluir servicio, fecha, hora y lugar
            - Finalizar con el link para gestionar el turno
            - No usar emojis
            - No usar markdown
            - No agregar información que no esté en los datos
            - No hacer suposiciones
            - No agregar disculpas ni frases innecesarias

            FORMATO ESPERADO:
            Un único párrafo de texto plano
            """;

        var requestBody = new
        {
            model,
            messages = new[] { new { role = "user", content = prompt } },
            max_tokens = 250,
            temperature = 0.7
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
            };
            request.Headers.Add("Authorization", $"Bearer {apiKey}");

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(15));

            var response = await _httpClient.SendAsync(request, cts.Token);
            var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[OpenAI] Error generando mensaje: {Status} - {Body}", response.StatusCode, responseBody);
                return null;
            }

            using var doc = JsonDocument.Parse(responseBody);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            _logger.LogInformation("[OpenAI] Mensaje generado para {CustomerName} ({Service})", data.CustomerName, data.Service);
            return content?.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[OpenAI] Falló la generación del mensaje, usando template estático");
            return null;
        }
    }

    private string BuildSubject(string eventType, NotificationTemplateData data)
    {
        var template = _configuration[$"Notifications:Templates:{eventType}:Subject"]
            ?? "Reserva {{servicio}} - {{fecha_hora}}";
        return ReplaceTokens(template, data);
    }

    private string BuildBody(string eventType, NotificationTemplateData data)
    {
        var template = _configuration[$"Notifications:Templates:{eventType}:Body"]
            ?? "Hola {{nombre}}, tu reserva para {{servicio}} quedó registrada para {{fecha_hora}} en {{ubicacion}}. Gestioná tu turno aquí: {{link_mis_turnos}}";
        return ReplaceTokens(template, data);
    }

    private static string ReplaceTokens(string template, NotificationTemplateData data)
    {
        return template
            .Replace("{{nombre}}", data.CustomerName)
            .Replace("{{servicio}}", data.Service)
            .Replace("{{fecha_hora}}", data.StartDateTime.ToString("dd/MM/yyyy HH:mm"))
            .Replace("{{ubicacion}}", data.Location)
            .Replace("{{link_cancelacion}}", data.CancellationLink)
            .Replace("{{link_mis_turnos}}", data.MyBookingsLink);
    }
}
