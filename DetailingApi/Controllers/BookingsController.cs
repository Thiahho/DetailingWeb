using DetailingApi.Data;
using DetailingApi.Models;
using DetailingApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly NotificationService _notificationService;
    private readonly AuthService _authService;
    private readonly IConfiguration _configuration;

    public BookingsController(ApplicationDbContext context, NotificationService notificationService, AuthService authService, IConfiguration configuration)
    {
        _context = context;
        _notificationService = notificationService;
        _authService = authService;
        _configuration = configuration;
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
            CustomerEmailNormalized = request.Email.Trim().ToLowerInvariant(),
            Subject = request.Subject,
            Service = request.Service,
            CustomFieldsJson = request.CustomFieldsJson,
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
            myBookingsLink = $"{_configuration["Notifications:MyBookingsBaseUrl"] ?? "https://detailing-web-five.vercel.app/mis-turnos"}?accessToken={Uri.EscapeDataString(_authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized))}",
            booking = new
            {
                id = booking.Id,
                customerName = booking.CustomerName,
                subject = booking.Subject,
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
            .Include(b => b.Payment)
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
                email = x.Booking.Email,
                subject = x.Booking.Subject,
                service = x.Booking.Service,
                customFieldsJson = x.Booking.CustomFieldsJson,
                message = x.Booking.Message,
                status = x.Booking.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : x.Booking.Status,
                timeSlotId = x.Booking.TimeSlotId,
                startDateTime = x.Booking.TimeSlot.StartDateTime,
                endDateTime = x.Booking.TimeSlot.EndDateTime,
                isAvailable = x.Booking.TimeSlot.IsAvailable,
                createdAt = x.Booking.CreatedAt,
                cancelledAt = x.Booking.CancelledAt,
                paymentStatus = x.Booking.Payment != null ? x.Booking.Payment.Status : (string?)null,
                paymentAmount = x.Booking.Payment != null ? x.Booking.Payment.Amount : (decimal?)null,
                paymentPaidAt = x.Booking.Payment != null ? x.Booking.Payment.PaidAt : (DateTime?)null,
                paymentProvider = x.Booking.Payment != null ? x.Booking.Payment.Provider : (string?)null,
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
                        createdAt = l.CreatedAt,
                        lastAttemptAt = l.LastAttemptAt
                    })
            })
            .ToListAsync();

        return Ok(bookings);
    }

    [HttpGet("my")]
    [Authorize(Roles = "Client,Admin")]
    public async Task<IActionResult> GetMyBookings()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value?.ToLowerInvariant();

        var query = _context.Bookings.Include(b => b.TimeSlot).Include(b => b.Payment).AsQueryable();
        if (role != "Admin")
        {
            if (string.IsNullOrWhiteSpace(email))
                return Unauthorized(new { success = false, message = "Sesión inválida" });

            query = query.Where(b => b.CustomerEmailNormalized == email);
        }

        var bookings = await query
            .OrderByDescending(b => b.TimeSlot.StartDateTime)
            .Select(b => new
            {
                id = b.Id,
                status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status,
                customerName = b.CustomerName,
                service = b.Service,
                subject = b.Subject,
                customFieldsJson = b.CustomFieldsJson,
                startDateTime = b.TimeSlot.StartDateTime,
                endDateTime = b.TimeSlot.EndDateTime,
                canCancel = b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow,
                canReschedule = b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow,
                paymentStatus = b.Payment != null ? b.Payment.Status : (string?)null,
                paymentAmount = b.Payment != null ? b.Payment.Amount : (decimal?)null,
                paymentPaidAt = b.Payment != null ? b.Payment.PaidAt : (DateTime?)null,
                paymentCheckoutUrl = b.Payment != null ? b.Payment.CheckoutUrl : (string?)null
            })
            .ToListAsync();

        return Ok(bookings);
    }

    // GET: api/bookings/by-email?email=xxx (público - solo datos del cliente)
    [HttpGet("by-email")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBookingsByEmail([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email requerido" });

        var normalized = email.Trim().ToLowerInvariant();

        var bookings = await _context.Bookings
            .Include(b => b.TimeSlot)
            .Where(b => b.CustomerEmailNormalized == normalized)
            .OrderByDescending(b => b.TimeSlot.StartDateTime)
            .Select(b => new
            {
                id = b.Id,
                status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status,
                customerName = b.CustomerName,
                service = b.Service,
                subject = b.Subject,
                customFieldsJson = b.CustomFieldsJson,
                startDateTime = b.TimeSlot.StartDateTime,
                endDateTime = b.TimeSlot.EndDateTime,
                canCancel = b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow,
                canReschedule = b.Status != BookingStatus.Cancelled && b.TimeSlot.EndDateTime > DateTime.UtcNow
            })
            .ToListAsync();

        return Ok(bookings);
    }

    // GET: api/bookings/{id}
    [HttpGet("{id}")]
    [Authorize(Roles = "Client,Admin")]
    public async Task<IActionResult> GetBooking(int id)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value?.ToLowerInvariant();

        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (role != "Admin" && booking.CustomerEmailNormalized != email)
            return Forbid();

        return Ok(new
        {
            id = booking.Id,
            customerName = booking.CustomerName,
            service = booking.Service,
            subject = booking.Subject,
            customFieldsJson = booking.CustomFieldsJson,
            startDateTime = booking.TimeSlot.StartDateTime,
            endDateTime = booking.TimeSlot.EndDateTime,
            status = booking.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : booking.Status,
            cancelledAt = booking.CancelledAt
        });
    }

    // POST: api/bookings/{id}/cancel (público - cancelar por link de email)
    [HttpPost("{id}/cancel")]
    [AllowAnonymous]
    public async Task<IActionResult> CancelBooking(int id)
    {
        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "Este turno ya fue cancelado" });

        if (booking.TimeSlot.EndDateTime < DateTime.UtcNow)
            return BadRequest(new { success = false, message = "Este turno ya expiró y no puede cancelarse" });

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        booking.TimeSlot.IsAvailable = true;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno cancelado exitosamente",
            booking = new
            {
                id = booking.Id,
                customerName = booking.CustomerName,
                customerPhone = booking.CustomerPhone,
                email = booking.Email,
                service = booking.Service,
                subject = booking.Subject,
                startDateTime = booking.TimeSlot.StartDateTime,
            }
        });
    }

    // POST: api/bookings/{id}/reschedule (público - solo turnos Pending)
    [HttpPost("{id}/reschedule")]
    [AllowAnonymous]
    public async Task<IActionResult> RescheduleBooking(int id, [FromBody] RescheduleRequest request)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();

        var booking = await _context.Bookings
            .Include(b => b.TimeSlot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "No se puede reprogramar un turno cancelado" });

        if (booking.Status == BookingStatus.Confirmed)
            return BadRequest(new { success = false, message = "Los turnos confirmados deben reprogramarse por WhatsApp" });

        if (booking.TimeSlotId == request.NewTimeSlotId)
            return BadRequest(new { success = false, message = "Ya estás en ese horario" });

        // Reservar el nuevo slot (solo si está disponible)
        var updated = await _context.TimeSlots
            .Where(t => t.Id == request.NewTimeSlotId && t.IsAvailable)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsAvailable, false));

        if (updated == 0)
            return Conflict(new { success = false, message = "Ese horario ya no está disponible" });

        // Liberar el slot anterior
        await _context.TimeSlots
            .Where(t => t.Id == booking.TimeSlotId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsAvailable, true));

        booking.TimeSlotId = request.NewTimeSlotId;
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        // Recargar para devolver la fecha actualizada
        await _context.Entry(booking).Reference(b => b.TimeSlot).LoadAsync();

        return Ok(new
        {
            success = true,
            message = "Turno reprogramado exitosamente",
            newStartDateTime = booking.TimeSlot.StartDateTime,
            booking = new
            {
                id = booking.Id,
                customerName = booking.CustomerName,
                customerPhone = booking.CustomerPhone,
                email = booking.Email,
                service = booking.Service,
                subject = booking.Subject,
                startDateTime = booking.TimeSlot.StartDateTime,
            }
        });
    }

    // DELETE: api/bookings/expired (admin)
    [HttpDelete("expired")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteExpiredBookings()
    {
        var now = DateTime.UtcNow;

        var deletedSlots = await _context.TimeSlots
            .Where(t => t.EndDateTime < now)
            .ExecuteDeleteAsync();

        return Ok(new { success = true, deletedTimeSlots = deletedSlots });
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

// DTOs
public class RescheduleRequest
{
    public int NewTimeSlotId { get; set; }
}

public class CreateBookingRequest
{
    public int TimeSlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string? Service { get; set; }
    public string? CustomFieldsJson { get; set; }
    public string? Message { get; set; }
}
