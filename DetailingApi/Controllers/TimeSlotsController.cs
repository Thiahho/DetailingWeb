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

    // GET: api/timeslots (admin - todos los turnos con info de reserva)
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
                booking = s.Bookings
                    .Where(b => b.Status != BookingStatus.Cancelled)
                    .Select(b => new
                    {
                        id = b.Id,
                        customerName = b.CustomerName,
                        customerPhone = b.CustomerPhone,
                        vehicle = b.Vehicle,
                        service = b.Service,
                        message = b.Message,
                        status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status
                    }).FirstOrDefault()
            })
            .ToListAsync();

        return Ok(slots);
    }

    // POST: api/timeslots (admin - crear turno)
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

    // PUT: api/timeslots/5 (admin - editar turno)
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

        // No permitir editar si está reservado
        if (!slot.IsAvailable)
        {
            return BadRequest(new { message = "No se puede editar un turno reservado. Habilitalo primero." });
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

    // PUT: api/timeslots/5/release (admin - HABILITAR turno reservado)
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

        // Confirmed → marcar como Cancelled; Pending → eliminar
        var toDelete = slot.Bookings.Where(b => b.Status != BookingStatus.Confirmed).ToList();
        var toCancel = slot.Bookings.Where(b => b.Status == BookingStatus.Confirmed).ToList();

        _context.Bookings.RemoveRange(toDelete);
        foreach (var booking in toCancel)
        {
            booking.Status = BookingStatus.Cancelled;
            booking.CancelledAt = DateTime.UtcNow;
        }

        // Marcar turno como HABILITADO
        slot.IsAvailable = true;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno habilitado exitosamente"
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

        // No permitir eliminar si está reservado
        if (!slot.IsAvailable)
        {
            return BadRequest(new { message = "No se puede eliminar un turno reservado. Habilitalo primero." });
        }

        _context.TimeSlots.Remove(slot);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Turno eliminado" });
    }
}

// DTOs
public class CreateTimeSlotRequest
{
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
}