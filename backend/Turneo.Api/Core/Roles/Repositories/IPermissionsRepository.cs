namespace Turneo.Api.Core.Roles;

public interface IPermissionsRepository
{
    // Staff (Role="Staff") + profesionales que ya tienen al menos un módulo otorgado
    // (Role="Professional" con filas en ModulePermissions) — ver PermissionsController.
    Task<List<User>> GetPermissionableUsersAsync();
    Task<User?> FindPermissionableUserAsync(int userId);
    Task<List<ModulePermission>> GetForUserAsync(int userId);
    Task<ModulePermission?> FindAsync(int userId, string module);
    void AddPermission(ModulePermission permission);
    void RemovePermissions(IEnumerable<ModulePermission> permissions);
    void RemoveUser(User user);
    Task<int> SaveChangesAsync();
}
