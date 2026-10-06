namespace Turneo.Api.Tests.Integration;

// Reemplaza la validación real contra Google. El "ID token" de los tests es un
// string con formato "verified:email" o "unverified:email"; cualquier otra cosa
// se trata como token inválido.
public class FakeGoogleTokenValidator : IGoogleTokenValidator
{
    public Task<GoogleIdentity?> ValidateAsync(string idToken)
    {
        var parts = idToken.Split(':', 2);
        GoogleIdentity? identity = parts.Length == 2 && parts[0] is "verified" or "unverified"
            ? new GoogleIdentity(parts[1], parts[0] == "verified")
            : null;
        return Task.FromResult(identity);
    }
}
