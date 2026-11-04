using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace Turneo.Api.Core.Scheduling;

[ApiController]
[Route("api/[controller]")]
public class TimeSlotsController : ControllerBase
{
    private readonly ITimeSlotsRepository _repository;
    private readonly IBookingAvailability _availability;

    public const string OccupiedByOverlapMessage = "Este horario está ocupado por otro turno que se superpone. Liberá ese turno para habilitarlo.";
    private static readonly TimeZoneInfo _argentinaZone =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    public TimeSlotsController(ITimeSlotsRepository repository, IBookingAvailability availability)
    {
        _repository = repository;
        _availability = availability;
    }

    private static DateTime NowArgentina() =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _argentinaZone);

    // Id del profesional logueado (null si es Admin o no está presente el claim).
    // Nunca se confía en un professionalId mandado por el cliente para operaciones propias.
    private int? CallerProfessionalId()
    {
        var claim = User.FindFirst("professional_id")?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    // GET: api/timeslots/available (público - para clientes)
    // serviceSlug (optional): only start slots where a booking of that service
    // fits are listed (same rule as booking creation, see AgendaSnapshot): its
    // range [start, start + duration) must overlap no active booking of the
    // professional, be covered by the open agenda and, for an at-home service,
    // keep the travel buffer. Without serviceSlug the range is the slot itself.
    // Unknown slug: 400. bookingEndDateTime = end of the range a booking of the
    // requested service would occupy (startDateTime/endDateTime stay the slot's).
    [HttpGet("available")]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetAvailableSlots([FromQuery] int? professionalId, [FromQuery] string? serviceSlug)
    {
        var service = await _availability.GetServiceProfileAsync(serviceSlug);
        if (!service.Found)
            return BadRequest(new { message = "El servicio seleccionado no existe" });

        var slots = await _repository.GetAvailableAsync(professionalId, NowArgentina());
        var bookable = await _availability.FilterBookableStartsAsync(slots, service, professionalId);

        return Ok(bookable.Select(b => new
        {
            id = b.Slot.Id,
            startDateTime = b.Slot.StartDateTime,
            endDateTime = b.Slot.EndDateTime,
            bookingEndDateTime = b.BookingEnd,
            label = b.Slot.StartDateTime.ToString("ddd dd/MMM · HH:mm", new System.Globalization.CultureInfo("es-AR")),
            professionalId = b.Slot.ProfessionalId,
            professionalName = b.Slot.Professional != null
                ? b.Slot.Professional.FirstName + " " + b.Slot.Professional.LastName
                : null,
            serviceId = b.Slot.ServiceId,
            serviceTitle = b.Slot.Service?.Title,
            serviceSlug = b.Slot.Service?.Slug
        }));
    }

    // GET: api/timeslots/mine (profesional - solo su propia agenda)
    // occupiedByBookingId: the active booking that occupies the slot, its own or
    // one whose real range overlaps it (null when free).
    [HttpGet("mine")]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> GetMySlots()
    {
        var professionalId = CallerProfessionalId();
        if (professionalId == null)
            return Unauthorized(new { message = "Sesión inválida" });

        var slots = await _repository.GetMineAsync(professionalId.Value);
        var occupiedBy = await _availability.GetOccupyingBookingIdsAsync(slots);

        return Ok(slots.Select(s => new
        {
            id = s.Id,
            startDateTime = s.StartDateTime,
            endDateTime = s.EndDateTime,
            isAvailable = s.IsAvailable,
            occupiedByBookingId = occupiedBy.TryGetValue(s.Id, out var bookingId) ? bookingId : (int?)null,
            label = s.StartDateTime.ToString("ddd dd/MM/yyyy · HH:mm", new System.Globalization.CultureInfo("es-AR")),
            booking = s.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled)
                .Select(b => new
                {
                    id = b.Id,
                    customerName = b.CustomerName,
                    customerPhone = b.CustomerPhone,
                    subject = b.Subject,
                    service = b.Service,
                    message = b.Message,
                    status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status
                }).FirstOrDefault()
        }));
    }

    // GET: api/timeslots (admin - todos los turnos con info de reserva; un profesional
    // con el módulo Turnos otorgado desde Permisos también puede verlos todos, no solo
    // los suyos — mismo criterio que un Staff con ese permiso)
    [HttpGet]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.View, alsoCheckProfessional: true)]
    // from / to (optional, yyyy-MM-dd): inclusive days in Argentina time, the same
    // wall clock StartDateTime is stored in. Absent = open-ended on that side
    // (both absent = every slot, as before).
    public async Task<IActionResult> GetAllSlots([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date)
        {
            return BadRequest(new { message = "La fecha \"desde\" no puede ser posterior a \"hasta\"" });
        }

        var slots = await _repository.GetAllWithBookingsAsync(
            from?.Date,
            to?.Date.AddDays(1));
        // The active booking that occupies each slot: its own, or one whose real
        // range overlaps it (a long service started in an earlier slot).
        var occupiedBy = await _availability.GetOccupyingBookingIdsAsync(slots);

        return Ok(slots.Select(s => new
        {
            id = s.Id,
            startDateTime = s.StartDateTime,
            endDateTime = s.EndDateTime,
            isAvailable = s.IsAvailable,
            isBlocked = s.IsBlocked,
            occupiedByBookingId = occupiedBy.TryGetValue(s.Id, out var bookingId) ? bookingId : (int?)null,
            bookingsCount = s.Bookings.Count,
            label = s.StartDateTime.ToString("ddd dd/MM/yyyy · HH:mm", new System.Globalization.CultureInfo("es-AR")),
            professionalId = s.ProfessionalId,
            professionalName = s.Professional != null
                ? s.Professional.FirstName + " " + s.Professional.LastName
                : null,
            serviceId = s.ServiceId,
            serviceTitle = s.Service?.Title,
            serviceSlug = s.Service?.Slug,
            // Info de la reserva si existe
            booking = s.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled)
                .Select(b => new
                {
                    id = b.Id,
                    customerName = b.CustomerName,
                    customerPhone = b.CustomerPhone,
                    email = b.Email,
                    subject = b.Subject,
                    customFieldsJson = b.CustomFieldsJson,
                    service = b.Service,
                    professionalId = b.ProfessionalId,
                    professionalName = b.Professional != null
                        ? b.Professional.FirstName + " " + b.Professional.LastName
                        : null,
                    message = b.Message,
                    status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status,
                    // Payment of the booking (authenticated admin agenda only; loaded in the same query).
                    paymentStatus = b.Payment != null ? b.Payment.Status : null,
                    paymentAmount = b.Payment != null ? (decimal?)b.Payment.Amount : null,
                    paymentPaidAt = b.Payment != null ? b.Payment.PaidAt : null,
                    paymentProvider = b.Payment != null ? b.Payment.Provider : null
                }).FirstOrDefault()
        }));
    }

    // POST: api/timeslots (admin crea para cualquiera; profesional solo para sí mismo)
    [HttpPost]
    [Authorize(Roles = "Admin,Professional,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Create)]
    public async Task<IActionResult> CreateSlot([FromBody] CreateTimeSlotRequest request)
    {
        if (request.StartDateTime <= NowArgentina())
        {
            return BadRequest(new { message = "La fecha debe ser futura" });
        }

        if (request.EndDateTime <= request.StartDateTime)
        {
            return BadRequest(new { message = "La hora de fin debe ser posterior al inicio" });
        }

        var callerProfessionalId = CallerProfessionalId();
        var professionalId = callerProfessionalId ?? request.ProfessionalId;

        if (professionalId == null)
        {
            // Negocio unipersonal (sin ningún Professional activo cargado): el
            // turno queda sin asignar, mismo criterio que ya usa la generación
            // automática de disponibilidad (TimeSlotGeneratorService). Si el
            // negocio sí tiene equipo, seguimos exigiendo elegir a quién.
            var hasActiveProfessionals = await _repository.AnyActiveProfessionalExistsAsync();
            if (hasActiveProfessionals)
            {
                return BadRequest(new { message = "Elegí a qué profesional pertenece el turno" });
            }
        }
        else
        {
            var professionalIsActive = await _repository.ProfessionalIsActiveAsync(professionalId.Value);
            if (!professionalIsActive)
            {
                return BadRequest(new { message = "El profesional seleccionado no está disponible" });
            }
        }

        if (request.ServiceId.HasValue && !await _repository.ServiceExistsAsync(request.ServiceId.Value))
        {
            return BadRequest(new { message = "El servicio seleccionado no existe" });
        }

        var exists = await _repository.SlotExistsAsync(request.StartDateTime, professionalId);

        if (exists)
        {
            return BadRequest(new { message = "Ya existe un turno en este horario para ese profesional" });
        }

        var slot = new TimeSlot
        {
            StartDateTime = request.StartDateTime,
            EndDateTime = request.EndDateTime,
            IsAvailable = true,
            MaxBookings = 1,
            ProfessionalId = professionalId,
            ServiceId = request.ServiceId
        };

        _repository.Add(slot);
        await _repository.SaveChangesAsync();
        // A slot created inside an existing booking's range starts unavailable.
        await _availability.RefreshSlotAvailabilityAsync(BookingFootprint.OfSlot(slot));

        return Ok(new
        {
            success = true,
            message = "Turno creado exitosamente",
            slot = new
            {
                id = slot.Id,
                startDateTime = slot.StartDateTime,
                endDateTime = slot.EndDateTime,
                professionalId = slot.ProfessionalId,
                serviceId = slot.ServiceId
            }
        });
    }

    // PUT: api/timeslots/5 (admin, o el profesional dueño del turno)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Professional,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> UpdateSlot(int id, [FromBody] UpdateTimeSlotRequest request)
    {
        var slot = await _repository.GetByIdWithBookingsAsync(id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        var callerProfessionalId = CallerProfessionalId();
        if (callerProfessionalId != null && slot.ProfessionalId != callerProfessionalId)
        {
            return Forbid();
        }

        // No permitir editar si está reservado
        if (!slot.IsAvailable)
        {
            return BadRequest(new { message = "No se puede editar un turno reservado. Habilitalo primero." });
        }

        if (request.StartDateTime <= NowArgentina())
        {
            return BadRequest(new { message = "La fecha debe ser futura" });
        }

        var exists = await _repository.SlotExistsAsync(request.StartDateTime, slot.ProfessionalId, id);

        if (exists)
        {
            return BadRequest(new { message = "Ya existe otro turno en este horario para ese profesional" });
        }

        slot.StartDateTime = request.StartDateTime;
        slot.EndDateTime = request.StartDateTime.AddHours(2);

        await _repository.SaveChangesAsync();
        // At its new time the slot may fall inside an existing booking's range.
        await _availability.RefreshSlotAvailabilityAsync(BookingFootprint.OfSlot(slot));

        return Ok(new
        {
            success = true,
            message = "Turno actualizado exitosamente",
            slot = new
            {
                id = slot.Id,
                startDateTime = slot.StartDateTime,
                endDateTime = slot.EndDateTime
            }
        });
    }

    // PUT: api/timeslots/5/release (admin, o el profesional dueño del turno)
    [HttpPut("{id}/release")]
    [Authorize(Roles = "Admin,Professional,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> ReleaseSlot(int id)
    {
        var slot = await _repository.GetByIdWithBookingsAsync(id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        var callerProfessionalId = CallerProfessionalId();
        if (callerProfessionalId != null && slot.ProfessionalId != callerProfessionalId)
        {
            return Forbid();
        }

        // A paid booking is cancelled only via POST api/bookings/{id}/admin-cancel-refund,
        // which also records the refund. Checked before any change.
        if (await _repository.HasApprovedPaymentAsync(slot.Id))
        {
            return BadRequest(new
            {
                success = false,
                message = "Esta reserva está pagada. Usá \"Cancelar y devolver\" para cancelarla y registrar la devolución."
            });
        }

        // Confirmed → marcar como Cancelled; Pending → eliminar, salvo que tenga un
        // pago registrado: esa también se cancela, el pago nunca se borra.
        // Ya canceladas: se dejan como están (historial y CancelledAt original).
        var active = slot.Bookings.Where(b => b.Status != BookingStatus.Cancelled).ToList();

        // Without its own booking the slot is taken by a longer booking that
        // starts in another slot: that one is released from its own slot.
        if (active.Count == 0 && (await _availability.GetOccupyingBookingIdsAsync([slot])).Count > 0)
        {
            return Conflict(new { success = false, message = OccupiedByOverlapMessage });
        }

        var toDelete = active.Where(b => b.Status != BookingStatus.Confirmed && b.Payment == null).ToList();
        var toCancel = active.Where(b => b.Status == BookingStatus.Confirmed || b.Payment != null).ToList();
        // Taken before the bookings are removed: every slot they occupied is freed below.
        var footprints = active.Select(BookingFootprint.Of).Append(BookingFootprint.OfSlot(slot)).ToArray();

        _repository.RemoveBookings(toDelete);
        foreach (var booking in toCancel)
        {
            booking.Status = BookingStatus.Cancelled;
            booking.CancelledAt = DateTime.UtcNow;
        }

        await _repository.SaveChangesAsync();

        // Marcar como HABILITADOS el turno y los que ocupaba la reserva, salvo que
        // otra reserva activa los superponga.
        await _availability.RefreshSlotAvailabilityAsync(footprints);

        return Ok(new
        {
            success = true,
            message = "Turno habilitado exitosamente"
        });
    }

    // PUT: api/timeslots/5/disable (admin, o el profesional dueño del turno)
    // Saca de circulación un turno HABILITADO (sin reserva) sin borrarlo.
    [HttpPut("{id}/disable")]
    [Authorize(Roles = "Admin,Professional,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> DisableSlot(int id)
    {
        var slot = await _repository.GetByIdWithBookingsAsync(id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        var callerProfessionalId = CallerProfessionalId();
        if (callerProfessionalId != null && slot.ProfessionalId != callerProfessionalId)
        {
            return Forbid();
        }

        if (!slot.IsAvailable)
        {
            return BadRequest(new { message = "No se puede deshabilitar un turno reservado. Liberalo primero." });
        }

        slot.IsBlocked = true;

        await _repository.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno deshabilitado exitosamente"
        });
    }

    // PUT: api/timeslots/5/enable (admin, o el profesional dueño del turno)
    [HttpPut("{id}/enable")]
    [Authorize(Roles = "Admin,Professional,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Edit)]
    public async Task<IActionResult> EnableSlot(int id)
    {
        var slot = await _repository.GetByIdWithBookingsAsync(id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        var callerProfessionalId = CallerProfessionalId();
        if (callerProfessionalId != null && slot.ProfessionalId != callerProfessionalId)
        {
            return Forbid();
        }

        slot.IsBlocked = false;

        await _repository.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno habilitado exitosamente"
        });
    }

    // DELETE: api/timeslots/5 (admin, o el profesional dueño del turno)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Professional,Staff")]
    [RequirePermission(PermissionModules.Turnos, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteSlot(int id)
    {
        var slot = await _repository.GetByIdWithBookingsAsync(id);

        if (slot == null)
        {
            return NotFound(new { message = "Turno no encontrado" });
        }

        var callerProfessionalId = CallerProfessionalId();
        if (callerProfessionalId != null && slot.ProfessionalId != callerProfessionalId)
        {
            return Forbid();
        }

        // No permitir eliminar si está reservado, salvo que ya haya expirado
        if (!slot.IsAvailable && slot.EndDateTime >= NowArgentina())
        {
            return BadRequest(new { message = "No se puede eliminar un turno reservado. Habilitalo primero." });
        }

        // Ninguna reserva (de ningún estado, cancelada incluida) se borra con su turno.
        if (slot.Bookings.Count > 0)
        {
            return BadRequest(new { message = "Este horario tiene reservas registradas y no se puede borrar" });
        }

        _repository.Remove(slot);
        await _repository.SaveChangesAsync();

        return Ok(new { success = true, message = "Turno eliminado" });
    }
}

// DTOs
public class CreateTimeSlotRequest
{
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public int? ProfessionalId { get; set; }
    public int? ServiceId { get; set; }
}
