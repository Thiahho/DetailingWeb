using Google.Apis.Auth.OAuth2;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using Microsoft.Extensions.Options;
using Google.Apis.Util.Store;
using DetailingApi.Models;
using System.Web;
using System.Globalization;

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
        if (File.Exists(_credentialsPath))
            return;

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

        if (File.Exists(tokenFile))
            return;

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
        await EnsureCredentialsFileExists();
        await EnsureTokenFileExists();

        UserCredential credential;

        using (var stream = new FileStream(_credentialsPath, FileMode.Open, FileAccess.Read))
        {
            // Usar ruta absoluta para que funcione desde cualquier directorio de ejecución
            string credPath = Path.Combine(_env.ContentRootPath, "token.json");
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

        // Limpiar número de teléfono (solo dígitos)
        var phoneClean = new string(turno.WhatsApp.Where(char.IsDigit).ToArray());
        
        // Si no empieza con 54, agregarlo (Argentina)
        if (!phoneClean.StartsWith("54"))
        {
            phoneClean = "54" + phoneClean;
        }

        // Formatear fecha y hora en español
        var cultura = new CultureInfo("es-AR");
        var fechaFormateada = turno.DateTime.ToString("dddd d 'de' MMMM", cultura);
        var horaFormateada = turno.DateTime.ToString("HH:mm", cultura);
        var fechaHoraCompleta = $"{fechaFormateada} a las {horaFormateada} hs";

        // Crear mensaje para WhatsApp con fecha y hora
        var whatsappMessage = $"Hola {turno.Name}! Te contactamos de Detailing Zona Oeste por tu turno del {fechaHoraCompleta}. Vehículo: {turno.Vehicle}. {turno.Message}";
        var whatsappMessageEncoded = HttpUtility.UrlEncode(whatsappMessage);
        
        // Link directo de WhatsApp
        var whatsappLink = $"https://wa.me/{phoneClean}?text={whatsappMessageEncoded}";

        // Descripción del evento con formato claro
        var descripcion = $@"═══════════════════════════
📋 DATOS DEL CLIENTE
═══════════════════════════

👤 Nombre: {turno.Name}
🚗 Vehículo: {turno.Vehicle}
📝 Servicio: {turno.Message}
📅 Turno: {fechaHoraCompleta}

═══════════════════════════
📱 CONTACTAR POR WHATSAPP
═══════════════════════════

Teléfono: {turno.WhatsApp}
Número completo: +{phoneClean}

🔗 Click para enviar mensaje:
{whatsappLink}

═══════════════════════════";

        var evento = new Event
        {
            Summary = $"🚗 {turno.Vehicle} - {turno.Name}",
            Description = descripcion,
            Location = "Moreno, Zona Oeste, Buenos Aires",
            Start = new EventDateTime
            {
                DateTimeDateTimeOffset = new DateTimeOffset(turno.DateTime),
                TimeZone = "America/Argentina/Buenos_Aires"
            },
            End = new EventDateTime
            {
                DateTimeDateTimeOffset = new DateTimeOffset(turno.DateTime.AddHours(2)),
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