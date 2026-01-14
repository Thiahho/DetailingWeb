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

        // Crear evento en Google Calendar (opcional, no falla la reserva)
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
                timeSlotId = b.TimeSlotId,
                startDateTime = b.TimeSlot.StartDateTime,
                endDateTime = b.TimeSlot.EndDateTime,
                isAvailable = b.TimeSlot.IsAvailable,
                createdAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(bookings);
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