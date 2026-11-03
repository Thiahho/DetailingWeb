using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Turneo.Api.Modules.HomeService.ServiceArea;

public class CoverageLocalitiesRepository : ICoverageLocalitiesRepository
{
    private readonly ApplicationDbContext _context;

    public CoverageLocalitiesRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<List<CoverageLocality>> GetAllAsync() =>
        _context.CoverageLocalities
            .OrderBy(c => c.Province)
            .ThenBy(c => c.Name)
            .ToListAsync();

    public Task<List<CoverageLocality>> GetActiveAsync() =>
        _context.CoverageLocalities
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Province)
            .ThenBy(c => c.Name)
            .ToListAsync();

    public Task<CoverageLocality?> FindAsync(int id) =>
        _context.CoverageLocalities.FirstOrDefaultAsync(c => c.Id == id);

    // A locality is a duplicate when the tenant already has the same name and
    // province (case-insensitive), or the same Georef id. The tenant query
    // filter scopes the check to the current tenant.
    public Task<bool> ExistsAsync(string name, string province, string? georefId, int? excludeId = null)
    {
        var normalizedName = name.ToLower();
        var normalizedProvince = province.ToLower();

        return _context.CoverageLocalities
            .Where(c => excludeId == null || c.Id != excludeId)
            .AnyAsync(c =>
                (c.Name.ToLower() == normalizedName && c.Province.ToLower() == normalizedProvince)
                || (georefId != null && c.GeorefId == georefId));
    }

    public void Add(CoverageLocality locality) => _context.CoverageLocalities.Add(locality);

    public void Remove(CoverageLocality locality) => _context.CoverageLocalities.Remove(locality);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();

    public async Task<bool> TrySaveChangesAsync()
    {
        try
        {
            await _context.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }
}
