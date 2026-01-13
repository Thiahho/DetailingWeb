using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TimeSlotsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TimeSlotsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/timeslots/available (público - para clientes)
    [HttpGet("available")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAvailableSlots()
    {
        var slots = await _context.TimeSlots
            .Where(t => t.IsAvailable && t.StartDateTime > DateTime.Now)
            .OrderBy(t => t.StartDateTime)
            .Select(s => new
            {
                id = s.Id,
                startDateTime = s.StartDateTime,
                endDateTime = s.EndDateTime,
                // Cambiar formato: solo mostrar día y hora
                label = s.StartDateTime.ToString("ddd dd/MMM · HH:mm", new System.Globalization.CultureInfo("es-AR"))
            })
            .ToListAsync();

        return Ok(slots);
    }

    // GET: api/timeslots (admin - todos los turnos)
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllSlots()
    {
        var slots = await _context.TimeSlots
            .OrderBy(t => t.StartDateTime)
            .Select(s => new
            {
                id = s.Id,
                startDateTime = s.StartDateTime,
                endDateTime = s.EndDateTime,
                isAvailable = s.IsAvailable,
                bookingsCount = s.Bookings.Count,
                // Cambiar formato admin
                label = s.StartDateTime.ToString("ddd dd/MM/yyyy · HH:mm", new System.Globalization.CultureInfo("es-AR"))
            })
            .ToListAsync();

        return Ok(slots);
    }

    // POST: api/timeslots (admin - crear turno manual)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSlot([FromBody] CreateTimeSlotRequest request)
    {
        // Validar que la fecha sea futura
        if (request.StartDateTime <= DateTime.Now)
        {
            return BadRequest(new { message = "La fecha debe ser futura" });
        }

        // Validar que el final sea después del inicio
        if (request.EndDateTime <= request.StartDateTime)
        {
            return BadRequest(new { message = "La hora de fin debe ser posterior al inicio" });
        }

        // Verificar que no exista un turno en el mismo horario
        var exists = await _context.TimeSlots
            .AnyAsync(t => t.StartDateTime == request.StartDateTime);

        if (exists)
        {
            return BadRequest(new { message = "Ya existe un turno en este horario" });
        }

        var slot = new TimeSlot
        {
            StartDateTime = request.StartDateTime,
            EndDateTime = request.EndDateTime,
            IsAvailable = true,
            MaxBookings = 1
        };

        _context.TimeSlots.Add(slot);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno creado exitosamente",
            slot = new
            {
                id = slot.Id,
                startDateTime = slot.StartDateTime,
                endDateTime = slot.EndDateTime
            }
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSlot(int id, [FromBody] UpdateTimeSlotRequest request)
    {
        var slot = await _context.TimeSlots
            .Include(t => t.Bookings)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        // No permitir editar si tiene reservas
        if (slot.Bookings.Any())
        {
            return BadRequest(new { message = "No se puede editar un turno con reservas" });
        }

        // Validar que la fecha sea futura
        if (request.StartDateTime <= DateTime.Now)
        {
            return BadRequest(new { message = "La fecha debe ser futura" });
        }

        // Verificar que no exista otro turno en el mismo horario
        var exists = await _context.TimeSlots
            .AnyAsync(t => t.StartDateTime == request.StartDateTime && t.Id != id);

        if (exists)
        {
            return BadRequest(new { message = "Ya existe otro turno en este horario" });
        }

        // Actualizar
        slot.StartDateTime = request.StartDateTime;
        slot.EndDateTime = request.StartDateTime.AddHours(2); // 2 horas después

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno actualizado exitosamente",
            slot = new
            {
                id = slot.Id,
                startDateTime = slot.StartDateTime,
                endDateTime = slot.EndDateTime
            }
        });
    }
    // DELETE: api/timeslots/5 (admin - eliminar turno)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSlot(int id)
    {
        var slot = await _context.TimeSlots
            .Include(t => t.Bookings)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        // No permitir eliminar si tiene reservas
        if (slot.Bookings.Any())
        {
            return BadRequest(new { message = "No se puede eliminar un turno con reservas" });
        }

        _context.TimeSlots.Remove(slot);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Turno eliminado" });
    }
}

// DTO
public class CreateTimeSlotRequest
{
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
}