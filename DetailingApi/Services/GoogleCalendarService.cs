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
    private readonly string _credentialsPath;

    public GoogleCalendarService(IConfiguration configuration, IWebHostEnvironment env)
    {
        _configuration = configuration;
        _credentialsPath = Path.Combine(env.ContentRootPath, "credentials.json");
    }

    public async Task<string> CrearTurnoAsync(TurnoRequest turno)
    {
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