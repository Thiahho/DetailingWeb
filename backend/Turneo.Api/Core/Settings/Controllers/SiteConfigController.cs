using System.ComponentModel.DataAnnotations;
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
            config.MetaDescription,
            config.GoogleReviewUrl,
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
        config.MetaDescription = request.MetaDescription;
        config.GoogleReviewUrl = request.GoogleReviewUrl;
        config.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();
        return Ok(config);
    }
}

public record SiteConfigRequest(
    [Required, StringLength(150, MinimumLength = 1)] string BusinessName,
    [StringLength(30)] string WhatsAppNumber,
    [StringLength(300)] string InstagramUrl,
    [StringLength(60)] string InstagramHandle,
    [StringLength(200)] string Location,
    [StringLength(100)] string LocationShort,
    [StringLength(2000)] string? MapEmbedUrl,
    [StringLength(300)] string SiteUrl,
    [StringLength(300)] string LogoUrl,
    [StringLength(150)] string HeroTitle,
    [StringLength(300)] string HeroSubtitle,
    [StringLength(60)] string HeroBadge,
    [StringLength(300)] string MetaDescription,
    [StringLength(500)] string? GoogleReviewUrl
) : IValidatableObject
{
    // Único campo que se renderiza como src de <iframe> en una página pública
    // (/reservar): sin esta allowlist, un Admin comprometido podría apuntar el
    // mapa embebido a cualquier dominio (phishing) — ver extractMapEmbedSrc en
    // frontend/turneo-web/src/lib/siteConfig.ts, que hoy acepta cualquier https://.
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var raw = MapEmbedUrl?.Trim();
        if (string.IsNullOrEmpty(raw)) yield break;

        var match = System.Text.RegularExpressions.Regex.Match(raw, "src=[\"']([^\"']+)[\"']", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var url = match.Success ? match.Groups[1].Value : raw;

        var isValidGoogleMapsUrl =
            Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttps) &&
            uri.Host.EndsWith("google.com", StringComparison.OrdinalIgnoreCase);

        if (!isValidGoogleMapsUrl)
        {
            yield return new ValidationResult(
                "MapEmbedUrl debe ser un link o <iframe> de Google Maps (google.com) con https.",
                new[] { nameof(MapEmbedUrl) });
        }
    }
}
