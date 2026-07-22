using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Professionals;

public class ProfessionalsRepository : IProfessionalsRepository
{
    private readonly ApplicationDbContext _context;

    public ProfessionalsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<Professional>> GetActiveWithServicesAsync() =>
        _context.Professionals
            .Where(p => p.IsActive)
            .Include(p => p.Services)
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync();

    public Task<List<Professional>> GetAllWithServicesAsync() =>
        _context.Professionals
            .Include(p => p.Services)
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync();

    public async Task<Dictionary<int, (string? Email, string? Username)>> GetProfessionalAccountsAsync()
    {
        var accounts = await _context.Users
            .Where(u => u.ProfessionalId != null && u.Role == "Professional")
            .Select(u => new { u.ProfessionalId, u.Email, u.Username })
            .ToListAsync();

        return accounts.ToDictionary(a => a.ProfessionalId!.Value, a => ((string?)a.Email, a.Username));
    }

    public Task<List<Professional>> GetActiveByServiceAsync(int serviceId) =>
        _context.Professionals
            .Where(p => p.IsActive && p.Services.Any(s => s.Id == serviceId))
            .OrderBy(p => p.Order)
            .ThenBy(p => p.CreatedAt)
            .ToListAsync();

    public Task<Professional?> GetActiveByIdWithServicesAsync(int id) =>
        _context.Professionals
            .Where(p => p.Id == id && p.IsActive)
            .Include(p => p.Services)
            .FirstOrDefaultAsync();

    public Task<Professional?> GetByIdWithServicesAsync(int id) =>
        _context.Professionals
            .Include(p => p.Services)
            .FirstOrDefaultAsync(p => p.Id == id);

    public Task<Professional?> GetByIdAsync(int id) =>
        _context.Professionals.FindAsync(id).AsTask();

    public Task<int> CountActiveAsync() =>
        _context.Professionals.CountAsync(p => p.IsActive);

    public Task<List<Service>> GetServicesByIdsAsync(List<int> serviceIds) =>
        serviceIds.Count > 0
            ? _context.Services.Where(s => serviceIds.Contains(s.Id)).ToListAsync()
            : Task.FromResult(new List<Service>());

    public void Add(Professional professional) => _context.Professionals.Add(professional);

    public void Remove(Professional professional) => _context.Professionals.Remove(professional);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
