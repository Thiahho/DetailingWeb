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

    [HttpGet("test-auth")]
    public async Task<IActionResult> TestAuthorization()
    {
        try
        {
            // Crear un turno de prueba para forzar la autorización
            var testTurno = new TurnoRequest
            {
                Name = "Test Authorization",
                Vehicle = "Test Vehicle",
                WhatsApp = "+54 9 11 0000 0000",
                DateTime = DateTime.Now.AddDays(1),
                Message = "Este es un turno de prueba para autorizar Google Calendar"
            };

            var eventLink = await _calendarService.CrearTurnoAsync(testTurno);
            return Ok(new
            {
                success = true,
                message = "Autorización exitosa! Token.json generado.",
                eventLink,
                note = "Ahora puedes crear turnos normalmente. Elimina este evento de prueba de tu calendario."
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                success = false,
                error = ex.Message,
                stackTrace = ex.StackTrace,
                tip = "Si el error es de autorización, asegúrate de que credentials.json esté en la raíz del proyecto y que el navegador pueda abrirse para autorizar."
            });
        }
    }
}