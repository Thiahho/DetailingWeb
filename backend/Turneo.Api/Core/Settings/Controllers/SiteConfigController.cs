using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Core.Settings;

[ApiController]
[Route("api/siteconfig")]
public class SiteConfigController : ControllerBase
{
    private readonly ISiteConfigRepository _repository;
    private readonly IPlanLimitsService _planLimits;

    public SiteConfigController(ISiteConfigRepository repository, IPlanLimitsService planLimits)
    {
        _repository = repository;
        _planLimits = planLimits;
    }

    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> Get()
    {
        var config = await _repository.GetAsync() ?? new SiteConfig();
        // Fail-open (mismo criterio que el resto de PlanLimitsService): un
        // tenant sin plan asignado no muestra el badge — no cambia el
        // comportamiento actual, que nunca lo mostró.
        var hideBranding = await _planLimits.IsFeatureEnabledAsync("HideTurneoBranding");

        return Ok(new
        {
            config.Id,
            config.BusinessName,
            config.WhatsAppNumber,
            config.InstagramUrl,
            config.InstagramHandle,
            config.Location,
            config.LocationShort,
            config.MapEmbedUrl,
            config.SiteUrl,
            config.LogoUrl,
            config.HeroTitle,
            config.HeroSubtitle,
            config.HeroBadge,
            config.HeroHighlights,
            config.LocalPhotos,
            config.MetaDescription,
            config.GoogleReviewUrl,
            config.GooglePlaceId,
            hideBranding
        });
    }

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update([FromBody] SiteConfigRequest request)
    {
        var config = await _repository.GetAsync();
        if (config == null)
        {
            config = new SiteConfig();
            _repository.Add(config);
        }

        config.BusinessName = request.BusinessName;
        config.WhatsAppNumber = request.WhatsAppNumber;
        config.InstagramUrl = request.InstagramUrl;
        config.InstagramHandle = request.InstagramHandle;
        config.Location = request.Location;
        config.LocationShort = request.LocationShort;
        config.MapEmbedUrl = request.MapEmbedUrl;
        config.SiteUrl = request.SiteUrl;
        config.LogoUrl = request.LogoUrl;
        config.HeroTitle = request.HeroTitle;
        config.HeroSubtitle = request.HeroSubtitle;
        config.HeroBadge = request.HeroBadge;
        config.HeroHighlights = request.HeroHighlights ?? new List<string>();
        config.LocalPhotos = SanitizeLocalPhotos(request.LocalPhotos);
        config.MetaDescription = request.MetaDescription;
        config.GoogleReviewUrl = request.GoogleReviewUrl;
        config.GooglePlaceId = request.GooglePlaceId;
        config.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();
        return Ok(config);
    }

    private const int MaxLocalPhotos = 8;

    // Estas URLs terminan en un <img> del sitio público: solo https absolutas
    // (la CSP ya limita img-src, esto evita guardar basura tipo "javascript:").
    private static List<string> SanitizeLocalPhotos(List<string>? photos) =>
        (photos ?? new List<string>())
            .Select(p => p?.Trim() ?? string.Empty)
            .Where(p => Uri.TryCreate(p, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            .Distinct()
            .Take(MaxLocalPhotos)
            .ToList();
}

public record SiteConfigRequest(
    string BusinessName,
    string WhatsAppNumber,
    string InstagramUrl,
    string InstagramHandle,
    string Location,
    string LocationShort,
    string? MapEmbedUrl,
    string SiteUrl,
    string LogoUrl,
    string HeroTitle,
    string HeroSubtitle,
    string HeroBadge,
    string MetaDescription,
    string? GoogleReviewUrl,
    List<string>? HeroHighlights = null,
    string? GooglePlaceId = null,
    List<string>? LocalPhotos = null
);
