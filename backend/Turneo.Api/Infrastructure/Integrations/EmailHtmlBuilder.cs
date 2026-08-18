namespace Turneo.Api.Infrastructure.Integrations;

// Plantilla HTML compartida entre providers de email (EmailProvider vía API HTTP,
// GmailProvider vía SMTP si algún día se reactiva) — la identidad visual (ticket
// de barbería: banda de cuero, badge estampado, perforación) debe verse igual sin
// importar qué provider esté activo en Program.cs.
//
// Diseño aprobado en sesión: ver artefacto "Barbería Ticket Emails". Paleta y
// tipografía intencionalmente distintas del genérico "salón" (cream/serif/terracota):
// bronce/cuero + slab serif + display condensada, tomado de tailwind.config.js.
public static class EmailHtmlBuilder
{
    private const string Paper = "#EFE4C9";       // canvas exterior del mail
    private const string Card = "#FBF5E7";        // tarjeta principal (ticket)
    private const string HeaderBg = "#1B1611";    // banda de cuero (header y footer)
    private const string Bronze = "#B9853B";
    private const string BronzeDeep = "#8F6427";
    private const string Wine = "#8C2F2F";
    private const string TextInk = "#241C13";
    private const string Muted = "#8A7A5C";
    private const string GoldText = "#F1E4C8";    // texto sobre el header oscuro

    private const string FontLink = """<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Zilla+Slab:wght@400;600;700&display=swap" rel="stylesheet">""";
    private const string DisplayFont = "'Bebas Neue','Arial Narrow',Arial,sans-serif";
    private const string SlabFont = "'Zilla Slab',Georgia,'Times New Roman',serif";

    private static (string Label, string Color) BadgeFor(string? eventType) => eventType switch
    {
        NotificationEventType.BookingCreated => ("RESERVA RECIBIDA", Bronze),
        NotificationEventType.BookingConfirmed => ("TURNO CONFIRMADO", BronzeDeep),
        NotificationEventType.BookingCancelled => ("TURNO CANCELADO", Wine),
        NotificationEventType.BookingRescheduled => ("TURNO REPROGRAMADO", BronzeDeep),
        NotificationEventType.BookingReminder24h => ("RECORDATORIO", Bronze),
        NotificationEventType.AdminBookingCreated => ("NUEVA RESERVA", Bronze),
        NotificationEventType.AdminBookingCancelled => ("CANCELACIÓN", Wine),
        _ => ("AVISO", Bronze),
    };

    public static string Build(NotificationMessage message)
    {
        var bodyLines = message.Body
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        var bodyHtml = string.Join("", bodyLines.Select(l =>
            $"""<p style="margin:0 0 14px 0;color:{TextInk};line-height:1.65;font-size:15.5px;font-family:{SlabFont}">{l}</p>"""));

        var businessName = string.IsNullOrWhiteSpace(message.BusinessName) ? "Turneo" : message.BusinessName;
        var (badgeLabel, badgeColor) = BadgeFor(message.EventType);

        var logoHtml = string.IsNullOrWhiteSpace(message.LogoUrl)
            ? $"""<div style="font-family:{DisplayFont};font-size:30px;letter-spacing:0.06em;color:{GoldText};line-height:1">{businessName.ToUpperInvariant()}</div>"""
            : $"""<img src="{message.LogoUrl}" alt="{businessName}" height="36" style="height:36px;max-width:220px;object-fit:contain">""";

        var ctaHtml = string.IsNullOrWhiteSpace(message.CtaUrl)
            ? ""
            : $"""
                <td>
                  <a href="{message.CtaUrl}" style="display:inline-block;padding:13px 30px;background:{badgeColor};color:{GoldText};font-family:{DisplayFont};letter-spacing:0.08em;font-size:14px;border-radius:2px;text-decoration:none;white-space:nowrap">{(message.CtaLabel ?? "Ver más").ToUpperInvariant()}</a>
                </td>
                """;

        var cancelCtaHtml = string.IsNullOrWhiteSpace(message.CancelCtaUrl)
            ? ""
            : $"""
                <td style="padding-left:12px">
                  <a href="{message.CancelCtaUrl}" style="display:inline-block;padding:11.5px 28px;border:1.5px solid {Wine};color:{Wine};font-family:{DisplayFont};letter-spacing:0.08em;font-size:14px;border-radius:2px;text-decoration:none;white-space:nowrap">{(message.CancelCtaLabel ?? "Cancelar").ToUpperInvariant()}</a>
                </td>
                """;

        var actionsHtml = string.IsNullOrEmpty(ctaHtml) && string.IsNullOrEmpty(cancelCtaHtml)
            ? ""
            : $"""
                <div style="margin-top:10px">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    {ctaHtml}{cancelCtaHtml}
                  </tr></table>
                </div>
                """;

        return $"""
            <!DOCTYPE html>
            <html lang="es">
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            {FontLink}
            </head>
            <body style="margin:0;padding:0;background-color:{Paper};font-family:{SlabFont}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:36px 16px">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:{Card};border-radius:4px;overflow:hidden;box-shadow:0 10px 34px rgba(27,22,17,0.18)">

                      <!-- Header: banda de cuero -->
                      <tr>
                        <td style="background:{HeaderBg};padding:30px 32px 26px;text-align:center;border-bottom:3px solid {badgeColor}">
                          {logoHtml}
                          <div style="font-family:{DisplayFont};font-size:12px;letter-spacing:0.32em;color:{badgeColor};margin-top:4px">TURNOS ONLINE</div>
                        </td>
                      </tr>

                      <!-- Badge estampado -->
                      <tr>
                        <td style="padding:26px 32px 0">
                          <span style="display:inline-block;padding:7px 16px;border:1.5px solid {badgeColor};border-radius:3px;color:{badgeColor};font-family:{DisplayFont};font-size:13px;letter-spacing:0.18em">{badgeLabel}</span>
                        </td>
                      </tr>

                      <!-- Cuerpo -->
                      <tr>
                        <td style="padding:18px 32px 6px">
                          <h2 style="margin:0 0 16px;color:{TextInk};font-family:{SlabFont};font-size:21px;font-weight:700">{message.Subject}</h2>
                          {bodyHtml}
                          {actionsHtml}
                        </td>
                      </tr>

                      <!-- Perforación de ticket -->
                      <tr>
                        <td style="padding:28px 0 0">
                          <div style="border-top:2px dashed {Muted}66;margin:0 32px"></div>
                        </td>
                      </tr>

                      <!-- Footer: banda de cuero -->
                      <tr>
                        <td style="background:{HeaderBg};padding:20px 32px;text-align:center">
                          <p style="margin:0;color:{Muted};font-family:{SlabFont};font-size:11.5px">Mensaje automático de {businessName}. Por favor no respondas a este correo.</p>
                          <p style="margin:6px 0 0;color:{Muted}99;font-family:{SlabFont};font-size:10.5px;letter-spacing:0.04em">GESTIONADO CON TURNEO</p>
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
