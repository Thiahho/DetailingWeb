using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace TTurnos.Api.Core.Scheduling;

[ApiController]
[Route("api/[controller]")]
public class TimeSlotsController : ControllerBase
{
    private readonly ITimeSlotsRepository _repository;
    private static readonly TimeZoneInfo _argentinaZone =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    public TimeSlotsController(ITimeSlotsRepository repository)
    {
        _repository = repository;
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
    [HttpGet("available")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAvailableSlots([FromQuery] int? professionalId)
    {
        var slots = await _repository.GetAvailableAsync(professionalId, NowArgentina());

        return Ok(slots.Select(s => new
        {
            id = s.Id,
            startDateTime = s.StartDateTime,
            endDateTime = s.EndDateTime,
            label = s.StartDateTime.ToString("ddd dd/MMM · HH:mm", new System.Globalization.CultureInfo("es-AR")),
            professionalId = s.ProfessionalId,
            professionalName = s.Professional != null
                ? s.Professional.FirstName + " " + s.Professional.LastName
                : null
        }));
    }

    // GET: api/timeslots/mine (profesional - solo su propia agenda)
    [HttpGet("mine")]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> GetMySlots()
    {
        var professionalId = CallerProfessionalId();
        if (professionalId == null)
            return Unauthorized(new { message = "Sesión inválida" });

        var slots = await _repository.GetMineAsync(professionalId.Value);

        return Ok(slots.Select(s => new
        {
            id = s.Id,
            startDateTime = s.StartDateTime,
            endDateTime = s.EndDateTime,
            isAvailable = s.IsAvailable,
            label = s.StartDateTime.ToString("ddd dd/MM/yyyy · HH:mm", new System.Globalization.CultureInfo("es-AR")),
            booking = s.Bookings
                .Where(b => b.Status != BookingStatus.Cancelled)
                .Select(b => new
                {
                    id = b.Id,
                    customerName = b.CustomerName,
                    customerPhone = b.CustomerPhone,
                    service = b.Service,
                    status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status
                }).FirstOrDefault()
        }));
    }

    // GET: api/timeslots (admin - todos los turnos con info de reserva)
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllSlots()
    {
        var slots = await _repository.GetAllWithBookingsAsync();

        return Ok(slots.Select(s => new
        {
            id = s.Id,
            startDateTime = s.StartDateTime,
            endDateTime = s.EndDateTime,
            isAvailable = s.IsAvailable,
            bookingsCount = s.Bookings.Count,
            label = s.StartDateTime.ToString("ddd dd/MM/yyyy · HH:mm", new System.Globalization.CultureInfo("es-AR")),
            professionalId = s.ProfessionalId,
            professionalName = s.Professional != null
                ? s.Professional.FirstName + " " + s.Professional.LastName
                : null,
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
                    status = b.Status == BookingStatus.LegacyReserved ? BookingStatus.Pending : b.Status
                }).FirstOrDefault()
        }));
    }

    // POST: api/timeslots (admin crea para cualquiera; profesional solo para sí mismo)
    [HttpPost]
    [Authorize(Roles = "Admin,Professional")]
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
            return BadRequest(new { message = "Elegí a qué profesional pertenece el turno" });
        }

        var professionalIsActive = await _repository.ProfessionalIsActiveAsync(professionalId.Value);
        if (!professionalIsActive)
        {
            return BadRequest(new { message = "El profesional seleccionado no está disponible" });
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
            ProfessionalId = professionalId
        };

        _repository.Add(slot);
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno creado exitosamente",
            slot = new
            {
                id = slot.Id,
                startDateTime = slot.StartDateTime,
                endDateTime = slot.EndDateTime,
                professionalId = slot.ProfessionalId
            }
        });
    }

    // PUT: api/timeslots/5 (admin, o el profesional dueño del turno)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Professional")]
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
    [Authorize(Roles = "Admin,Professional")]
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

        // Confirmed → marcar como Cancelled; Pending → eliminar
        var toDelete = slot.Bookings.Where(b => b.Status != BookingStatus.Confirmed).ToList();
        var toCancel = slot.Bookings.Where(b => b.Status == BookingStatus.Confirmed).ToList();

        _repository.RemoveBookings(toDelete);
        foreach (var booking in toCancel)
        {
            booking.Status = BookingStatus.Cancelled;
            booking.CancelledAt = DateTime.UtcNow;
        }

        // Marcar turno como HABILITADO
        slot.IsAvailable = true;

        await _repository.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Turno habilitado exitosamente"
        });
    }

    // DELETE: api/timeslots/5 (admin, o el profesional dueño del turno)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Professional")]
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
        if (!slot.IsAvailable && slot.EndDateTime >= DateTime.UtcNow)
        {
            return BadRequest(new { message = "No se puede eliminar un turno reservado. Habilitalo primero." });
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
}
