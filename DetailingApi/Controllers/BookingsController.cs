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
        await using var transaction = await _context.Database.BeginTransactionAsync();

        var updatedRows = await _context.TimeSlots
            .Where(t => t.Id == request.TimeSlotId && t.IsAvailable)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(t => t.IsAvailable, false));

        if (updatedRows == 0)
        {
            var exists = await _context.TimeSlots.AnyAsync(t => t.Id == request.TimeSlotId);

            if (!exists)
            {
                return NotFound(new { success = false, message = "Turno no encontrado" });
            }

            return Conflict(new { success = false, message = "turno ya reservado" });
        }

        var timeSlot = await _context.TimeSlots
            .AsNoTracking()
            .FirstAsync(t => t.Id == request.TimeSlotId);

        var booking = new Booking
        {
            TimeSlotId = request.TimeSlotId,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            Vehicle = request.Vehicle,
            Service = request.Service,
            Message = request.Message,
            Status = BookingStatus.Pending
        };

        _context.Bookings.Add(booking);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

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
                status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status,
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

        booking.Status = BookingStatus.Confirmed;
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
