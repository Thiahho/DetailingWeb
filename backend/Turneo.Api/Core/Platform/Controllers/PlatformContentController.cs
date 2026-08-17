using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Platform;

// Respuesta a reclamos de copyright sobre contenido subido por un tenant
// (galería, videos, imágenes de servicio/profesional, logo, fotos de CRM o
// de historial de turnos) — ver /derechos-de-autor para el proceso público
// de denuncia. Exclusivo del dueño de la plataforma, igual que
// PlatformTenantsController.
[ApiController]
[Route("api/platform")]
[Authorize(Roles = "PlatformOwner")]
public class PlatformContentController : ControllerBase
{
    private readonly ContentTakedownService _takedownService;

    public PlatformContentController(ContentTakedownService takedownService)
    {
        _takedownService = takedownService;
    }

    // POST: api/platform/content-takedown
    [HttpPost("content-takedown")]
    public async Task<IActionResult> TakeDown([FromBody] ContentTakedownRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(new { message = "URL requerida" });

        var result = await _takedownService.TakeDownAsync(request.Url.Trim());
        return Ok(result);
    }
}

public record ContentTakedownRequest(string Url);
