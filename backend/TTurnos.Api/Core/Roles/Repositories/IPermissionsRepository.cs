namespace TTurnos.Api.Core.Roles;

public interface IPermissionsRepository
{
    Task<List<User>> GetStaffUsersAsync();
    Task<User?> FindStaffUserAsync(int userId);
    Task<List<ModulePermission>> GetForUserAsync(int userId);
    Task<ModulePermission?> FindAsync(int userId, string module);
    void AddPermission(ModulePermission permission);
    void RemovePermissions(IEnumerable<ModulePermission> permissions);
    void RemoveUser(User user);
    Task<int> SaveChangesAsync();
}
