using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Turneo.Api.Infrastructure.Integrations;

// Los uploads del frontend van directo del browser a Cloudinary con un preset
// "unsigned" (ver CloudinaryUpload.tsx) — el backend nunca tocó Cloudinary
// hasta ahora, y por eso "borrar" algo en el panel admin solo sacaba la
// referencia en la base, dejando el archivo vivo para siempre en su URL de
// Cloudinary. Este servicio agrega la única pieza que faltaba: poder destruir
// el archivo real, necesario para responder a un reclamo de copyright.
public class CloudinaryAdminService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<CloudinaryAdminService> _logger;

    public CloudinaryAdminService(HttpClient httpClient, IConfiguration configuration, ILogger<CloudinaryAdminService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error)> TryDestroyAsync(string secureUrl, CancellationToken cancellationToken = default)
    {
        var cloudName = _configuration["Cloudinary:CloudName"];
        var apiKey = _configuration["Cloudinary:ApiKey"];
        var apiSecret = _configuration["Cloudinary:ApiSecret"];

        if (string.IsNullOrWhiteSpace(cloudName) || string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(apiSecret))
            return (false, "Cloudinary no configurado (Cloudinary:CloudName/ApiKey/ApiSecret vacíos)");

        var parsed = ParseCloudinaryUrl(secureUrl);
        if (parsed is null)
            return (false, "La URL no parece ser un asset de Cloudinary (res.cloudinary.com/.../upload/...)");

        var (resourceType, publicId) = parsed.Value;
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();

        // Firma de Cloudinary: sha1(paramsOrdenadosAlfabéticamente + apiSecret),
        // sin incluir api_key ni la propia signature. Con un solo parámetro
        // firmado (public_id) no hace falta ordenar nada más.
        var signature = Sha1Hex($"public_id={publicId}&timestamp={timestamp}{apiSecret}");

        var form = new Dictionary<string, string>
        {
            ["public_id"] = publicId,
            ["timestamp"] = timestamp,
            ["api_key"] = apiKey,
            ["signature"] = signature
        };

        var endpoint = $"https://api.cloudinary.com/v1_1/{cloudName}/{resourceType}/destroy";

        try
        {
            var response = await _httpClient.PostAsync(endpoint, new FormUrlEncodedContent(form), cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Cloudinary] destroy {PublicId} falló con {Status}: {Body}", publicId, (int)response.StatusCode, body);
                return (false, $"Cloudinary respondió {(int)response.StatusCode}: {body}");
            }

            using var doc = JsonDocument.Parse(body);
            var result = doc.RootElement.TryGetProperty("result", out var r) ? r.GetString() : null;

            // "not found" es éxito a nuestros fines: el archivo ya no está publicable.
            if (result == "ok" || result == "not found")
            {
                _logger.LogInformation("[Cloudinary] destroy {PublicId}: {Result}", publicId, result);
                return (true, result == "not found" ? "El archivo ya no existía en Cloudinary" : null);
            }

            return (false, $"Cloudinary devolvió un resultado inesperado: {body}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Cloudinary] Error al destruir {PublicId}", publicId);
            return (false, ex.Message);
        }
    }

    // De https://res.cloudinary.com/<cloud>/<image|video>/upload/v169.../carpeta/archivo.ext
    // extrae el resource_type ("image"/"video") y el public_id
    // ("carpeta/archivo", sin versión ni extensión).
    internal static (string ResourceType, string PublicId)? ParseCloudinaryUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return null;
        if (!uri.Host.EndsWith("cloudinary.com", StringComparison.OrdinalIgnoreCase)) return null;

        var segments = uri.AbsolutePath.Trim('/').Split('/');
        if (segments.Length < 4) return null;

        var resourceType = segments[1];
        var versionIndex = Array.FindIndex(segments, s => s.Length > 1 && s[0] == 'v' && s[1..].All(char.IsDigit));
        if (versionIndex < 0 || versionIndex + 1 >= segments.Length) return null;

        var publicIdParts = segments[(versionIndex + 1)..];
        var lastPart = publicIdParts[^1];
        var dotIndex = lastPart.LastIndexOf('.');
        if (dotIndex > 0) publicIdParts[^1] = lastPart[..dotIndex];

        return (resourceType, string.Join('/', publicIdParts));
    }

    private static string Sha1Hex(string input)
    {
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexStringLower(hash);
    }
}
