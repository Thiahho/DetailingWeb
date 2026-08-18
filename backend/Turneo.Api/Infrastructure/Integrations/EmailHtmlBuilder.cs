namespace Turneo.Api.Infrastructure.Integrations;

// Plantilla HTML compartida entre providers de email (GmailProvider vía SMTP,
// EmailProvider vía API HTTP) — la marca (colores, badge, footer) debe verse
// igual sin importar qué provider esté activo en Program.cs.
public static class EmailHtmlBuilder
{
    // Paleta tomada de frontend/turneo-web/tailwind.config.js (blush/champagne)
    // para que el email se sienta parte del mismo producto que el sitio — con
    // fondo claro en vez del dark theme del sitio, porque un email oscuro
    // depende de que el cliente de correo respete el CSS (Outlook/Gmail móvil
    // suelen no hacerlo) y termina ilegible en varios clientes.
    private const string BgColor = "#F6F1E9";      // ivory cálido (versión clara de "cream")
    private const string CardColor = "#FFFFFF";
    private const string HeaderColor = "#19191C";  // ivory (dark) del sitio
    private const string AccentColor = "#B9853B";  // blush
    private const string TextColor = "#2A2A2E";
    private const string MutedColor = "#6E6E73";   // lavender
    private const string SuccessColor = "#4C7A52";
    private const string CancelColor = "#9C2B2B";  // champagne

    private static (string Label, string Color) BadgeFor(string? eventType) => eventType switch
    {
        NotificationEventType.BookingCreated => ("Reserva recibida", AccentColor),
        NotificationEventType.BookingConfirmed => ("Turno confirmado", SuccessColor),
        NotificationEventType.BookingCancelled => ("Turno cancelado", CancelColor),
        NotificationEventType.BookingReminder24h => ("Recordatorio", AccentColor),
        NotificationEventType.AdminBookingCreated => ("Nueva reserva", AccentColor),
        NotificationEventType.AdminBookingCancelled => ("Cancelación", CancelColor),
        _ => ("Aviso", AccentColor),
    };

    public static string Build(NotificationMessage message)
    {
        var bodyLines = message.Body
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        var bodyHtml = string.Join("", bodyLines.Select(l => $"<p style=\"margin:0 0 12px 0;color:{TextColor};line-height:1.6;font-size:15px\">{l}</p>"));

        var businessName = string.IsNullOrWhiteSpace(message.BusinessName) ? "Turneo" : message.BusinessName;
        var (badgeLabel, badgeColor) = BadgeFor(message.EventType);

        var logoHtml = string.IsNullOrWhiteSpace(message.LogoUrl)
            ? $"""<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">{businessName}</h1>"""
            : $"""<img src="{message.LogoUrl}" alt="{businessName}" height="36" style="height:36px;max-width:220px;object-fit:contain">""";

        var ctaHtml = string.IsNullOrWhiteSpace(message.CtaUrl)
            ? ""
            : $"""
                <div style="margin-top:8px;text-align:center">
                  <a href="{message.CtaUrl}" style="display:inline-block;padding:13px 28px;background:{AccentColor};color:#ffffff;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none">
                    {message.CtaLabel ?? "Ver más"}
                  </a>
                </div>
                """;

        return $"""
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background-color:{BgColor};font-family:'Segoe UI',Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:{CardColor};border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

                      <!-- Header -->
                      <tr>
                        <td style="background:{HeaderColor};padding:28px 32px;text-align:center">
                          {logoHtml}
                          <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.5px">TURNOS ONLINE</p>
                        </td>
                      </tr>

                      <!-- Badge -->
                      <tr>
                        <td style="padding:24px 32px 0">
                          <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:{badgeColor}1A;color:{badgeColor};font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase">{badgeLabel}</span>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:16px 32px 8px">
                          <h2 style="margin:0 0 18px;color:{TextColor};font-size:19px;font-weight:700">{message.Subject}</h2>
                          {bodyHtml}
                          {ctaHtml}
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding:28px 32px 24px;text-align:center;border-top:1px solid #EEE8DC">
                          <p style="margin:0;color:{MutedColor};font-size:12px">Mensaje automático de {businessName}. Por favor no respondas a este correo.</p>
                          <p style="margin:6px 0 0;color:{MutedColor};font-size:11px">Gestionado con Turneo</p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }
}
