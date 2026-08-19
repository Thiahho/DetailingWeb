using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;

namespace Turneo.Api.Infrastructure.Integrations;

public class GmailProvider : INotificationProvider
{
    private readonly EmailSettings _settings;
    private readonly ILogger<GmailProvider> _logger;

    public string Channel => "Email";
    public string ProviderName => "Gmail";
    public bool IsEnabled =>
        !string.IsNullOrWhiteSpace(_settings.Username) &&
        !string.IsNullOrWhiteSpace(_settings.Password) &&
        _settings.Password != "APP_PASSWORD";

    public GmailProvider(IOptions<EmailSettings> settings, ILogger<GmailProvider> logger)
    {
        _settings = settings.Value;
        _logger = logger;
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
        {
            _logger.LogWarning("[Email] Gmail no configurado (Username/Password vacíos) — no se envía a {ToEmail}", toEmail);
            return new NotificationSendResult { Success = false, Error = "Gmail no configurado", IsTransientFailure = false };
        }

        // LogWarning a propósito (no LogInformation): Production tiene Logging:LogLevel:Default
        // en "Warning" (appsettings.Production.json), así que un log Information acá quedaría
        // invisible en los logs de Render.
        _logger.LogWarning("[Email] Enviando '{Subject}' a {ToEmail} vía {SmtpServer}:{Port} (usuario {Username})",
            message.Subject, toEmail, _settings.SmtpServer, _settings.Port, _settings.Username);

        try
        {
            var email = new MimeMessage();
            email.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            email.To.Add(MailboxAddress.Parse(toEmail));
            email.Subject = message.Subject;

            var bodyBuilder = new BodyBuilder
            {
                TextBody = message.Body,
                HtmlBody = EmailHtmlBuilder.Build(message)
            };
            email.Body = bodyBuilder.ToMessageBody();

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(30));

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(_settings.SmtpServer, _settings.Port, SecureSocketOptions.StartTls, cts.Token);
            await smtp.AuthenticateAsync(_settings.Username, _settings.Password, cts.Token);
            var messageId = await smtp.SendAsync(email, cts.Token);
            await smtp.DisconnectAsync(true, cts.Token);

            _logger.LogWarning("[Email] ENVIADO OK a {ToEmail} (messageId={MessageId})", toEmail, messageId);
            return new NotificationSendResult { Success = true, ProviderMessageId = messageId };
        }
        catch (AuthenticationException ex)
        {
            _logger.LogWarning(ex, "[Email] FALLÓ (autenticación) enviando a {ToEmail} vía {SmtpServer}", toEmail, _settings.SmtpServer);
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = false };
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[Email] FALLÓ (timeout 30s) enviando a {ToEmail} vía {SmtpServer}", toEmail, _settings.SmtpServer);
            return new NotificationSendResult { Success = false, Error = "Timeout al conectar con Gmail SMTP (30s)", IsTransientFailure = true };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Email] FALLÓ enviando a {ToEmail} vía {SmtpServer}", toEmail, _settings.SmtpServer);
            return new NotificationSendResult { Success = false, Error = ex.Message, IsTransientFailure = true };
        }
    }
}
