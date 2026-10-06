using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace Turneo.Api.Infrastructure.Security;

// Clave de partición del rate limiting (ver políticas en Program.cs).
//
// El navegador nunca llega directo a la API: lo hace el proxy de Next.js, así
// que RemoteIpAddress es la IP de salida del proxy y todos los visitantes
// caerían en el mismo balde. El proxy manda la IP real en X-Client-IP junto con
// X-Proxy-Secret (ver frontend src/lib/tenantHeader.ts); se le cree solo si ese
// secreto coincide con Proxy:SharedSecret — sin eso cualquiera podría elegir su
// balde mandando el header a mano. Sin secreto configurado, con secreto
// incorrecto o con una IP que no parsea, se usa RemoteIpAddress como siempre.
public static class ClientIpResolver
{
    public const string ClientIpHeader = "X-Client-IP";
    public const string ProxySecretHeader = "X-Proxy-Secret";

    public static string GetPartitionKey(HttpContext httpContext) =>
        GetClientIp(httpContext) ?? "unknown";

    // IP del visitante con la misma regla de confianza, para guardarla como dato
    // (ej. leads de la ruleta). Null si no hay ninguna IP disponible.
    public static string? GetClientIp(HttpContext httpContext)
    {
        var sharedSecret = httpContext.RequestServices.GetRequiredService<IConfiguration>()["Proxy:SharedSecret"];

        if (!string.IsNullOrEmpty(sharedSecret)
            && SecretMatches(httpContext.Request.Headers[ProxySecretHeader].ToString(), sharedSecret)
            && IPAddress.TryParse(httpContext.Request.Headers[ClientIpHeader].ToString().Trim(), out var clientIp))
        {
            // Misma IP, misma clave: ::ffff:1.2.3.4 y 1.2.3.4 no deben ser dos baldes.
            return (clientIp.IsIPv4MappedToIPv6 ? clientIp.MapToIPv4() : clientIp).ToString();
        }

        return httpContext.Connection.RemoteIpAddress?.ToString();
    }

    // Comparación en tiempo constante; se comparan los hashes para que tampoco
    // dependa del largo del valor recibido.
    private static bool SecretMatches(string provided, string expected) =>
        CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(provided)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
}
