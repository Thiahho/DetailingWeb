using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TTurnos.Api.Core.Notifications;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class RemindersController(ReminderService reminderService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetReminders([FromQuery] string? status = null) =>
        Ok(await reminderService.GetRemindersAsync(status));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetReminder(int id)
    {
        var reminder = await reminderService.GetReminderByIdAsync(id);
        return reminder is null ? NotFound() : Ok(reminder);
    }

    [HttpPost]
    public async Task<IActionResult> CreateReminder([FromBody] CreateReminderRequest req)
    {
        try
        {
            var reminder = await reminderService.CreateReminderAsync(req);
            return CreatedAtAction(nameof(GetReminder), new { id = reminder.Id }, reminder);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateReminder(int id, [FromBody] UpdateReminderRequest req)
    {
        try
        {
            var reminder = await reminderService.UpdateReminderAsync(id, req);
            return reminder is null ? NotFound() : Ok(reminder);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> CancelReminder(int id)
    {
        var cancelled = await reminderService.CancelReminderAsync(id);
        if (!cancelled)
            return NotFound(new { error = "Recordatorio no encontrado o ya enviado." });
        return NoContent();
    }

    // El admin lo mandó a mano (WhatsApp/email personal) — evita que el job
    // automático lo procese de nuevo más tarde.
    [HttpPost("{id:int}/mark-sent")]
    public async Task<IActionResult> MarkSent(int id)
    {
        var marked = await reminderService.MarkSentAsync(id);
        if (!marked)
            return NotFound(new { error = "Recordatorio no encontrado o ya procesado." });
        return NoContent();
    }
}
