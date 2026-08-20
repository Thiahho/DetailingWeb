using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Roles;

public class PermissionsRepository : IPermissionsRepository
{
    private readonly ApplicationDbContext _context;

    public PermissionsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<User>> GetPermissionableUsersAsync() =>
        _context.Users
            .Include(u => u.Professional)
            .Where(u => u.Role == "Staff" || (u.Role == "Professional" && _context.ModulePermissions.Any(p => p.UserId == u.Id)))
            .OrderBy(u => u.Email)
            .ToListAsync();

    public Task<User?> FindPermissionableUserAsync(int userId) =>
        _context.Users.FirstOrDefaultAsync(u => u.Id == userId && (u.Role == "Staff" || u.Role == "Professional"));

    public Task<List<ModulePermission>> GetForUserAsync(int userId) =>
        _context.ModulePermissions.Where(p => p.UserId == userId).ToListAsync();

    public Task<ModulePermission?> FindAsync(int userId, string module) =>
        _context.ModulePermissions.FirstOrDefaultAsync(p => p.UserId == userId && p.Module == module);

    public void AddPermission(ModulePermission permission) => _context.ModulePermissions.Add(permission);

    public void RemovePermissions(IEnumerable<ModulePermission> permissions) => _context.ModulePermissions.RemoveRange(permissions);

    public void RemoveUser(User user) => _context.Users.Remove(user);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
