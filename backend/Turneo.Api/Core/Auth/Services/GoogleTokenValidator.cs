using Google.Apis.Auth;

namespace Turneo.Api.Core.Auth;

public record GoogleIdentity(string Email, bool EmailVerified);

// Detrás de una interfaz para poder reemplazarla por un fake en los tests de
// integración (la validación real pega contra las claves públicas de Google).
public interface IGoogleTokenValidator
{
    // Null si el token no es válido, no fue emitido para esta app, o Google no está configurado.
    Task<GoogleIdentity?> ValidateAsync(string idToken);
}

public class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly IConfiguration _configuration;

    public GoogleTokenValidator(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task<GoogleIdentity?> ValidateAsync(string idToken)
    {
        var clientId = _configuration["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
            return null;

        try
        {
            // Audience: sin esto se aceptaría un ID token emitido para cualquier otra app de Google.
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            });
            return new GoogleIdentity(payload.Email, payload.EmailVerified);
        }
        catch (InvalidJwtException)
        {
            return null;
        }
    }
}
