using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;

namespace Turneo.Api.Infrastructure.Integrations;

public class GmailProvider : INotificationProvider
{
    private readonly EmailSettings _settings;

    public string Channel => "Email";
    public string ProviderName => "Gmail";
    public bool IsEnabled =>
        !string.IsNullOrWhiteSpace(_settings.Username) &&
        !string.IsNullOrWhiteSpace(_settings.Password) &&
        _settings.Password != "APP_PASSWORD";

    public GmailProvider(IOptions<EmailSettings> settings)
    {
        _settings = settings.Value;
    }

    public Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(booking.Email))
            return Task.FromResult(new NotificationSendResult { Success = false, Error = "El cliente no tiene email", IsTransientFailure = false });

        return SendToAsync(booking.Email, message, cancellationToken);
    }

    public Task<NotificationSendResult> SendDirectAsync(string phone, string messageBody, CancellationToken cancellationToken = default) =>
        Task.FromResult(new NotificationSendResult { Success = false, Error = "GmailProvider no soporta envío directo por teléfono.", IsTransientFailure = false });

    public Task<NotificationSendResult> SendToAddressAsync(string toEmail, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(toEmail))
            return Task.FromResult(new NotificationSendResult { Success = false, Error = "Dirección de destino vacía", IsTransientFailure = false });

        return SendToAsync(toEmail, message, cancellationToken);
    }

    private async Task<NotificationSendResult> SendToAsync(string toEmail, NotificationMessage message, CancellationToken cancellationToken)
    {
        if (!IsEnabled)
            return new NotificationSendResult { Success = false, Error = "Gmail no configurado", IsTransientFailure = false };

        try
        {
            var email = new MimeMessage();
            email.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            email.To.Add(MailboxAddress.Parse(toEmail));
            email.Subject = message.Subject;

            var bodyBuilder = new BodyBuilder
            {
                TextBody = message.Body,
                HtmlBody = BuildHtmlBody(message)
            };
            email.Body = bodyBuilder.ToMessageBody();

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(30));

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(_settings.SmtpServer, _settings.Port, SecureSocketOptions.StartTls, cts.Token);
            await smtp.AuthenticateAsync(_settings.Username, _settings.Password, cts.Token);
            var messageId = await smtp.SendAsync(email, cts.Token);
            await smtp.DisconnectAsync(true, cts.Token);

            return new NotificationSendResult { Success = true, ProviderMessageId = messageId };
        }
        catch (AuthenticationException ex)
        {
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = false };
        }
        catch (OperationCanceledException)
        {
            return new NotificationSendResult { Success = false, Error = "Timeout al conectar con Gmail SMTP (30s)", IsTransientFailure = true };
        }
        catch (Exception ex)
        {
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = true };
        }
    }

    // Paleta tomada de frontend/turneo-web/tailwind.config.js (blush/champagne)
    // para que el email se sienta parte del mismo producto que el sitio — con
    // fondo claro en vez del dark theme del sitio, porque un email oscuro
    // depende de que el cliente de correo respete el CSS (Outlook/Gmail móvil
    // suelen no hacerlo) y termina ilegible en varios clientes.
    private const string BgColor = "#F6F1E9";      // ivory cálido (versión clara de "cream")
    private const string CardColor = "#FFFFFF";
    private const string HeaderColor = "#19191C";  // ivory (dark) del sitio
    private const string AccentColor = "#B9853B";  // blush
    private const string AccentDark = "#8F6427";   // blushdark
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

    private static string BuildHtmlBody(NotificationMessage message)
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
