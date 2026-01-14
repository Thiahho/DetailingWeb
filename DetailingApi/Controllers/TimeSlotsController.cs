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
            .Include(t => t.Bookings)
            .OrderBy(t => t.StartDateTime)
            .Select(s => new
            {
                id = s.Id,
                startDateTime = s.StartDateTime,
                endDateTime = s.EndDateTime,
                isAvailable = s.IsAvailable,
                bookingsCount = s.Bookings.Count,
                label = s.StartDateTime.ToString("ddd dd/MM/yyyy · HH:mm", new System.Globalization.CultureInfo("es-AR")),
                // Info de la reserva si existe
                booking = s.Bookings.Select(b => new
                {
                    id = b.Id,
                    customerName = b.CustomerName,
                    customerPhone = b.CustomerPhone,
                    vehicle = b.Vehicle,
                    service = b.Service,
                    status = b.Status
                }).FirstOrDefault()
            })
            .ToListAsync();

        return Ok(slots);
    }

    // POST: api/timeslots (admin - crear turno manual)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSlot([FromBody] CreateTimeSlotRequest request)
    {
        if (request.StartDateTime <= DateTime.Now)
        {
            return BadRequest(new { message = "La fecha debe ser futura" });
        }

        if (request.EndDateTime <= request.StartDateTime)
        {
            return BadRequest(new { message = "La hora de fin debe ser posterior al inicio" });
        }

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

        if (slot.Bookings.Any())
        {
            return BadRequest(new { message = "No se puede editar un turno con reservas" });
        }

        if (request.StartDateTime <= DateTime.Now)
        {
            return BadRequest(new { message = "La fecha debe ser futura" });
        }

        var exists = await _context.TimeSlots
            .AnyAsync(t => t.StartDateTime == request.StartDateTime && t.Id != id);

        if (exists)
        {
            return BadRequest(new { message = "Ya existe otro turno en este horario" });
        }

        slot.StartDateTime = request.StartDateTime;
        slot.EndDateTime = request.StartDateTime.AddHours(2);

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

    // PUT: api/timeslots/5/release (admin - liberar turno)
    [HttpPut("{id}/release")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ReleaseSlot(int id)
    {
        var slot = await _context.TimeSlots
            .Include(t => t.Bookings)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        // Cancelar todas las reservas asociadas
        foreach (var booking in slot.Bookings)
        {
            booking.Status = "Cancelled";
        }

        // Marcar turno como disponible
        slot.IsAvailable = true;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno liberado exitosamente. Las reservas fueron canceladas."
        });
    }

    // PUT: api/timeslots/5/block (admin - bloquear turno sin reserva)
    [HttpPut("{id}/block")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BlockSlot(int id)
    {
        var slot = await _context.TimeSlots.FindAsync(id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        slot.IsAvailable = false;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno bloqueado exitosamente"
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

        if (slot.Bookings.Any())
        {
            return BadRequest(new { message = "No se puede eliminar un turno con reservas. Liberalo primero." });
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