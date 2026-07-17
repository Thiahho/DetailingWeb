using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TTurnos.Api.Core.Notifications;

// Mismo prefijo que antes (api/reminders/customers) para no romper el proxy
// del frontend ni clientes existentes — separado de RemindersController
// porque CustomerProfile y ScheduledReminder son recursos distintos.
[ApiController]
[Route("api/reminders/customers")]
[Authorize(Roles = "Admin")]
public class CustomerProfilesController(CustomerProfileService customerProfileService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetCustomers() =>
        Ok(await customerProfileService.GetProfilesAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetCustomer(int id)
    {
        var profile = await customerProfileService.GetProfileByIdAsync(id);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPost]
    public async Task<IActionResult> CreateCustomer([FromBody] CreateCustomerProfileRequest req)
    {
        var profile = await customerProfileService.CreateProfileAsync(req);
        return CreatedAtAction(nameof(GetCustomer), new { id = profile.Id }, profile);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateCustomer(int id, [FromBody] UpdateCustomerProfileRequest req)
    {
        try
        {
            var profile = await customerProfileService.UpdateProfileAsync(id, req);
            return profile is null ? NotFound() : Ok(profile);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteCustomer(int id)
    {
        var deleted = await customerProfileService.DeleteProfileAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("{id:int}/history")]
    public async Task<IActionResult> GetCustomerHistory(int id) =>
        Ok(await customerProfileService.GetCustomerHistoryAsync(id));
}
