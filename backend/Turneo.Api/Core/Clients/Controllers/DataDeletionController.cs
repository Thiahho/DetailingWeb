using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Core.Clients;

[ApiController]
[Route("api/data-deletion-requests")]
public class DataDeletionController(DataDeletionService service) : ControllerBase
{
    // Público — lo carga el cliente final desde /privacidad, sin sesión.
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Create([FromBody] CreateDataDeletionRequest request)
    {
        var created = await service.CreateRequestAsync(request);
        return Ok(new { received = true, id = created.Id });
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetAll() => Ok(await service.GetRequestsAsync());

    [HttpPost("{id:int}/confirm")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> Confirm(int id, [FromBody] ResolveDataDeletionRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

        var result = await service.ConfirmAsync(id, userId, request.ResolutionNote);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Clientes, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> Reject(int id, [FromBody] ResolveDataDeletionRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

        var result = await service.RejectAsync(id, userId, request.ResolutionNote);
        return result is null ? NotFound() : Ok(result);
    }
}
