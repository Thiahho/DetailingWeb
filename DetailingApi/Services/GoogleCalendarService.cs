using Google.Apis.Auth.OAuth2;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using Microsoft.Extensions.Options;
using Google.Apis.Util.Store;
using DetailingApi.Models;

namespace DetailingApi.Services;

public class GoogleCalendarService
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private readonly string _credentialsPath;

    public GoogleCalendarService(IConfiguration configuration, IWebHostEnvironment env)
    {
        _configuration = configuration;
        _env = env;
        _credentialsPath = Path.Combine(env.ContentRootPath, "credentials.json");
    }

    private async Task EnsureCredentialsFileExists()
    {
        // Si el archivo existe, no hacer nada
        if (File.Exists(_credentialsPath))
            return;

        // Intentar crear desde variable de entorno
        var credentialsJson = _configuration["Google:CredentialsJson"];
        if (!string.IsNullOrEmpty(credentialsJson))
        {
            await File.WriteAllTextAsync(_credentialsPath, credentialsJson);
            Console.WriteLine("credentials.json creado desde variable de entorno");
        }
        else
        {
            throw new FileNotFoundException(
                "No se encontró credentials.json. " +
                "Debe existir el archivo o configurar la variable de entorno Google__CredentialsJson");
        }
    }

    private async Task EnsureTokenFileExists()
    {
        var tokenPath = Path.Combine(_env.ContentRootPath, "token.json");
        var tokenFile = Path.Combine(tokenPath, "Google.Apis.Auth.OAuth2.Responses.TokenResponse-user");

        // Si el archivo existe, no hacer nada
        if (File.Exists(tokenFile))
            return;

        // Intentar crear desde variable de entorno
        var tokenJson = _configuration["Google:TokenJson"];
        if (!string.IsNullOrEmpty(tokenJson))
        {
            Directory.CreateDirectory(tokenPath);
            await File.WriteAllTextAsync(tokenFile, tokenJson);
            Console.WriteLine("token.json creado desde variable de entorno");
        }
        else
        {
            Console.WriteLine("Advertencia: No se encontró token.json. Se solicitará autorización.");
        }
    }

    public async Task<string> CrearTurnoAsync(TurnoRequest turno)
    {
        // Asegurar que los archivos existan (desde variables de entorno si es necesario)
        await EnsureCredentialsFileExists();
        await EnsureTokenFileExists();

        UserCredential credential;

        using (var stream = new FileStream(_credentialsPath, FileMode.Open, FileAccess.Read))
        {
            string credPath = "token.json";
            credential = await GoogleWebAuthorizationBroker.AuthorizeAsync(
                GoogleClientSecrets.FromStream(stream).Secrets,
                new[] { CalendarService.Scope.Calendar },
                "user",
                CancellationToken.None,
                new FileDataStore(credPath, true));
        }

        var service = new CalendarService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "Detailing Zona Oeste"
        });

        var evento = new Event
        {
            Summary = $"Detailing - {turno.Vehicle}",
            Description = $"Cliente: {turno.Name}\n" +
                         $"WhatsApp: {turno.WhatsApp}\n" +
                         $"Consulta: {turno.Message}",
            Location = "Moreno, Zona Oeste, Buenos Aires",
            Start = new EventDateTime
{
    DateTimeDateTimeOffset = new DateTimeOffset(turno.DateTime), // ✅ CORRECTO
    TimeZone = "America/Argentina/Buenos_Aires"
},
End = new EventDateTime
{
    DateTimeDateTimeOffset = new DateTimeOffset(turno.DateTime.AddHours(2)), // ✅ CORRECTO
    TimeZone = "America/Argentina/Buenos_Aires"
},
            Reminders = new Event.RemindersData
            {
                UseDefault = false,
                Overrides = new[]
                {
                    new EventReminder { Method = "email", Minutes = 24 * 60 },
                    new EventReminder { Method = "popup", Minutes = 30 }
                }
            }
        };

        var calendarId = _configuration["Google:CalendarId"] ?? "primary";
        var request = service.Events.Insert(evento, calendarId);
        var createdEvent = await request.ExecuteAsync();

        return createdEvent.HtmlLink;
    }
}