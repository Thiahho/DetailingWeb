using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;
using DetailingApi.Models;

namespace DetailingApi.Services;

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

    public async Task<NotificationSendResult> SendAsync(Booking booking, NotificationMessage message, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
            return new NotificationSendResult { Success = false, Error = "Gmail no configurado", IsTransientFailure = false };

        if (string.IsNullOrWhiteSpace(booking.Email))
            return new NotificationSendResult { Success = false, Error = "El cliente no tiene email", IsTransientFailure = false };

        try
        {
            var email = new MimeMessage();
            email.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            email.To.Add(MailboxAddress.Parse(booking.Email));
            email.Subject = message.Subject;

            var bodyBuilder = new BodyBuilder
            {
                TextBody = message.Body,
                HtmlBody = BuildHtmlBody(message)
            };
            email.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(_settings.SmtpServer, _settings.Port, SecureSocketOptions.Auto, cancellationToken);
            await smtp.AuthenticateAsync(_settings.Username, _settings.Password, cancellationToken);
            var messageId = await smtp.SendAsync(email, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);

            return new NotificationSendResult { Success = true, ProviderMessageId = messageId };
        }
        catch (AuthenticationException ex)
        {
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = false };
        }
        catch (Exception ex)
        {
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = true };
        }
    }

    private static string BuildHtmlBody(NotificationMessage message)
    {
        var bodyLines = message.Body
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);

        var bodyHtml = string.Join("", bodyLines.Select(l => $"<p style=\"margin:0 0 10px 0;color:#444;line-height:1.6\">{l}</p>"));

        return $"""
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">

                      <!-- Header -->
                      <tr>
                        <td style="background:#0f1115;padding:28px 32px;text-align:center">
                          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px">Auto Detail Studio</h1>
                          <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:13px">Detailing profesional</p>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:36px 32px">
                          <h2 style="margin:0 0 20px;color:#111;font-size:18px;font-weight:600">{message.Subject}</h2>
                          {bodyHtml}
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="background:#f8f8f8;padding:18px 32px;text-align:center;border-top:1px solid #eee">
                          <p style="margin:0;color:#aaa;font-size:12px">Este es un mensaje automático. Por favor no respondas a este correo.</p>
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
