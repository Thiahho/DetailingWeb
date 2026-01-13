using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class BlockedDatesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BlockedDatesController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/blockeddates
    [HttpGet]
    public async Task<IActionResult> GetBlockedDates()
    {
        var blockedDates = await _context.BlockedDates
            .Where(d => d.Date >= DateTime.Today)
            .OrderBy(d => d.Date)
            .Select(d => new
            {
                id = d.Id,
                date = d.Date,
                reason = d.Reason,
                isRecurring = d.IsRecurring
            })
            .ToListAsync();

        return Ok(blockedDates);
    }

    // POST: api/blockeddates
    [HttpPost]
    public async Task<IActionResult> BlockDate([FromBody] BlockDateRequest request)
    {
        // Verificar si ya existe
        var exists = await _context.BlockedDates.AnyAsync(d => d.Date == request.Date);
        if (exists)
        {
            return BadRequest(new { message = "Esta fecha ya está bloqueada" });
        }

        var blockedDate = new BlockedDate
        {
            Date = request.Date,
            Reason = request.Reason
        };

        _context.BlockedDates.Add(blockedDate);

        // Eliminar turnos disponibles de ese día
        var slotsToRemove = await _context.TimeSlots
            .Where(t => t.StartDateTime.Date == request.Date.Date && t.IsAvailable)
            .ToListAsync();

        _context.TimeSlots.RemoveRange(slotsToRemove);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Fecha bloqueada. {slotsToRemove.Count} turnos eliminados.",
            blockedDate = new
            {
                id = blockedDate.Id,
                date = blockedDate.Date,
                reason = blockedDate.Reason
            }
        });
    }

    // DELETE: api/blockeddates/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> UnblockDate(int id)
    {
        var blockedDate = await _context.BlockedDates.FindAsync(id);

        if (blockedDate == null)
        {
            return NotFound(new { message = "Fecha bloqueada no encontrada" });
        }

        _context.BlockedDates.Remove(blockedDate);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Fecha desbloqueada. Regenerá los turnos para crear nuevos slots." });
    }
}

// DTO para el request
public class BlockDateRequest
{
    public DateTime Date { get; set; }
    public string? Reason { get; set; }
}