namespace Turneo.Api.Infrastructure.Integrations;

// Plantilla HTML compartida entre providers de email (GmailProvider vía SMTP,
// EmailProvider vía API HTTP) — la marca (colores, badge, footer) debe verse
// igual sin importar qué provider esté activo en Program.cs.
//
// Diseño base neutral, portado desde Barbería (ver docs/auditoria_backend_barberia_belleza.md
// sección 2.3): se portó la MECÁNICA (botón CTA, botón secundario, badge dinámico por
// evento) con los tokens de color que ya usa este tenant (tailwind.config.js — rosa
// empolvado/blush), sin tipografía ni motivo visual específico de otra vertical.
// Pensado para reskinearse cuando se arme el frontend propio de esta rama.
public static class EmailHtmlBuilder
{
    // Mismos tokens que frontend/turneo-web/tailwind.config.js de esta rama.
    private const string BgColor = "#F5EBE5";      // cream
    private const string CardColor = "#FFFFFF";    // ivory
    private const string AccentColor = "#D69AA6";  // blush
    private const string AccentDark = "#C07E8C";   // blushdark
    private const string TextColor = "#2E2328";    // charcoal
    private const string MutedColor = "#8A7A7E";   // warmgray
    private const string SuccessColor = "#4C7A52";
    private const string CancelColor = "#9C7C88";  // mauve

    private const string FontStack = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

    private static (string Label, string Color) BadgeFor(string? eventType) => eventType switch
    {
        NotificationEventType.BookingCreated => ("Reserva recibida", AccentColor),
        NotificationEventType.BookingConfirmed => ("Turno confirmado", SuccessColor),
        NotificationEventType.BookingCancelled => ("Turno cancelado", CancelColor),
        NotificationEventType.BookingRescheduled => ("Turno reprogramado", AccentDark),
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
            ? $"""<h1 style="margin:0;color:{TextColor};font-size:20px;font-weight:700">{businessName}</h1>"""
            : $"""<img src="{message.LogoUrl}" alt="{businessName}" height="36" style="height:36px;max-width:220px;object-fit:contain">""";

        var ctaHtml = string.IsNullOrWhiteSpace(message.CtaUrl)
            ? ""
            : $"""
                <td>
                  <a href="{message.CtaUrl}" style="display:inline-block;padding:13px 28px;background:{AccentColor};color:#ffffff;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap">{message.CtaLabel ?? "Ver más"}</a>
                </td>
                """;

        var cancelCtaHtml = string.IsNullOrWhiteSpace(message.CancelCtaUrl)
            ? ""
            : $"""
                <td style="padding-left:10px">
                  <a href="{message.CancelCtaUrl}" style="display:inline-block;padding:11.5px 26px;border:1.5px solid {CancelColor};color:{CancelColor};border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap">{message.CancelCtaLabel ?? "Cancelar"}</a>
                </td>
                """;

        var actionsHtml = string.IsNullOrEmpty(ctaHtml) && string.IsNullOrEmpty(cancelCtaHtml)
            ? ""
            : $"""
                <div style="margin-top:8px">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>{ctaHtml}{cancelCtaHtml}</tr></table>
                </div>
                """;

        return $"""
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background-color:{BgColor};font-family:{FontStack}">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:{CardColor};border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(46,35,40,0.08)">

                      <!-- Header -->
                      <tr>
                        <td style="padding:28px 32px 0;text-align:center">
                          {logoHtml}
                        </td>
                      </tr>

                      <!-- Badge -->
                      <tr>
                        <td style="padding:20px 32px 0">
                          <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:{badgeColor}1A;color:{badgeColor};font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase">{badgeLabel}</span>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:16px 32px 8px">
                          <h2 style="margin:0 0 18px;color:{TextColor};font-size:19px;font-weight:700">{message.Subject}</h2>
                          {bodyHtml}
                          {actionsHtml}
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding:28px 32px 24px;text-align:center;border-top:1px solid {BgColor}">
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
