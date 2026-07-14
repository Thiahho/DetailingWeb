using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Services;

public class ServicesRepository : IServicesRepository
{
    private readonly ApplicationDbContext _context;

    public ServicesRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Service>> GetActiveAsync() =>
        _context.Services
            .Where(s => s.IsActive)
            .OrderBy(s => s.Order)
            .ThenBy(s => s.CreatedAt)
            .ToListAsync();

    public Task<List<Service>> GetAllAsync() =>
        _context.Services
            .OrderBy(s => s.Order)
            .ThenBy(s => s.CreatedAt)
            .ToListAsync();

    public Task<Service?> GetBySlugAsync(string slug, bool activeOnly) =>
        activeOnly
            ? _context.Services.FirstOrDefaultAsync(s => s.Slug == slug && s.IsActive)
            : _context.Services.FirstOrDefaultAsync(s => s.Slug == slug);

    public Task<bool> SlugExistsAsync(string slug, int? excludeId = null) =>
        _context.Services.AnyAsync(s => s.Slug == slug && (excludeId == null || s.Id != excludeId));

    public Task<Service?> FindAsync(int id) => _context.Services.FindAsync(id).AsTask();

    public void Add(Service service) => _context.Services.Add(service);

    public void Remove(Service service) => _context.Services.Remove(service);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
