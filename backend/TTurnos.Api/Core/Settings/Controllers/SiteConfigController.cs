using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TTurnos.Api.Core.Settings;

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
    public async Task<IActionResult> Get()
    {
        var config = await _repository.GetAsync() ?? new SiteConfig();
        // Fail-open (mismo criterio que el resto de PlanLimitsService): un
        // tenant sin plan asignado no muestra el badge — no cambia el
        // comportamiento actual, que nunca lo mostró.
        var hideBranding = await _planLimits.IsFeatureEnabledAsync("HideTTurnosBranding");

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
        config.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();
        return Ok(config);
    }
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
    string MetaDescription
);
