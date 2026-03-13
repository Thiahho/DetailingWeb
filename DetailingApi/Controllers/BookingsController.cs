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
    private readonly NotificationService _notificationService;

    public BookingsController(ApplicationDbContext context, NotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
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
            Email = request.Email,
            Vehicle = request.Vehicle,
            Service = request.Service,
            Message = request.Message,
            Status = BookingStatus.Pending
        };

        _context.Bookings.Add(booking);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        await _notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingCreated);

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
            .GroupJoin(
                _context.NotificationLogs,
                b => b.Id,
                n => n.BookingId,
                (b, logs) => new { Booking = b, Logs = logs })
            .OrderByDescending(x => x.Booking.CreatedAt)
            .Select(x => new
            {
                id = x.Booking.Id,
                customerName = x.Booking.CustomerName,
                customerPhone = x.Booking.CustomerPhone,
                Email = x.Booking.Email,
                vehicle = x.Booking.Vehicle,
                service = x.Booking.Service,
                message = x.Booking.Message,
                status = x.Booking.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : x.Booking.Status,
                timeSlotId = x.Booking.TimeSlotId,
                startDateTime = x.Booking.TimeSlot.StartDateTime,
                endDateTime = x.Booking.TimeSlot.EndDateTime,
                isAvailable = x.Booking.TimeSlot.IsAvailable,
                createdAt = x.Booking.CreatedAt,
                cancelledAt = x.Booking.CancelledAt,
                notificationStatus = x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Failed)
                    ? NotificationDeliveryStatus.Failed
                    : x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Pending)
                        ? NotificationDeliveryStatus.Pending
                        : x.Logs.Any(l => l.Status == NotificationDeliveryStatus.Sent)
                            ? NotificationDeliveryStatus.Sent
                            : NotificationDeliveryStatus.Pending,
                notificationLogs = x.Logs
                    .OrderByDescending(l => l.CreatedAt)
                    .Select(l => new
                    {
                        channel = l.Channel,
                        eventType = l.EventType,
                        status = l.Status,
                        providerMessageId = l.ProviderMessageId,
                        errorMessage = l.ErrorMessage,
                        retryCount = l.RetryCount,
                        lastAttemptAt = l.LastAttemptAt
                    })
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
        await _notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingConfirmed);

        return Ok(new { success = true, message = "Turno confirmado exitosamente" });
    }
}

// DTO
public class CreateBookingRequest
{
    public int TimeSlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Vehicle { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string? Message { get; set; }
}
