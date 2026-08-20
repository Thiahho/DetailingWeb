using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Notifications;

// Mismo prefijo que antes (api/reminders/customers) para no romper el proxy
// del frontend ni clientes existentes — separado de RemindersController
// porque CustomerProfile y ScheduledReminder son recursos distintos.
[ApiController]
[Route("api/reminders/customers")]
[Authorize(Roles = "Admin,Staff,Professional")]
public class CustomerProfilesController(CustomerProfileService customerProfileService, IPlanLimitsService planLimits) : ControllerBase
{
    [HttpGet]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetCustomers() =>
        Ok(await customerProfileService.GetProfilesAsync());

    [HttpGet("{id:int}")]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetCustomer(int id)
    {
        var profile = await customerProfileService.GetProfileByIdAsync(id);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPost]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> CreateCustomer([FromBody] CreateCustomerProfileRequest req)
    {
        var count = await customerProfileService.CountAsync();
        if (!await planLimits.IsWithinLimitAsync("MaxClients", count))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new
            {
                message = "Alcanzaste el límite de clientes de tu plan. Actualizá tu plan para agregar más."
            });
        }

        var profile = await customerProfileService.CreateProfileAsync(req);
        return CreatedAtAction(nameof(GetCustomer), new { id = profile.Id }, profile);
    }

    [HttpPut("{id:int}")]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.Edit, alsoCheckProfessional: true)]
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
    [RequirePermission(PermissionModules.Clientes, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> DeleteCustomer(int id)
    {
        var deleted = await customerProfileService.DeleteProfileAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("{id:int}/history")]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetCustomerHistory(int id) =>
        Ok(await customerProfileService.GetCustomerHistoryAsync(id));
}
