using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Turneo.Api.Infrastructure.Security;

namespace Turneo.Api.Marketing.Roulette;

// Endpoints públicos de la ruleta de captación (docs/RULETA.pdf) — sin
// autenticación, pensados para el landing /ruleta del sitio comercial.
[ApiController]
[Route("api/marketing/roulette")]
public class RouletteController : ControllerBase
{
    private readonly RouletteService _rouletteService;
    private readonly ApplicationDbContext _context;

    public RouletteController(RouletteService rouletteService, ApplicationDbContext context)
    {
        _rouletteService = rouletteService;
        _context = context;
    }

    // GET: api/marketing/roulette/prizes
    // Nombres de los premios activos, en orden estable — el frontend arma los
    // gajos de la ruleta visual con esto (no expone probabilidad ni valor).
    [HttpGet("prizes")]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetPrizes()
    {
        var prizes = await _context.RoulettePrizes
            .Where(p => p.IsActive)
            .OrderBy(p => p.Id)
            .Select(p => new PrizeSummary(p.Id, p.Name))
            .ToListAsync();

        return Ok(prizes);
    }

    // POST: api/marketing/roulette/spin
    [HttpPost("spin")]
    [AllowAnonymous]
    [EnableRateLimiting("roulette")]
    public async Task<IActionResult> Spin([FromBody] SpinRequest request)
    {
        try
        {
            var ip = ClientIpResolver.GetClientIp(HttpContext);
            var result = await _rouletteService.SpinAsync(request, ip);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // PATCH: api/marketing/roulette/leads/{id}/additional-data
    [HttpPatch("leads/{id:int}/additional-data")]
    [AllowAnonymous]
    [EnableRateLimiting("roulette")]
    public async Task<IActionResult> AddAdditionalData(int id, [FromBody] AdditionalDataRequest request)
    {
        var ok = await _rouletteService.AddAdditionalDataAsync(id, request);
        return ok ? Ok() : NotFound();
    }
}
