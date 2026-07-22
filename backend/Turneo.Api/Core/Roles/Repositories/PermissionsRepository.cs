using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Roles;

public class PermissionsRepository : IPermissionsRepository
{
    private readonly ApplicationDbContext _context;

    public PermissionsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<User>> GetStaffUsersAsync() =>
        _context.Users.Where(u => u.Role == "Staff").OrderBy(u => u.Email).ToListAsync();

    public Task<User?> FindStaffUserAsync(int userId) =>
        _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Staff");

    public Task<List<ModulePermission>> GetForUserAsync(int userId) =>
        _context.ModulePermissions.Where(p => p.UserId == userId).ToListAsync();

    public Task<ModulePermission?> FindAsync(int userId, string module) =>
        _context.ModulePermissions.FirstOrDefaultAsync(p => p.UserId == userId && p.Module == module);

    public void AddPermission(ModulePermission permission) => _context.ModulePermissions.Add(permission);

    public void RemovePermissions(IEnumerable<ModulePermission> permissions) => _context.ModulePermissions.RemoveRange(permissions);

    public void RemoveUser(User user) => _context.Users.Remove(user);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
