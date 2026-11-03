using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Settings;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class BusinessSettingsController : ControllerBase
{
    private readonly IBusinessSettingsRepository _repository;
    private readonly TimeSlotGeneratorService _generator;

    public BusinessSettingsController(IBusinessSettingsRepository repository, TimeSlotGeneratorService generator)
    {
        _repository = repository;
        _generator = generator;
    }

    // GET: api/businesssettings
    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        var settings = await _repository.GetAsync();
        
        if (settings == null)
        {
            return NotFound(new { message = "No hay configuración. Creá una primero." });
        }

        return Ok(new
        {
            id = settings.Id,
            daysOfWeek = settings.DaysOfWeek,
            startTime = settings.StartTime.ToString(@"hh\:mm"),
            // endTime = settings.EndTime.ToString(@"hh\:mm"),
            slotDuration = settings.SlotDuration,
            breakBetweenSlots = settings.BreakBetweenSlots,
            maxDaysInAdvance = settings.MaxDaysInAdvance,
            homeServiceTravelBufferMinutes = settings.HomeServiceTravelBufferMinutes
        });
    }

    // PUT: api/businesssettings
    [HttpPut]
    public async Task<IActionResult> UpdateSettings([FromBody] BusinessSettingsRequest request)
    {
        if (request.HomeServiceTravelBufferMinutes is < 0 or > BusinessSettings.MaxHomeServiceTravelBufferMinutes)
        {
            return BadRequest(new { message = $"El tiempo de traslado entre turnos a domicilio debe estar entre 0 y {BusinessSettings.MaxHomeServiceTravelBufferMinutes} minutos" });
        }

        var settings = await _repository.GetAsync();

        if (settings == null)
        {
            // Crear nueva configuración
            settings = new BusinessSettings
            {
                DaysOfWeek = request.DaysOfWeek,
                StartTime = TimeSpan.Parse(request.StartTime),
                // EndTime = TimeSpan.Parse(request.EndTime),
                SlotDuration = request.SlotDuration,
                BreakBetweenSlots = request.BreakBetweenSlots,
                MaxDaysInAdvance = request.MaxDaysInAdvance,
                HomeServiceTravelBufferMinutes = request.HomeServiceTravelBufferMinutes ?? BusinessSettings.DefaultHomeServiceTravelBufferMinutes
            };
            _repository.Add(settings);
        }
        else
        {
            // Actualizar existente
            settings.DaysOfWeek = request.DaysOfWeek;
            settings.StartTime = TimeSpan.Parse(request.StartTime);
            // settings.EndTime = TimeSpan.Parse(request.EndTime);
            settings.SlotDuration = request.SlotDuration;
            settings.BreakBetweenSlots = request.BreakBetweenSlots;
            settings.MaxDaysInAdvance = request.MaxDaysInAdvance;
            if (request.HomeServiceTravelBufferMinutes is int bufferMinutes)
                settings.HomeServiceTravelBufferMinutes = bufferMinutes;
            settings.UpdatedAt = DateTime.UtcNow;
        }

        await _repository.SaveChangesAsync();

        // Regenerar todos los turnos
        await _generator.RegenerateAllSlotsAsync();

        return Ok(new { message = "Configuración guardada y turnos regenerados" });
    }
}

// DTO para el request
public class BusinessSettingsRequest
{
    public int[] DaysOfWeek { get; set; } = Array.Empty<int>();
    public string StartTime { get; set; } = "09:00";
    // public string EndTime { get; set; } = "19:00";
    public int SlotDuration { get; set; }
    public int BreakBetweenSlots { get; set; }
    public int MaxDaysInAdvance { get; set; }
    // Optional so older clients that do not send it keep the stored value.
    public int? HomeServiceTravelBufferMinutes { get; set; }
}