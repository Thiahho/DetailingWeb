using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Core.SmartTags;

// Puerta de entrada pública de un tap NFC o escaneo QR (docs/NFC.md secciones
// 5-6). Sin [Authorize]: quien llega acá todavía no tiene sesión de ningún tipo.
[ApiController]
[Route("api/smart")]
[AllowAnonymous]
[TenantContextBypass]
public class SmartLinkController : ControllerBase
{
    private readonly ISmartTagsRepository _repository;
    private readonly ISiteConfigRepository _siteConfigRepository;

    public SmartLinkController(ISmartTagsRepository repository, ISiteConfigRepository siteConfigRepository)
    {
        _repository = repository;
        _siteConfigRepository = siteConfigRepository;
    }

    // Resolución de tenant manual (no vía ICurrentTenant/TenantResolutionMiddleware):
    // un tap NFC puede llegar sin X-Tenant-Host o con uno de otro tenant (el
    // celular abre el navegador directo contra el dominio público). El Token
    // identifica al tenant sin ambigüedad — mismo patrón que el webhook de
    // MercadoPago en PaymentsController (IgnoreQueryFilters + TenantId explícito
    // al escribir), deliberadamente sin llamar CurrentTenantService.SetTenant
    // (esa API hoy solo la usa TenantResolutionMiddleware).
    [HttpGet("{token}")]
    [EnableRateLimiting("smart-tag")]
    public async Task<IActionResult> ResolveSmartLink(string token)
    {
        var tag = await _repository.FindActiveByTokenIgnoringTenantAsync(token);

        // Token inexistente y tag inactivo devuelven el mismo 404: no facilitar
        // que un scraper distinga ambos casos (docs/NFC.md sección 11).
        if (tag is null || tag.Tenant is null)
            return NotFound();

        await _repository.RecordEventAsync(tag.Id, tag.TenantId, tag.Action, SmartTagEventType.Interaction);

        return Ok(new SmartLinkResponse(
            tag.Id, tag.Name, tag.Location, tag.Action, tag.Tenant.Slug, tag.Tenant.Name));
    }

    // Paso final de la acción REVIEW (docs/NFC.md CU-03): registra la valoración y,
    // si es alta y el negocio cargó un link de reseñas, indica al frontend a dónde
    // redirigir. No intermedia el envío real de la reseña a terceros.
    [HttpPost("{token}/review")]
    [EnableRateLimiting("smart-tag")]
    public async Task<IActionResult> SubmitReview(string token, [FromBody] SubmitReviewRequest request)
    {
        var tag = await _repository.FindActiveByTokenIgnoringTenantAsync(token);
        if (tag is null || tag.Tenant is null)
            return NotFound();

        await _repository.RecordEventAsync(tag.Id, tag.TenantId, tag.Action, SmartTagEventType.ReviewCompleted);

        string? redirectUrl = null;
        if (request.Rating >= 4)
        {
            var reviewUrl = await _siteConfigRepository.GetGoogleReviewUrlIgnoringTenantAsync(tag.TenantId);
            if (!string.IsNullOrWhiteSpace(reviewUrl))
                redirectUrl = reviewUrl;
        }

        return Ok(new SubmitReviewResponse(redirectUrl));
    }
}

public record SubmitReviewRequest([Range(1, 5)] int Rating);
public record SubmitReviewResponse(string? RedirectUrl);
