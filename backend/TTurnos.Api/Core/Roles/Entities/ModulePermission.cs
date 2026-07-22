using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Roles;

// Permiso de un usuario Staff sobre un módulo del panel admin. Los Admin no
// tienen filas acá — su acceso es total siempre, sin excepción (ver
// RequirePermissionAttribute). Solo aplica a usuarios con User.Role == "Staff".
[Table("ModulePermissions")]
public class ModulePermission : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Module { get; set; } = string.Empty;
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
}
