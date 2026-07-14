using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace TTurnos.Api.Core.Bookings;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IBookingsRepository _repository;
    private readonly NotificationService _notificationService;
    private readonly AuthService _authService;
    private readonly IConfiguration _configuration;

    public BookingsController(IBookingsRepository repository, NotificationService notificationService, AuthService authService, IConfiguration configuration)
    {
        _repository = repository;
        _notificationService = notificationService;
        _authService = authService;
        _configuration = configuration;
    }

    // POST: api/bookings (público - para clientes)
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Email) && !new EmailAddressAttribute().IsValid(request.Email))
            return BadRequest(new { success = false, message = "El email no es válido" });

        if (request.ProfessionalId.HasValue)
        {
            var professionalIsActive = await _repository.ProfessionalIsActiveAsync(request.ProfessionalId.Value);

            if (!professionalIsActive)
                return BadRequest(new { success = false, message = "El profesional seleccionado no está disponible" });
        }

        await using var transaction = await _repository.BeginTransactionAsync();

        var updatedRows = await _repository.TryClaimSlotAsync(request.TimeSlotId);

        if (updatedRows == 0)
        {
            var exists = await _repository.SlotExistsAsync(request.TimeSlotId);

            if (!exists)
            {
                return NotFound(new { success = false, message = "Turno no encontrado" });
            }

            return Conflict(new { success = false, message = "turno ya reservado" });
        }

        var timeSlot = await _repository.GetSlotSnapshotAsync(request.TimeSlotId);

        // Si el turno ya pertenece a un profesional, manda esa asignación por sobre
        // cualquier valor que haya mandado el cliente (turnos legacy sin dueño mantienen
        // el comportamiento anterior: el profesional lo elige el cliente al reservar).
        var professionalId = timeSlot.ProfessionalId ?? request.ProfessionalId;

        var booking = new Booking
        {
            TimeSlotId = request.TimeSlotId,
            ProfessionalId = professionalId,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            Email = request.Email,
            CustomerEmailNormalized = request.Email?.Trim().ToLowerInvariant() ?? string.Empty,
            Subject = request.Subject,
            Service = request.Service,
            CustomFieldsJson = request.CustomFieldsJson,
            Message = request.Message,
            Status = BookingStatus.Pending
        };

        _repository.Add(booking);

        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();
        await _notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingCreated);

        return Ok(new
        {
            success = true,
            message = "Turno agendado exitosamente",
            myBookingsLink = $"{_configuration["Notifications:MyBookingsBaseUrl"] ?? "https://detailing-web-five.vercel.app/mis-turnos"}?accessToken={Uri.EscapeDataString(_authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized, booking.TenantId))}",
            booking = new
            {
                id = booking.Id,
                customerName = booking.CustomerName,
                subject = booking.Subject,
                service = booking.Service,
                professionalId = booking.ProfessionalId,
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
        var bookings = await _repository.GetAllWithDetailsAsync();
        return Ok(bookings);
    }

    [HttpGet("my")]
    [Authorize(Roles = "Client,Admin")]
    public async Task<IActionResult> GetMyBookings()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value?.ToLowerInvariant();

        string? emailFilter = null;
        if (role != "Admin")
        {
            if (string.IsNullOrWhiteSpace(email))
                return Unauthorized(new { success = false, message = "Sesión inválida" });

            emailFilter = email;
        }

        var bookings = await _repository.GetMineAsync(emailFilter);
        return Ok(bookings);
    }

    // GET: api/bookings/by-email?email=xxx (público - solo datos del cliente)
    [HttpGet("by-email")]
    [AllowAnonymous]
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> GetBookingsByEmail([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email requerido" });

        var normalized = email.Trim().ToLowerInvariant();

        var bookings = await _repository.GetByEmailAsync(normalized);
        return Ok(bookings);
    }

    // GET: api/bookings/{id} (público - mismo criterio que cancel/reschedule: acceso
    // directo por Id vía link de email, sin exigir sesión)
    [HttpGet("{id}")]
    [AllowAnonymous]
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> GetBooking(int id)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value?.ToLowerInvariant();

        var booking = await _repository.GetByIdWithTimeSlotAsync(id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        // Solo se restringe si hay una sesión de Client autenticada y no coincide con
        // el dueño del turno (portal "Mis turnos"). Anónimo o Admin: acceso directo.
        if (role == "Client" && booking.CustomerEmailNormalized != email)
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
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> CancelBooking(int id)
    {
        var booking = await _repository.GetByIdWithTimeSlotAsync(id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "Este turno ya fue cancelado" });

        if (booking.TimeSlot.EndDateTime < DateTime.UtcNow)
            return BadRequest(new { success = false, message = "Este turno ya expiró y no puede cancelarse" });

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        booking.TimeSlot.IsAvailable = true;

        await _repository.SaveChangesAsync();

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
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> RescheduleBooking(int id, [FromBody] RescheduleRequest request)
    {
        await using var transaction = await _repository.BeginTransactionAsync();

        var booking = await _repository.GetByIdWithTimeSlotAsync(id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "No se puede reprogramar un turno cancelado" });

        if (booking.Status == BookingStatus.Confirmed)
            return BadRequest(new { success = false, message = "Los turnos confirmados deben reprogramarse por WhatsApp" });

        if (booking.TimeSlotId == request.NewTimeSlotId)
            return BadRequest(new { success = false, message = "Ya estás en ese horario" });

        // Reservar el nuevo slot (solo si está disponible)
        var updated = await _repository.TryClaimSlotAsync(request.NewTimeSlotId);

        if (updated == 0)
            return Conflict(new { success = false, message = "Ese horario ya no está disponible" });

        // Liberar el slot anterior
        await _repository.ReleaseSlotAsync(booking.TimeSlotId);

        booking.TimeSlotId = request.NewTimeSlotId;
        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();

        // Recargar para devolver la fecha actualizada
        await _repository.LoadTimeSlotAsync(booking);

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

        var deletedSlots = await _repository.DeleteExpiredSlotsAsync(now);

        return Ok(new { success = true, deletedTimeSlots = deletedSlots });
    }

    // PATCH: api/bookings/{id}/confirm (admin)
    [HttpPatch("{id}/confirm")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ConfirmBooking(int id)
    {
        var booking = await _repository.FindAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        booking.Status = BookingStatus.Confirmed;
        await _repository.SaveChangesAsync();
        await _notificationService.DispatchForBookingAsync(booking.Id, NotificationEventType.BookingConfirmed);

        return Ok(new { success = true, message = "Turno confirmado exitosamente" });
    }
}

// DTOs
public class RescheduleRequest
{
    [Range(1, int.MaxValue)]
    public int NewTimeSlotId { get; set; }
}

public class CreateBookingRequest
{
    [Range(1, int.MaxValue)]
    public int TimeSlotId { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string CustomerName { get; set; } = string.Empty;

    [Required, StringLength(30, MinimumLength = 6)]
    public string CustomerPhone { get; set; } = string.Empty;

    [StringLength(256)]
    public string? Email { get; set; }

    [Required, StringLength(200, MinimumLength = 1)]
    public string Subject { get; set; } = string.Empty;

    [StringLength(200)]
    public string? Service { get; set; }

    public int? ProfessionalId { get; set; }

    [StringLength(4000)]
    public string? CustomFieldsJson { get; set; }

    [StringLength(2000)]
    public string? Message { get; set; }
}
