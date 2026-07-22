namespace Turneo.Api.Shared.Utilities;

// Los turnos/slots se guardan en hora de Argentina (ver comentarios en
// TimeSlotsController y ReminderBackgroundService), independiente de la
// timezone del servidor donde corra el proceso. Cualquier lógica que necesite
// "qué día es hoy" en términos de negocio (cumpleaños, días de inactividad)
// debe pasar por acá en vez de comparar contra DateTime.UtcNow directamente.
public static class ArgentinaClock
{
    private static readonly TimeZoneInfo _zone =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    public static DateTime Now() =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _zone);
}
