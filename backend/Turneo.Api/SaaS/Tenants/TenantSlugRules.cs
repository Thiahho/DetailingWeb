using System.Text.RegularExpressions;

namespace Turneo.Api.SaaS.Tenants;

// Reglas del slug de un tenant: se usa como subdominio (<slug>.<BaseDomain>),
// así que tiene que ser una etiqueta DNS válida y no pisar subdominios que la
// plataforma usa (o puede usar) para sí misma.
public static partial class TenantSlugRules
{
    private static readonly HashSet<string> ReservedSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "api", "app", "admin", "platform", "mail", "smtp", "imap", "pop", "ftp",
        "static", "assets", "cdn", "img", "media", "files", "docs", "help", "support",
        "status", "blog", "dev", "staging", "test", "demo", "legacy", "auth", "login",
        "dashboard", "panel", "billing", "pagos", "turneo"
    };

    // 3–63 caracteres, minúsculas/dígitos/guiones, sin guion al inicio ni al final.
    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$", RegexOptions.CultureInvariant)]
    private static partial Regex SlugFormat();

    public static bool IsValidFormat(string slug) =>
        !string.IsNullOrEmpty(slug) && SlugFormat().IsMatch(slug);

    public static bool IsReserved(string slug) =>
        !string.IsNullOrEmpty(slug) && ReservedSlugs.Contains(slug);

    // Devuelve el mensaje de error para mostrar al usuario, o null si el slug es válido.
    public static string? Validate(string slug)
    {
        if (!IsValidFormat(slug))
            return "El slug debe tener entre 3 y 63 caracteres: solo letras minúsculas sin acentos, números y guiones (sin guion al inicio ni al final)";

        if (IsReserved(slug))
            return "Ese slug está reservado por la plataforma, elegí otro";

        return null;
    }
}
