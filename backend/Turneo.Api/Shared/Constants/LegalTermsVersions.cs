namespace Turneo.Api.Shared.Constants;

// Versión vigente de cada documento legal — subir el valor cada vez que cambie
// el texto publicado en /terminos o /terminos-saas, para poder saber con qué
// versión aceptó cada cliente/tenant (auditoría legal, ver Booking.TermsVersion
// y Tenant.TermsVersion).
public static class LegalTermsVersions
{
    public const string Customer = "2026-08-15";
    public const string Saas = "2026-08-13";
}
