using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Turneo.Api.Core.Roles;

// Se combina con [Authorize(Roles = "...")] a nivel de controller/acción: ese
// atributo ya garantiza autenticación + rol válido — este filtro únicamente
// agrega una restricción MÁS FINA (¿tiene el flag de este módulo/acción en
// ModulePermission?) para el rol "Staff" siempre, y para "Professional" solo
// cuando el endpoint lo pide explícitamente con alsoCheckProfessional: true
// (endpoints "de panel" a los que un profesional puede sumarse si el admin le
// otorgó el módulo desde Permisos — ver PermissionsController). Los endpoints
// de autogestión de un profesional (su propia agenda en TimeSlotsController)
// NO usan ese flag: siguen con bypass total como siempre, para no depender de
// una fila de ModulePermission que hoy nadie tiene. Admin bypassea siempre.
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string _module;
    private readonly string _action;
    private readonly bool _alsoCheckProfessional;

    public RequirePermissionAttribute(string module, string action, bool alsoCheckProfessional = false)
    {
        _module = module;
        _action = action;
        _alsoCheckProfessional = alsoCheckProfessional;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        var role = user.FindFirst(ClaimTypes.Role)?.Value;

        var needsCheck = role == "Staff" || (role == "Professional" && _alsoCheckProfessional);
        if (!needsCheck)
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
