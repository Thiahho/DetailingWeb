using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Turneo.Api.Core.Notifications;
using Turneo.Api.Modules.HomeService.BookingAddress;
using Turneo.Api.Modules.HomeService.TravelBuffer;
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
    private readonly ICurrentTenant _currentTenant;

    private readonly IPromotionPricingService _promotionPricing;
    private readonly IHomeServiceBookingPolicy _homeServicePolicy;
    private readonly ICajaRepository _cajaRepository;
    private readonly IHomeServiceTravelBuffer _travelBuffer;

    public BookingsController(IBookingsRepository repository, AuthService authService, IConfiguration configuration, IInsumosRepository insumosRepository, IPlanLimitsService planLimits, ISmartTagsRepository smartTagsRepository, ICurrentTenant currentTenant, IPromotionPricingService promotionPricing, IHomeServiceBookingPolicy homeServicePolicy, ICajaRepository cajaRepository, IHomeServiceTravelBuffer travelBuffer)
    {
        _cajaRepository = cajaRepository;
        _travelBuffer = travelBuffer;
        _promotionPricing = promotionPricing;
        _homeServicePolicy = homeServicePolicy;
        _repository = repository;
        _authService = authService;
        _configuration = configuration;
        _insumosRepository = insumosRepository;
        _planLimits = planLimits;
        _smartTagsRepository = smartTagsRepository;
        _currentTenant = currentTenant;
    }

    // Etiqueta a la que se atribuye una reserva pública: solo si el token
    // corresponde a un tag activo del MISMO tenant de la reserva. Un token
    // inexistente, inactivo o ajeno se descarta en silencio (no debe inflar
    // métricas de otro tenant) y nunca bloquea la reserva.
    private async Task<SmartTag?> ResolveAttributedSmartTagAsync(string? smartTagToken)
    {
        if (string.IsNullOrWhiteSpace(smartTagToken))
            return null;

        var smartTag = await _smartTagsRepository.FindActiveByTokenIgnoringTenantAsync(smartTagToken);
        return smartTag is not null && smartTag.TenantId == _currentTenant.TenantId ? smartTag : null;
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

        // At-home services need an address inside the tenant's coverage zone.
        // Checked before claiming the slot so a rejected booking never holds it.
        var homeService = await _homeServicePolicy.ResolveAsync(request.Service, request.HomeAddress);
        if (homeService.Error is not null)
            return BadRequest(new { success = false, message = homeService.Error });

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

        // At-home bookings keep the travel buffer with the professional's other
        // at-home bookings. Returning before the commit rolls the claim back.
        if (homeService.Snapshot is not null
            && await _travelBuffer.IsSlotInsideBufferAsync(request.TimeSlotId, professionalId))
            return TravelBufferConflict();

        // Se resuelve antes de guardar para que la atribución quede en la misma
        // fila y en la misma transacción que la reserva. El canal solo cuenta
        // si hay etiqueta válida: un src suelto no atribuye nada.
        var smartTag = await ResolveAttributedSmartTagAsync(request.SmartTagToken);
        var smartTagSource = smartTag is null ? null : SmartTagSource.Normalize(request.SmartTagSource);

        var promotion = professionalId.HasValue
            ? await _promotionPricing.QuoteBySlugAsync(professionalId.Value, request.Service, DateTime.UtcNow)
            : null;

        var booking = new Booking
        {
            PromotionId = promotion?.PromotionId,
            DiscountAmount = promotion?.DiscountAmount,
            FinalPrice = promotion?.FinalPrice,
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
            TermsVersion = LegalTermsVersions.Customer,
            SmartTagId = smartTag?.Id,
            Source = smartTagSource
        };
        homeService.Snapshot?.ApplyTo(booking);

        _repository.Add(booking);

        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingCreated, null));

        if (smartTag is not null)
        {
            await _smartTagsRepository.RecordEventAsync(
                smartTag.Id, smartTag.TenantId, smartTag.Action, SmartTagEventType.BookingCompleted, smartTagSource);
        }

        return Ok(new
        {
            success = true,
            message = "Turno agendado exitosamente",
            myBookingsLink = $"{_configuration["Notifications:MyBookingsBaseUrl"] ?? "https://www.turneobelleza.com/mis-turnos"}?accessToken={Uri.EscapeDataString(_authService.CreateClientPortalAccessToken(booking.CustomerEmailNormalized, booking.TenantId))}",
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
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.View, alsoCheckProfessional: true)]
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

        // TimeSlot.EndDateTime está en hora de Argentina (ver ArgentinaClock), no UTC —
        // compararlo contra DateTime.UtcNow marcaba turnos de hoy como "expirados" hasta
        // 3 horas antes de que terminaran de verdad.
        if (booking.TimeSlot.EndDateTime < ArgentinaClock.Now())
            return BadRequest(new { success = false, message = "Este turno ya expiró y no puede cancelarse" });

        // Paid bookings are cancelled by the Admin, who also registers the refund
        // (see AdminCancelRefund); the client is pointed to WhatsApp instead.
        if (await _repository.HasApprovedPaymentAsync(booking.Id))
            return BadRequest(new { success = false, message = "Esta reserva ya está pagada. Escribinos por WhatsApp para cancelarla" });

        MarkCancelled(booking);

        await _repository.SaveChangesAsync();
        EnqueueCancelledNotification(booking.Id);

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

    // POST: api/bookings/{id}/admin-cancel-refund (admin - cancel a paid booking and
    // register its refund). One transaction: booking cancelled (same side effects as
    // the public cancel), payment marked Refunded and a Caja "Refund" movement in the
    // open session. Mercado Pago is not called: the money is returned by hand.
    [HttpPost("{id}/admin-cancel-refund")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminCancelRefund(int id, [FromBody] AdminCancelRefundRequest request)
    {
        await using var transaction = await _repository.BeginTransactionAsync();

        var booking = await _repository.GetByIdWithTimeSlotAndPaymentAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        var payment = booking.Payment;
        if (payment?.Status == PaymentStatus.Refunded)
            return BadRequest(new { success = false, message = "El pago de esta reserva ya fue devuelto" });

        if (payment?.Status != PaymentStatus.Approved)
            return BadRequest(new { success = false, message = "Esta reserva no tiene un pago aprobado para devolver" });

        if (booking.Status == BookingStatus.Cancelled)
            return BadRequest(new { success = false, message = "Este turno ya fue cancelado" });

        var amount = request.Amount ?? payment.Amount;
        if (amount <= 0 || amount > payment.Amount)
            return BadRequest(new { success = false, message = "El monto a devolver debe ser mayor a cero y no puede superar el pago" });

        // Same rule as POST api/caja/movements: every Caja movement belongs to the
        // open session, so the refund cannot be registered while the caja is closed.
        var session = await _cajaRepository.GetOpenSessionAsync();
        if (session == null)
            return BadRequest(new { success = false, message = "No hay ninguna caja abierta" });

        // First write, guarded at the database: only one concurrent request can move
        // the payment from Approved to Refunded, so a double submit cannot register
        // two refunds. Runs inside the transaction, so a later failure rolls it back.
        // The tracked `payment` is left untouched so SaveChanges never rewrites the row.
        var refundedAt = DateTime.UtcNow;
        if (!await _repository.TryMarkPaymentRefundedAsync(payment.Id, refundedAt))
        {
            await transaction.RollbackAsync();
            return BadRequest(new { success = false, message = "El pago de esta reserva ya fue devuelto" });
        }

        MarkCancelled(booking);

        // The original Mercado Pago payment has no Caja movement, so the refund is
        // linked by BookingId only (RefundOfMovementId stays null).
        var movement = new CajaMovement
        {
            CajaSessionId = session.Id,
            Type = CajaMovementType.Refund,
            Method = request.Method,
            Amount = amount,
            BookingId = booking.Id,
            Description = string.IsNullOrWhiteSpace(request.Note)
                ? $"Devolución por cancelación de la reserva #{booking.Id}"
                : request.Note.Trim(),
            CreatedByUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value)
        };
        _cajaRepository.AddMovement(movement);

        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();
        EnqueueCancelledNotification(booking.Id);

        return Ok(new
        {
            success = true,
            message = "Turno cancelado y devolución registrada",
            booking = new { id = booking.Id, status = booking.Status, cancelledAt = booking.CancelledAt },
            payment = new { id = payment.Id, status = PaymentStatus.Refunded, amount = payment.Amount, refundedAt },
            refund = new { cajaMovementId = movement.Id, amount = movement.Amount, method = movement.Method, description = movement.Description }
        });
    }

    // 409 like the other "slot not available" answers; the client picks another time.
    private ConflictObjectResult TravelBufferConflict() =>
        Conflict(new { success = false, message = HomeServiceTravelBuffer.InsideBufferMessage });

    // Reschedule of an at-home booking (HomeServiceSurcharge is set only on those):
    // the new slot must keep the travel buffer with the professional's other
    // at-home bookings. The booking itself is left out of the check.
    private async Task<bool> MovesIntoTravelBufferAsync(Booking booking, int newTimeSlotId) =>
        booking.HomeServiceSurcharge is not null
        && await _travelBuffer.IsSlotInsideBufferAsync(newTimeSlotId, booking.ProfessionalId, booking.Id);

    // Shared by every cancel path: status, timestamp and freeing the slot.
    private static void MarkCancelled(Booking booking)
    {
        booking.Status = BookingStatus.Cancelled;
        booking.CancelledAt = DateTime.UtcNow;
        booking.TimeSlot.IsAvailable = true;
    }

    private static void EnqueueCancelledNotification(int bookingId) =>
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(bookingId, NotificationEventType.BookingCancelled, null));

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

        if (await MovesIntoTravelBufferAsync(booking, request.NewTimeSlotId))
            return TravelBufferConflict();

        // Antes de pisar el TimeSlotId — es lo único que le queda al job de background
        // para poder avisar "de tal hora a tal hora" (ver NotificationService).
        var previousStartDateTime = booking.TimeSlot.StartDateTime;

        // Liberar el slot anterior
        await _repository.ReleaseSlotAsync(booking.TimeSlotId);

        booking.TimeSlotId = request.NewTimeSlotId;
        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingRescheduled, previousStartDateTime));

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
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit, alsoCheckProfessional: true)]
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

        if (await MovesIntoTravelBufferAsync(booking, request.NewTimeSlotId))
            return TravelBufferConflict();

        var previousStartDateTime = booking.TimeSlot.StartDateTime;

        await _repository.ReleaseSlotAsync(booking.TimeSlotId);

        booking.TimeSlotId = request.NewTimeSlotId;
        await _repository.SaveChangesAsync();
        await transaction.CommitAsync();
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingRescheduled, previousStartDateTime));

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
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> DeleteExpiredBookings()
    {
        var now = DateTime.UtcNow;

        var deletedSlots = await _repository.DeleteExpiredSlotsAsync(now);

        return Ok(new { success = true, deletedTimeSlots = deletedSlots });
    }

    // PATCH: api/bookings/{id}/confirm (admin, o el profesional dueño del turno)
    [HttpPatch("{id}/confirm")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit, alsoCheckProfessional: true)]
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
        BackgroundJob.Enqueue<BookingNotificationJob>(job => job.DispatchAsync(booking.Id, NotificationEventType.BookingConfirmed, null));

        return Ok(new { success = true, message = "Turno confirmado exitosamente" });
    }

    // PUT: api/bookings/{id} (admin - datos base de la reserva: cliente, teléfono, detalle,
    // servicio, mensaje. No toca ProfessionalId: reasignar profesional se hace arrastrando
    // el turno en la agenda, así el TimeSlot.ProfessionalId no queda desincronizado.)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateBookingRequest request)
    {
        var booking = await _repository.FindAsync(id);
        if (booking == null)
            return NotFound(new { success = false, message = "Reserva no encontrada" });

        // A confirmed or paid booking is locked: reject before the home-service
        // policy runs or any field is assigned, so a rejected edit changes nothing.
        if (booking.Status == BookingStatus.Confirmed || await _repository.HasApprovedPaymentAsync(booking.Id))
            return BadRequest(new { success = false, message = "No se puede editar una reserva confirmada o pagada" });

        // Re-run the home-service policy against the resulting service so the
        // address/surcharge snapshot matches its location type. Validated before
        // any field is touched: a rejected edit changes nothing.
        var service = request.Service?.Trim();
        var homeService = await _homeServicePolicy.ResolveForUpdateAsync(service, request.HomeAddress, booking);
        if (homeService.Error is not null)
            return BadRequest(new { success = false, message = homeService.Error });

        // An on-site booking that becomes at-home must respect the travel buffer
        // at its current time. Bookings that already were at-home keep their time.
        if (homeService.Snapshot is not null
            && booking.HomeServiceSurcharge is null
            && await _travelBuffer.IsSlotInsideBufferAsync(booking.TimeSlotId, booking.ProfessionalId, booking.Id))
            return TravelBufferConflict();

        booking.CustomerName = request.CustomerName.Trim();
        booking.CustomerPhone = request.CustomerPhone.Trim();
        booking.Subject = request.Subject.Trim();
        booking.Service = service;
        booking.Message = string.IsNullOrWhiteSpace(request.Message) ? null : request.Message.Trim();
        homeService.ApplyTo(booking);

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
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit, alsoCheckProfessional: true)]
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
public class AdminCancelRefundRequest
{
    // Optional: defaults to the full payment amount. Upper bound (the payment
    // amount) is checked in the action.
    [Range(0.01, 9_999_999)]
    public decimal? Amount { get; set; }

    // Same values as Caja movements (CajaMovementMethod).
    [Required, RegularExpression("^(Cash|Transfer)$")]
    public string Method { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Note { get; set; }
}

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

    // Same shape as on create. Required when the resulting service is AtHome
    // and the booking has no address yet; omitted on an AtHome booking that
    // already has one, the stored address and surcharge are kept unchanged.
    public HomeServiceAddressRequest? HomeAddress { get; set; }
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

    // Presente cuando la reserva se originó en un Smart Tag (docs/NFC.md) —
    // se usa solo para registrar el evento BOOKING_COMPLETED, nunca para
    // resolver el tenant de la reserva en sí.
    [StringLength(16)]
    public string? SmartTagToken { get; set; }

    // Canal por el que se abrió ese Smart Tag ("nfc" | "qr"). Sin validación
    // de formato a propósito: un valor desconocido se guarda como null en vez
    // de rechazar la reserva (ver SmartTagSource.Normalize).
    public string? SmartTagSource { get; set; }

    // Sin [Required]: en un bool no-nullable, RequiredAttribute solo rechaza
    // null, nunca false (el default del tipo) — la validación real de que
    // sea explícitamente true se hace a mano en CreateBooking.
    public bool AcceptedTerms { get; set; }

    // Required only when the booked service is AtHome; ignored otherwise.
    public HomeServiceAddressRequest? HomeAddress { get; set; }
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
