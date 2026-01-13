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
        // Verificar que el turno existe y está disponible
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

        // Verificar que no exceda el máximo de reservas
        if (timeSlot.Bookings.Count >= timeSlot.MaxBookings)
        {
            return BadRequest(new { success = false, message = "Este turno ya está completo" });
        }

        // Crear reserva
        var booking = new Booking
        {
            TimeSlotId = request.TimeSlotId,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            Vehicle = request.Vehicle,
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
                Message = request.Message ?? ""
            };

            var eventLink = await _calendarService.CrearTurnoAsync(turnoRequest);
            
            // Guardar el ID del evento de Google Calendar
            booking.GoogleEventId = eventLink;
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Log error pero no fallar la reserva
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
                message = b.Message,
                status = b.Status,
                startDateTime = b.TimeSlot.StartDateTime,
                endDateTime = b.TimeSlot.EndDateTime,
                createdAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(bookings);
    }
}

// DTOs
public class CreateBookingRequest
{
    public int TimeSlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Vehicle { get; set; } = string.Empty;
    public string? Message { get; set; }
}