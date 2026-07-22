using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Scheduling;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Staff")]
public class BlockedDatesController : ControllerBase
{
    private readonly IBlockedDatesRepository _repository;

    public BlockedDatesController(IBlockedDatesRepository repository)
    {
        _repository = repository;
    }

    // GET: api/blockeddates
    [HttpGet]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.View)]
    public async Task<IActionResult> GetBlockedDates()
    {
        var blockedDates = await _repository.GetUpcomingAsync();

        return Ok(blockedDates.Select(d => new
        {
            id = d.Id,
            date = d.Date,
            reason = d.Reason,
            isRecurring = d.IsRecurring,
            professionalId = d.ProfessionalId,
            professionalName = d.ProfessionalName
        }));
    }

    // POST: api/blockeddates (sin ProfessionalId bloquea todo el negocio; con valor, solo ese profesional)
    [HttpPost]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Create)]
    public async Task<IActionResult> BlockDate([FromBody] BlockDateRequest request)
    {
        var exists = await _repository.ExistsAsync(request.Date, request.ProfessionalId);
        if (exists)
        {
            return BadRequest(new { message = "Esta fecha ya está bloqueada" });
        }

        var blockedDate = new BlockedDate
        {
            Date = request.Date,
            Reason = request.Reason,
            ProfessionalId = request.ProfessionalId
        };

        _repository.Add(blockedDate);

        // Eliminar turnos disponibles de ese día (solo del profesional indicado, o todos si no se especificó).
        var slotsToRemove = await _repository.GetAvailableSlotsOnDateAsync(request.Date, request.ProfessionalId);

        _repository.RemoveSlots(slotsToRemove);

        await _repository.SaveChangesAsync();

        return Ok(new
        {
            message = $"Fecha bloqueada. {slotsToRemove.Count} turnos eliminados.",
            blockedDate = new
            {
                id = blockedDate.Id,
                date = blockedDate.Date,
                reason = blockedDate.Reason,
                professionalId = blockedDate.ProfessionalId
            }
        });
    }

    // DELETE: api/blockeddates/5
    [HttpDelete("{id}")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Delete)]
    public async Task<IActionResult> UnblockDate(int id)
    {
        var blockedDate = await _repository.FindAsync(id);

        if (blockedDate == null)
        {
            return NotFound(new { message = "Fecha bloqueada no encontrada" });
        }

        _repository.Remove(blockedDate);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Fecha desbloqueada. Regenerá los turnos para crear nuevos slots." });
    }
}

// DTO para el request
public class BlockDateRequest
{
    public DateTime Date { get; set; }
    public string? Reason { get; set; }
    public int? ProfessionalId { get; set; }
}
