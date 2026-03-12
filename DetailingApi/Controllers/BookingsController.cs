using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BookingsController(ApplicationDbContext context)
    {
        _context = context;
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

        var booking = new Booking
        {
            TimeSlotId = request.TimeSlotId,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            Vehicle = request.Vehicle,
            Service = request.Service,
            Message = request.Message,
            Status = "Reservado"
        };

        _context.Bookings.Add(booking);

        // Marcar turno como RESERVADO
        timeSlot.IsAvailable = false;

        await _context.SaveChangesAsync();

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
    public async Task<IActionResult> GetAllBookings()
    {
        var bookings = await _context.Bookings
            .Include(b => b.TimeSlot)
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
                isAvailable = b.TimeSlot.IsAvailable,
                createdAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(bookings);
    }

    // PATCH: api/bookings/{id}/confirm (admin)
    [HttpPatch("{id}/confirm")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ConfirmBooking(int id)
    {
        var booking = await _context.Bookings.FindAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        booking.Status = "Confirmed";
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Turno confirmado exitosamente" });
    }
}

// DTO
public class CreateBookingRequest
{
    public int TimeSlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Vehicle { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string? Message { get; set; }
}