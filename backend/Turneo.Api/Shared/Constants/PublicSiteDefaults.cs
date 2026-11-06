namespace Turneo.Api.Shared.Constants;

// Public site base URL (no trailing slash). Used only as the fallback when the
// related configuration keys (Notifications:*BaseUrl, SmartTags:PublicBaseUrl,
// MercadoPago:BaseUrl) are missing, so the host lives in a single place.
public static class PublicSiteDefaults
{
    public const string BaseUrl = "https://www.turneobelleza.com";
}
