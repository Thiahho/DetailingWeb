using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Turneo.Api.Infrastructure.Integrations;

public record GoogleReviewDto(
    string AuthorName,
    string? ProfilePhotoUrl,
    int Rating,
    string RelativeTimeDescription,
    string Text,
    long Time
);

// Trae las reseñas públicas de Google Places para el Place ID configurado por
// tenant (SiteConfig.GooglePlaceId). Nunca tira: si falta la API key, el Place
// ID, o la llamada falla, devuelve lista vacía y loguea — la sección de
// reseñas del sitio público no puede caerse por esto. Cachea 24h por PlaceId:
// la API de Places es de cuota limitada y el contenido cambia poco.
public class GooglePlacesService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(24);

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GooglePlacesService> _logger;

    public GooglePlacesService(HttpClient httpClient, IConfiguration configuration, IMemoryCache cache, ILogger<GooglePlacesService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
    }

    public async Task<List<GoogleReviewDto>> GetReviewsAsync(string placeId, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"google-reviews:{placeId}";
        if (_cache.TryGetValue(cacheKey, out List<GoogleReviewDto>? cached) && cached is not null)
            return cached;

        var apiKey = _configuration["GooglePlaces:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("[GooglePlaces] GooglePlaces:ApiKey no configurada, no se pueden traer reseñas");
            return new List<GoogleReviewDto>();
        }

        var url = $"https://maps.googleapis.com/maps/api/place/details/json" +
                   $"?place_id={Uri.EscapeDataString(placeId)}&fields=name,rating,user_ratings_total,reviews&key={apiKey}&language=es";

        try
        {
            var response = await _httpClient.GetAsync(url, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[GooglePlaces] Details API falló con {Status} para PlaceId {PlaceId}: {Body}", (int)response.StatusCode, placeId, body);
                return new List<GoogleReviewDto>();
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var status = root.TryGetProperty("status", out var s) ? s.GetString() : null;

            if (status != "OK")
            {
                _logger.LogWarning("[GooglePlaces] Details API devolvió status {Status} para PlaceId {PlaceId}", status, placeId);
                return new List<GoogleReviewDto>();
            }

            var reviews = new List<GoogleReviewDto>();
            if (root.TryGetProperty("result", out var result) && result.TryGetProperty("reviews", out var reviewsEl) && reviewsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var r in reviewsEl.EnumerateArray())
                {
                    reviews.Add(new GoogleReviewDto(
                        AuthorName: r.TryGetProperty("author_name", out var an) ? an.GetString() ?? "Anónimo" : "Anónimo",
                        ProfilePhotoUrl: r.TryGetProperty("profile_photo_url", out var pp) ? pp.GetString() : null,
                        Rating: r.TryGetProperty("rating", out var rt) ? rt.GetInt32() : 0,
                        RelativeTimeDescription: r.TryGetProperty("relative_time_description", out var rd) ? rd.GetString() ?? "" : "",
                        Text: r.TryGetProperty("text", out var tx) ? tx.GetString() ?? "" : "",
                        Time: r.TryGetProperty("time", out var tm) ? tm.GetInt64() : 0
                    ));
                }
            }

            _cache.Set(cacheKey, reviews, CacheTtl);
            return reviews;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GooglePlaces] Error al traer reseñas de PlaceId {PlaceId}", placeId);
            return new List<GoogleReviewDto>();
        }
    }
}
