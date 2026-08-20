using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Roles;

// Permiso de un usuario sobre un módulo del panel admin. Los Admin no tienen
// filas acá — su acceso es total siempre, sin excepción (ver
// RequirePermissionAttribute). Aplica a usuarios con Role == "Staff" (su único
// modo de acceso al panel) o Role == "Professional" (acceso adicional a su
// propia agenda — ver RequirePermissionAttribute.alsoCheckProfessional).
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
