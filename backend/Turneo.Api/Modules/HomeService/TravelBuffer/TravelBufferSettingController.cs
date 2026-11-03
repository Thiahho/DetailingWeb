using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.HomeService.TravelBuffer;

// Admin read/write of only BusinessSettings.HomeServiceTravelBufferMinutes.
// Unlike PUT api/businesssettings it never regenerates the time slots: the
// buffer is applied when slots are listed and booked (HomeServiceTravelBuffer).
// The settings row is tenant-scoped by the query filter and read the same way
// HomeServiceTravelBuffer reads it (first row by id).
[ApiController]
[Route("api/home-service/travel-buffer")]
[Authorize(Roles = "Admin")]
public class TravelBufferSettingController : ControllerBase
{
    public const string InvalidMinutesMessage = "El tiempo de traslado entre turnos a domicilio debe estar entre 0 y 240 minutos";
    public const string NoSettingsMessage = "Configurá primero los horarios de la agenda para poder guardar el tiempo de traslado";

    private readonly ApplicationDbContext _context;

    public TravelBufferSettingController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/home-service/travel-buffer
    // Without a settings row the slot rules use the default, so that is what is shown.
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var minutes = await _context.BusinessSettings
            .AsNoTracking()
            .OrderBy(s => s.Id)
            .Select(s => (int?)s.HomeServiceTravelBufferMinutes)
            .FirstOrDefaultAsync();
        return Ok(new TravelBufferResponse(minutes ?? BusinessSettings.DefaultHomeServiceTravelBufferMinutes));
    }

    // PUT: api/home-service/travel-buffer
    // Settings rows are only created by PUT api/businesssettings with the full
    // agenda (days, hours, slot length); there is no default factory, so without
    // a row this endpoint asks the admin to configure the agenda first.
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] TravelBufferRequest request)
    {
        if (request.Minutes is not int minutes || minutes < 0 || minutes > BusinessSettings.MaxHomeServiceTravelBufferMinutes)
            return BadRequest(new { message = InvalidMinutesMessage });

        var settings = await _context.BusinessSettings.OrderBy(s => s.Id).FirstOrDefaultAsync();
        if (settings == null)
            return Conflict(new { message = NoSettingsMessage });

        settings.HomeServiceTravelBufferMinutes = minutes;
        settings.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new TravelBufferResponse(minutes));
    }
}

public class TravelBufferRequest
{
    // Nullable so a missing value is a 400 instead of silently meaning 0.
    public int? Minutes { get; set; }
}

public record TravelBufferResponse(int Minutes);
