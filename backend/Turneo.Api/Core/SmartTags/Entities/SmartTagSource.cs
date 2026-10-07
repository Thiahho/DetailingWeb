namespace Turneo.Api.Core.SmartTags;

// Canal físico por el que llegó la visita a /s/{token}: el chip NFC lleva
// grabada la URL con ?src=nfc y el QR impreso la lleva con ?src=qr. Constantes
// en vez de enum, mismo criterio que SmartTagAction.
public static class SmartTagSource
{
    public const string Nfc = "nfc";
    public const string Qr = "qr";

    // Largo máximo de la columna (SmartTagEvent.Source / Booking.Source).
    public const int MaxLength = 8;

    // src es input público sin confiar: solo se aceptan los dos valores
    // conocidos (sin distinguir mayúsculas, se guarda en minúscula). Cualquier
    // otra cosa es null — nunca un error, un src raro no debe romper el tap.
    public static string? Normalize(string? raw)
    {
        var value = raw?.Trim().ToLowerInvariant();
        return value is Nfc or Qr ? value : null;
    }

    // URL pública de la etiqueta con el canal ya marcado en el query string.
    public static string AppendTo(string smartLinkUrl, string source) => $"{smartLinkUrl}?src={source}";
}
