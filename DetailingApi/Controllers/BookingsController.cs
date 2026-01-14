using DetailingApi.Data;
using DetailingApi.Models;
using DetailingApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly GoogleCalendarService _calendarService;

    public BookingsController(ApplicationDbContext context, GoogleCalendarService calendarService)
    {
        _context = context;
        _calendarService = calendarService;
    }

    // POST: api/bookings (público - para clientes)
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        var timeSlot = await _context.TimeSlots
            .Include(t => t.Bookings)
            .FirstOrDefaultAsync(t => t.Id == request.TimeSlotId);

        if (timeSlot == null)
        {
            return NotFound(new { success = false, message = "Turno no encontrado" });
        }

        if (!timeSlot.IsAvailable)
        {
            return BadRequest(new { success = false, message = "Este turno ya no está disponible" });
        }

        if (timeSlot.Bookings.Count >= timeSlot.MaxBookings)
        {
            return BadRequest(new { success = false, message = "Este turno ya está completo" });
        }

        var booking = new Booking
        {
            TimeSlotId = request.TimeSlotId,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            Vehicle = request.Vehicle,
            Service = request.Service,
            Message = request.Message,
            Status = "Pending"
        };

        _context.Bookings.Add(booking);

        // Marcar turno como no disponible
        timeSlot.IsAvailable = false;

        await _context.SaveChangesAsync();

        // Crear evento en Google Calendar
        try
        {
            var turnoRequest = new TurnoRequest
            {
                Name = request.CustomerName,
                Vehicle = request.Vehicle,
                WhatsApp = request.CustomerPhone,
                DateTime = timeSlot.StartDateTime,
                Message = $"Servicio: {request.Service}\n{request.Message ?? ""}"
            };

            var eventLink = await _calendarService.CrearTurnoAsync(turnoRequest);
            
            booking.GoogleEventId = eventLink;
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error creando evento en Google Calendar: {ex.Message}");
        }

        return Ok(new
        {
            success = true,
            message = "Turno agendado exitosamente",
            booking = new
            {
                id = booking.Id,
                customerName = booking.CustomerName,
                vehicle = booking.Vehicle,
                service = booking.Service,
                startDateTime = timeSlot.StartDateTime,
                endDateTime = timeSlot.EndDateTime
            }
        });
    }

    // GET: api/bookings (admin - todas las reservas)
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllBookings([FromQuery] string status = "all")
    {
        var query = _context.Bookings
            .Include(b => b.TimeSlot)
            .AsQueryable();

        if (status != "all")
        {
            query = query.Where(b => b.Status == status);
        }

        var bookings = await query
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                id = b.Id,
                customerName = b.CustomerName,
                customerPhone = b.CustomerPhone,
                vehicle = b.Vehicle,
                service = b.Service,
                message = b.Message,
                status = b.Status,
                timeSlotId = b.TimeSlotId,
                startDateTime = b.TimeSlot.StartDateTime,
                endDateTime = b.TimeSlot.EndDateTime,
                createdAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(bookings);
    }

    // GET: api/bookings/5 (admin - detalle de una reserva)
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetBooking(int id)
    {
        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
        {
            return NotFound(new { message = "Reserva no encontrada" });
        }

        return Ok(new
        {
            id = booking.Id,
            customerName = booking.CustomerName,
            customerPhone = booking.CustomerPhone,
            vehicle = booking.Vehicle,
            service = booking.Service,
            message = booking.Message,
            status = booking.Status,
            timeSlotId = booking.TimeSlotId,
            startDateTime = booking.TimeSlot.StartDateTime,
            endDateTime = booking.TimeSlot.EndDateTime,
            googleEventId = booking.GoogleEventId,
            createdAt = booking.CreatedAt
        });
    }

    // PUT: api/bookings/5/status (admin - cambiar estado)
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateBookingStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
        {
            return NotFound(new { message = "Reserva no encontrada" });
        }

        var validStatuses = new[] { "Pending", "Confirmed", "Cancelled", "Completed" };
        if (!validStatuses.Contains(request.Status))
        {
            return BadRequest(new { message = "Estado inválido" });
        }

        var oldStatus = booking.Status;
        booking.Status = request.Status;

        // Si se cancela o no asistió, liberar el turno
        if (request.Status == "Cancelled" )
        {
            booking.TimeSlot.IsAvailable = true;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = $"Estado actualizado de '{oldStatus}' a '{request.Status}'",
            booking = new
            {
                id = booking.Id,
                status = booking.Status,
                timeSlotReleased = request.Status == "Cancelled"
            }
        });
    }

    // DELETE: api/bookings/5 (admin - eliminar reserva y liberar turno)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteBooking(int id)
    {
        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
        {
            return NotFound(new { message = "Reserva no encontrada" });
        }

        // Liberar el turno
        booking.TimeSlot.IsAvailable = true;

        _context.Bookings.Remove(booking);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Reserva eliminada y turno liberado"
        });
    }
}

// DTOs
public class CreateBookingRequest
{
    public int TimeSlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Vehicle { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string? Message { get; set; }
}

public class UpdateStatusRequest
{
    public string Status { get; set; } = string.Empty;
}