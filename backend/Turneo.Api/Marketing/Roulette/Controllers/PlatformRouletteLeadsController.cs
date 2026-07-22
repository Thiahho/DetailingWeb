using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Marketing.Roulette;

// Gestión de leads de la ruleta — exclusivo del dueño de la plataforma, igual
// que PlatformTenantsController (ningún Admin de tenant llega hasta acá).
[ApiController]
[Route("api/platform/roulette")]
[Authorize(Roles = "PlatformOwner")]
public class PlatformRouletteLeadsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PlatformRouletteLeadsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/platform/roulette/leads
    [HttpGet("leads")]
    public async Task<IActionResult> GetLeads()
    {
        var leads = await _context.RouletteLeads
            .Include(l => l.Prize)
            .OrderByDescending(l => l.FechaParticipacion)
            .Select(l => new RouletteLeadSummary(
                l.Id,
                l.NombreNegocio,
                l.NombreResponsable,
                l.WhatsApp,
                l.Email,
                l.Instagram,
                l.TipoNegocio,
                l.CantidadProfesionales,
                l.ProblemaPrincipal,
                l.Prize!.Name,
                l.CodigoPromocional,
                l.FechaParticipacion,
                l.CodigoVenceAt,
                l.Fuente,
                l.Campaign,
                l.Estado.ToString(),
                l.Notas,
                l.FechaUltimoContacto))
            .ToListAsync();

        return Ok(leads);
    }

    // PATCH: api/platform/roulette/leads/{id}/status
    [HttpPatch("leads/{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateLeadStatusRequest request)
    {
        var lead = await _context.RouletteLeads.FindAsync(id);
        if (lead is null) return NotFound();

        if (!Enum.TryParse<RouletteLeadStatus>(request.Estado, ignoreCase: true, out var estado))
            return BadRequest(new { message = "Estado inválido" });

        lead.Estado = estado;
        if (request.Notas is not null) lead.Notas = request.Notas;
        lead.FechaUltimoContacto = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok();
    }

    // DELETE: api/platform/roulette/leads/{id}
    // Libera el WhatsApp (índice único) para una nueva participación legítima
    // — útil para borrar pruebas/spam. RouletteLead no tiene hijos que la
    // referencien, así que es un delete directo sin problemas de FK.
    [HttpDelete("leads/{id:int}")]
    public async Task<IActionResult> DeleteLead(int id)
    {
        var lead = await _context.RouletteLeads.FindAsync(id);
        if (lead is null) return NotFound();

        _context.RouletteLeads.Remove(lead);
        await _context.SaveChangesAsync();
        return Ok();
    }

    // GET: api/platform/roulette/prizes
    // A diferencia de RouletteController.GetPrizes (público, solo activos y
    // sin detalle), esto trae el catálogo completo para administrarlo.
    [HttpGet("prizes")]
    public async Task<IActionResult> GetPrizesAdmin()
    {
        var prizes = await _context.RoulettePrizes
            .OrderBy(p => p.Id)
            .Select(p => new PrizeAdminSummary(
                p.Id,
                p.Name,
                p.Description,
                p.Type.ToString(),
                p.Value,
                p.DurationMonths,
                p.Probability,
                p.ValidityDays,
                p.CodeSlug,
                p.IsActive,
                _context.RouletteLeads.Count(l => l.PrizeId == p.Id)))
            .ToListAsync();

        return Ok(prizes);
    }

    // POST: api/platform/roulette/prizes
    [HttpPost("prizes")]
    public async Task<IActionResult> CreatePrize([FromBody] SavePrizeRequest request)
    {
        if (!Enum.TryParse<RoulettePrizeType>(request.Type, ignoreCase: true, out var type))
            return BadRequest(new { message = "Tipo de premio inválido" });

        var prize = new RoulettePrize
        {
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Type = type,
            Value = request.Value,
            DurationMonths = request.DurationMonths,
            Probability = request.Probability,
            ValidityDays = request.ValidityDays,
            CodeSlug = request.CodeSlug.Trim().ToUpperInvariant(),
            IsActive = request.IsActive,
        };

        _context.RoulettePrizes.Add(prize);
        await _context.SaveChangesAsync();
        return Ok(new { id = prize.Id });
    }

    // PATCH: api/platform/roulette/prizes/{id}
    // No hay DELETE de premios a propósito: RouletteLead.PrizeId es Restrict,
    // así que un premio ya entregado no se puede borrar sin perder el
    // historial de a qué le tocó a cada lead — desactivarlo (IsActive=false)
    // lo saca de la ruleta sin romper esa referencia.
    [HttpPatch("prizes/{id:int}")]
    public async Task<IActionResult> UpdatePrize(int id, [FromBody] SavePrizeRequest request)
    {
        var prize = await _context.RoulettePrizes.FindAsync(id);
        if (prize is null) return NotFound();

        if (!Enum.TryParse<RoulettePrizeType>(request.Type, ignoreCase: true, out var type))
            return BadRequest(new { message = "Tipo de premio inválido" });

        prize.Name = request.Name.Trim();
        prize.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        prize.Type = type;
        prize.Value = request.Value;
        prize.DurationMonths = request.DurationMonths;
        prize.Probability = request.Probability;
        prize.ValidityDays = request.ValidityDays;
        prize.CodeSlug = request.CodeSlug.Trim().ToUpperInvariant();
        prize.IsActive = request.IsActive;

        await _context.SaveChangesAsync();
        return Ok();
    }
}
