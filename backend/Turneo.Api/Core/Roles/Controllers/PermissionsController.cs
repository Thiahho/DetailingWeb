using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Roles;

[ApiController]
[Route("api/[controller]")]
public class PermissionsController : ControllerBase
{
    private readonly IPermissionsRepository _repository;
    private readonly AuthService _authService;

    public PermissionsController(IPermissionsRepository repository, AuthService authService)
    {
        _repository = repository;
        _authService = authService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    // GET: api/permissions/modules (admin - catálogo de módulos gestionables)
    [HttpGet("modules")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetModules() => Ok(PermissionModules.All);

    // GET: api/permissions/me (admin/staff/profesional-con-permisos - permisos efectivos
    // del usuario logueado, los consume el frontend para ocultar/deshabilitar lo que no puede usar)
    [HttpGet("me")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    public async Task<IActionResult> GetMine()
    {
        var role = User.FindFirst(ClaimTypes.Role)!.Value;

        if (role == "Admin")
        {
            return Ok(new
            {
                role,
                permissions = PermissionModules.All.Select(m => new
                {
                    module = m,
                    canView = true,
                    canCreate = true,
                    canEdit = true,
                    canDelete = true
                })
            });
        }

        var granted = await _repository.GetForUserAsync(CurrentUserId);
        return Ok(new { role, permissions = granted.Select(MapPermission) });
    }

    // GET: api/permissions/staff (admin - lista de cuentas Staff + profesionales con
    // permisos de panel otorgados, cada una con su grilla)
    [HttpGet("staff")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStaff()
    {
        var users = await _repository.GetPermissionableUsersAsync();
        var result = new List<object>();

        foreach (var user in users)
        {
            var permissions = await _repository.GetForUserAsync(user.Id);
            result.Add(new
            {
                user.Id,
                user.Email,
                user.Username,
                type = user.Role,
                professionalId = user.ProfessionalId,
                professionalName = user.Professional != null ? $"{user.Professional.FirstName} {user.Professional.LastName}" : null,
                permissions = permissions.Select(MapPermission)
            });
        }

        return Ok(result);
    }

    // POST: api/permissions/staff (admin - crea una cuenta Staff sin permisos todavía)
    [HttpPost("staff")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateStaff([FromBody] CreateStaffRequest request)
    {
        try
        {
            var user = await _authService.CreateStaffAccountAsync(request.Email, request.Password, request.Username);
            return Ok(new { success = true, id = user.Id, email = user.Email, username = user.Username });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // PUT: api/permissions/staff/{userId} (admin - reemplaza la grilla de permisos completa,
    // mismo criterio que BookingsController/detail: más simple que CRUD granular por fila)
    [HttpPut("staff/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdatePermissions(int userId, [FromBody] UpdateStaffPermissionsRequest request)
    {
        var user = await _repository.FindPermissionableUserAsync(userId);
        if (user == null)
            return NotFound(new { success = false, message = "Usuario no encontrado" });

        var invalidModule = request.Permissions.FirstOrDefault(p => !PermissionModules.IsValid(p.Module));
        if (invalidModule != null)
            return BadRequest(new { success = false, message = $"Módulo inválido: {invalidModule.Module}" });

        var existing = await _repository.GetForUserAsync(userId);
        _repository.RemovePermissions(existing);

        foreach (var p in request.Permissions)
        {
            _repository.AddPermission(new ModulePermission
            {
                UserId = userId,
                Module = p.Module,
                CanView = p.CanView,
                CanCreate = p.CanCreate,
                CanEdit = p.CanEdit,
                CanDelete = p.CanDelete
            });
        }

        await _repository.SaveChangesAsync();
        return Ok(new { success = true, message = "Permisos actualizados correctamente" });
    }

    // PUT: api/permissions/staff/{userId}/password (admin - cambia la contraseña de un Staff)
    [HttpPut("staff/{userId}/password")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ChangeStaffPassword(int userId, [FromBody] ChangeStaffPasswordRequest request)
    {
        try
        {
            await _authService.ChangeStaffPasswordAsync(userId, request.NewPassword);
            return Ok(new { success = true, message = "Contraseña actualizada" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // DELETE: api/permissions/staff/{userId} (admin - revoca el acceso)
    // Para Staff borra la cuenta completa (no tiene otro uso). Para un profesional
    // solo se le sacan los permisos de panel — su login de agenda no se toca.
    [HttpDelete("staff/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteStaff(int userId)
    {
        var user = await _repository.FindPermissionableUserAsync(userId);
        if (user == null)
            return NotFound(new { success = false, message = "Usuario no encontrado" });

        var permissions = await _repository.GetForUserAsync(userId);
        _repository.RemovePermissions(permissions);
        if (user.Role == "Staff")
            _repository.RemoveUser(user);
        await _repository.SaveChangesAsync();

        return Ok(new { success = true, message = "Acceso revocado" });
    }

    private static object MapPermission(ModulePermission p) => new
    {
        module = p.Module,
        canView = p.CanView,
        canCreate = p.CanCreate,
        canEdit = p.CanEdit,
        canDelete = p.CanDelete
    };
}
