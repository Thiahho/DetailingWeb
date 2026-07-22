using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Turneo.Api.Core.Roles;

// Se combina con [Authorize(Roles = "...")] a nivel de controller/acción: ese
// atributo ya garantiza autenticación + rol válido — este filtro únicamente
// agrega una restricción MÁS FINA para el rol "Staff" (¿tiene el flag de este
// módulo/acción en ModulePermission?). Cualquier otro rol que ya haya pasado el
// [Authorize] (Admin, Professional en endpoints compartidos como TimeSlots,
// etc.) sigue de largo sin chequeo extra — este atributo no reemplaza ni
// restringe esos roles, solo acota a Staff.
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string _module;
    private readonly string _action;

    public RequirePermissionAttribute(string module, string action)
    {
        _module = module;
        _action = action;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        var role = user.FindFirst(ClaimTypes.Role)?.Value;

        // Solo Staff pasa por el chequeo granular de ModulePermission. Cualquier
        // otro rol ya autorizado por [Authorize(Roles=...)] (Admin, Professional
        // en sus propios endpoints compartidos, etc.) sigue de largo.
        if (role != "Staff")
            return;

        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
        {
            context.Result = new ForbidResult();
            return;
        }

        var repository = context.HttpContext.RequestServices.GetRequiredService<IPermissionsRepository>();
        var permission = await repository.FindAsync(userId, _module);

        var allowed = permission is not null && _action switch
        {
            PermissionActions.View => permission.CanView,
            PermissionActions.Create => permission.CanCreate,
            PermissionActions.Edit => permission.CanEdit,
            PermissionActions.Delete => permission.CanDelete,
            _ => false
        };

        if (!allowed)
            context.Result = new ForbidResult();
    }
}
