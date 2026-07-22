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
}
