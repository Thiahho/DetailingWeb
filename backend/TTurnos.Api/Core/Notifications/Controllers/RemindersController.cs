using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TTurnos.Api.Core.Notifications;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class RemindersController(ReminderService reminderService) : ControllerBase
{
    // ── CustomerProfiles ─────────────────────────────────────────

    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers() =>
        Ok(await reminderService.GetProfilesAsync());

    [HttpGet("customers/{id:int}")]
    public async Task<IActionResult> GetCustomer(int id)
    {
        var profile = await reminderService.GetProfileByIdAsync(id);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPost("customers")]
    public async Task<IActionResult> CreateCustomer([FromBody] CreateCustomerProfileRequest req)
    {
        var profile = await reminderService.CreateProfileAsync(req);
        return CreatedAtAction(nameof(GetCustomer), new { id = profile.Id }, profile);
    }

    [HttpPut("customers/{id:int}")]
    public async Task<IActionResult> UpdateCustomer(int id, [FromBody] UpdateCustomerProfileRequest req)
    {
        try
        {
            var profile = await reminderService.UpdateProfileAsync(id, req);
            return profile is null ? NotFound() : Ok(profile);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpDelete("customers/{id:int}")]
    public async Task<IActionResult> DeleteCustomer(int id)
    {
        var deleted = await reminderService.DeleteProfileAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // ── ScheduledReminders ────────────────────────────────────────

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
}
