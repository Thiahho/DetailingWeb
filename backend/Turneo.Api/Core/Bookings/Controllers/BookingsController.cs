using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Turneo.Api.Core.Notifications;
using Turneo.Api.Shared.Constants;

namespace Turneo.Api.Core.Bookings;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IBookingsRepository _repository;
    private readonly AuthService _authService;
    private readonly IConfiguration _configuration;
    private readonly IInsumosRepository _insumosRepository;
    private readonly IPlanLimitsService _planLimits;
    private readonly ISmartTagsRepository _smartTagsRepository;

    public BookingsController(IBookingsRepository repository, AuthService authService, IConfiguration configuration, IInsumosRepository insumosRepository, IPlanLimitsService planLimits, ISmartTagsRepository smartTagsRepository)
    {
        _repository = repository;
        _authService = authService;
        _configuration = configuration;
        _insumosRepository = insumosRepository;
        _planLimits = planLimits;
        _smartTagsRepository = smartTagsRepository;
    }

    // POST: api/bookings (público - para clientes)
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("public-booking")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Email) && !new EmailAddressAttribute().IsValid(request.Email))
            return BadRequest(new { success = false, message = "El email no es válido" });

        if (!request.AcceptedTerms)
            return BadRequest(new { success = false, message = "Debés aceptar los Términos y Condiciones para reservar un turno" });

        if (request.ProfessionalId.HasValue)
        {
            var professionalIsActive = await _repository.ProfessionalIsActiveAsync(request.ProfessionalId.Value);

            if (!professionalIsActive)
                return BadRequest(new { success = false, message = "El profesional seleccionado no está disponible" });
        }

        var bookingsThisMonth = await _repository.CountThisMonthAsync();
        if (!await _planLimits.IsWithinLimitAsync("MaxBookings", bookingsThisMonth))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new
            {
                success = false,
                message = "Este negocio alcanzó su límite de turnos de este mes. Contactalo directamente para coordinar."
            });
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
            Status = BookingStatus.Pending,
            TermsAcceptedAt = DateTime.UtcNow,
            TermsVersion = LegalTermsVersions.Customer
        };

        _repository.Add(booking);

        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingCreated));

        if (!string.IsNullOrWhiteSpace(request.SmartTagToken))
        {
            var smartTag = await _smartTagsRepository.FindActiveByTokenIgnoringTenantAsync(request.SmartTagToken);
            // Solo si el tag sigue activo y pertenece al MISMO tenant que la reserva —
            // descarta en silencio un token ajeno (no debe inflar métricas de otro
            // tenant) ni bloquea la reserva en ningún caso.
            if (smartTag is not null && smartTag.TenantId == booking.TenantId)
            {
                await _smartTagsRepository.RecordEventAsync(
                    smartTag.Id, smartTag.TenantId, smartTag.Action, SmartTagEventType.BookingCompleted);
            }
        }

        return Ok(new
        {
            success = true,
            message = "Turno agendado exitosamente",
            myBookingsLink = $"{_configuration["Notifications:MyBookingsBaseUrl"] ?? "https://turneo-barber.vercel.app/mis-turnos"}?accessToken={Uri.EscapeDataString(_authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized, booking.TenantId))}",
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
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.View)]
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
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingCancelled));

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
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingRescheduled));

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

    // POST: api/bookings/{id}/admin-reschedule (admin - drag&drop de la agenda, sin las
    // restricciones del reschedule público: un admin sí puede mover turnos Confirmed)
    [HttpPost("{id}/admin-reschedule")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> AdminRescheduleBooking(int id, [FromBody] RescheduleRequest request)
    {
        await using var transaction = await _repository.BeginTransactionAsync();

        var booking = await _repository.GetByIdWithTimeSlotAsync(id);

        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "No se puede reprogramar un turno cancelado" });

        if (booking.TimeSlotId == request.NewTimeSlotId)
            return BadRequest(new { success = false, message = "Ya estás en ese horario" });

        var updated = await _repository.TryClaimSlotAsync(request.NewTimeSlotId);

        if (updated == 0)
            return Conflict(new { success = false, message = "Ese horario ya no está disponible" });

        await _repository.ReleaseSlotAsync(booking.TimeSlotId);

        booking.TimeSlotId = request.NewTimeSlotId;
        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingRescheduled));

        await _repository.LoadTimeSlotAsync(booking);

        return Ok(new
        {
            success = true,
            message = "Turno reprogramado exitosamente",
            newStartDateTime = booking.TimeSlot.StartDateTime,
        });
    }

    // DELETE: api/bookings/expired (admin)
    [HttpDelete("expired")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteExpiredBookings()
    {
        var now = DateTime.UtcNow;

        var deletedSlots = await _repository.DeleteExpiredSlotsAsync(now);

        return Ok(new { success = true, deletedTimeSlots = deletedSlots });
    }

    // PATCH: api/bookings/{id}/confirm (admin, o el profesional dueño del turno)
    [HttpPatch("{id}/confirm")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> ConfirmBooking(int id)
    {
        var booking = await _repository.FindAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        // Un profesional solo puede confirmar turnos propios — RequirePermission
        // arriba no lo restringe (solo acota a Staff, ver su comentario), así que
        // la propiedad del turno se valida acá.
        if (User.IsInRole("Professional"))
        {
            var claim = User.FindFirst("professional_id")?.Value;
            if (!int.TryParse(claim, out var professionalId) || booking.ProfessionalId != professionalId)
                return Forbid();
        }

        booking.Status = BookingStatus.Confirmed;
        await _repository.SaveChangesAsync();
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingConfirmed));

        return Ok(new { success = true, message = "Turno confirmado exitosamente" });
    }

    // PUT: api/bookings/{id} (admin - datos base de la reserva: cliente, teléfono, detalle,
    // servicio, mensaje. No toca ProfessionalId: reasignar profesional se hace arrastrando
    // el turno en la agenda, así el TimeSlot.ProfessionalId no queda desincronizado.)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateBookingRequest request)
    {
        var booking = await _repository.FindAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        booking.CustomerName = request.CustomerName.Trim();
        booking.CustomerPhone = request.CustomerPhone.Trim();
        booking.Subject = request.Subject.Trim();
        booking.Service = request.Service?.Trim();
        booking.Message = string.IsNullOrWhiteSpace(request.Message) ? null : request.Message.Trim();

        await _repository.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Reserva actualizada correctamente",
            booking = new
            {
                customerName = booking.CustomerName,
                customerPhone = booking.CustomerPhone,
                subject = booking.Subject,
                service = booking.Service,
                message = booking.Message,
            },
        });
    }

    // PUT: api/bookings/{id}/detail (admin - productos/servicios usados + fotos antes/después.
    // Reemplaza la lista de items completa en cada guardado, más simple que CRUD granular
    // por item y coherente con el flujo de UI de "guardar detalle" de una sola vez.)
    [HttpPut("{id}/detail")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> UpdateBookingDetail(int id, [FromBody] UpdateBookingDetailRequest request)
    {
        var booking = await _repository.GetByIdWithItemsAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        booking.PhotoUrlsBefore = request.PhotoUrlsBefore;
        booking.PhotoUrlsAfter = request.PhotoUrlsAfter;

        // Reconciliar stock de insumos por delta (cantidad nueva - cantidad vieja) antes de
        // reemplazar los items, así el ajuste es idempotente ante altas/ediciones/bajas repetidas
        // sobre el mismo turno.
        var oldInsumoQty = booking.Items
            .Where(i => i.ItemType == BookingItemType.Insumo && i.InsumoId.HasValue)
            .GroupBy(i => i.InsumoId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

        var newInsumoQty = request.Items
            .Where(i => i.ItemType == BookingItemType.Insumo && i.InsumoId.HasValue)
            .GroupBy(i => i.InsumoId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

        var affectedInsumoIds = oldInsumoQty.Keys.Union(newInsumoQty.Keys).ToList();
        if (affectedInsumoIds.Count > 0)
        {
            var insumos = await _insumosRepository.FindManyAsync(affectedInsumoIds);
            foreach (var insumo in insumos)
            {
                var oldQty = oldInsumoQty.GetValueOrDefault(insumo.Id);
                var newQty = newInsumoQty.GetValueOrDefault(insumo.Id);
                insumo.Stock -= newQty - oldQty;
                insumo.UpdatedAt = DateTime.UtcNow;
            }
        }

        _repository.RemoveItemRange(booking.Items);
        var newItems = request.Items.Select(i => new BookingItem
        {
            BookingId = booking.Id,
            ItemType = i.ItemType,
            ServiceId = i.ItemType == BookingItemType.Service ? i.ServiceId : null,
            ProductId = i.ItemType == BookingItemType.Product ? i.ProductId : null,
            InsumoId = i.ItemType == BookingItemType.Insumo ? i.InsumoId : null,
            IsSale = i.ItemType == BookingItemType.Insumo && i.IsSale,
            Name = i.Name,
            Quantity = i.Quantity,
            // El insumo es costo interno salvo que se marque como venta (IsSale): ahí sí se
            // cobra al cliente. Servicios/productos siempre respetan el precio enviado.
            UnitPrice = i.ItemType == BookingItemType.Insumo && !i.IsSale ? 0 : i.UnitPrice,
        }).ToList();
        _repository.AddItemRange(newItems);

        await _repository.SaveChangesAsync();

        return Ok(new { success = true, message = "Detalle del turno actualizado correctamente" });
    }
}

// DTOs
public class RescheduleRequest
{
    [Range(1, int.MaxValue)]
    public int NewTimeSlotId { get; set; }
}

public class UpdateBookingRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string CustomerName { get; set; } = string.Empty;

    [Required, StringLength(30, MinimumLength = 6)]
    public string CustomerPhone { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string Subject { get; set; } = string.Empty;

    [StringLength(200)]
    public string? Service { get; set; }

    [StringLength(2000)]
    public string? Message { get; set; }
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

    // Sin [Required]: el campo es opcional en ambos formularios del cliente
    // (BookingForms.tsx y ReserveSlotModal.tsx lo marcan "(opcional)" en la UI).
    [StringLength(200)]
    public string Subject { get; set; } = string.Empty;

    [StringLength(200)]
    public string? Service { get; set; }

    public int? ProfessionalId { get; set; }

    [StringLength(4000)]
    public string? CustomFieldsJson { get; set; }

    [StringLength(2000)]
    public string? Message { get; set; }

    // Presente cuando la reserva se originó en un Smart Tag (docs/NFC.md) —
    // se usa solo para registrar el evento BOOKING_COMPLETED, nunca para
    // resolver el tenant de la reserva en sí.
    [StringLength(16)]
    public string? SmartTagToken { get; set; }

    // Sin [Required]: en un bool no-nullable, RequiredAttribute solo rechaza
    // null, nunca false (el default del tipo) — la validación real de que
    // sea explícitamente true se hace a mano en CreateBooking.
    public bool AcceptedTerms { get; set; }
}

public class UpdateBookingDetailRequest
{
    [StringLength(4000)]
    public string? PhotoUrlsBefore { get; set; }

    [StringLength(4000)]
    public string? PhotoUrlsAfter { get; set; }

    public List<BookingItemRequest> Items { get; set; } = new();
}

public class BookingItemRequest
{
    [Required, RegularExpression("^(Service|Product|Insumo)$")]
    public string ItemType { get; set; } = string.Empty;

    public int? ServiceId { get; set; }
    public int? ProductId { get; set; }
    public int? InsumoId { get; set; }

    // Solo aplica a ItemType=Insumo: true = venta al cliente (se cobra), false = uso interno (costo, gratis).
    public bool IsSale { get; set; } = false;

    [Required, StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 999)]
    public int Quantity { get; set; } = 1;

    [Range(0, 9_999_999)]
    public decimal UnitPrice { get; set; }
}
