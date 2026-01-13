using Microsoft.AspNetCore.Mvc;
using DetailingApi.Services;
using DetailingApi.Models;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CalendarController : ControllerBase
{
    private readonly GoogleCalendarService _calendarService;

    public CalendarController(GoogleCalendarService calendarService)
    {
        _calendarService = calendarService;
    }

    [HttpPost("turno")]
    public async Task<IActionResult> CrearTurno([FromBody] TurnoRequest turno)
    {
        try
        {
            var eventLink = await _calendarService.CrearTurnoAsync(turno);
            return Ok(new { success = true, eventLink });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, error = ex.Message });
        }
    }
}