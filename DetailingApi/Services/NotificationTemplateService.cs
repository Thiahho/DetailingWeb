namespace DetailingApi.Services;

public class NotificationTemplateService
{
    private readonly IConfiguration _configuration;

    public NotificationTemplateService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public NotificationMessage Build(string eventType, NotificationTemplateData data)
    {
        var localDateTime = data.StartDateTime;

        var subjectTemplate = _configuration[$"Notifications:Templates:{eventType}:Subject"]
            ?? "Reserva {{servicio}} - {{fecha_hora}}";
        var bodyTemplate = _configuration[$"Notifications:Templates:{eventType}:Body"]
            ?? "Hola {{nombre}}, tu reserva para {{servicio}} quedó registrada para {{fecha_hora}} en {{ubicacion}}. Si necesitás cancelar, ingresá aquí: {{link_cancelacion}}";

        return new NotificationMessage
        {
            Subject = ReplaceTokens(subjectTemplate, data, localDateTime),
            Body = ReplaceTokens(bodyTemplate, data, localDateTime)
        };
    }

    private static string ReplaceTokens(string template, NotificationTemplateData data, DateTime localDateTime)
    {
        return template
            .Replace("{{nombre}}", data.CustomerName)
            .Replace("{{servicio}}", data.Service)
            .Replace("{{fecha_hora}}", localDateTime.ToString("dd/MM/yyyy HH:mm"))
            .Replace("{{ubicacion}}", data.Location)
            .Replace("{{link_cancelacion}}", data.CancellationLink)
            .Replace("{{personalizacion}}", string.IsNullOrWhiteSpace(data.CustomizationSummary) ? "Sin personalización" : data.CustomizationSummary);
    }
}
