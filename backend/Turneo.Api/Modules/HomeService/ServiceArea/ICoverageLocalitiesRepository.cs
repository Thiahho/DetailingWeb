namespace Turneo.Api.Modules.HomeService.ServiceArea;

public interface ICoverageLocalitiesRepository
{
    Task<List<CoverageLocality>> GetAllAsync();
    Task<CoverageLocality?> FindAsync(int id);

    // Active localities only, for the public booking page.
    Task<List<CoverageLocality>> GetActiveAsync();
    Task<bool> ExistsAsync(string name, string province, string? georefId, int? excludeId = null);
    void Add(CoverageLocality locality);
    void Remove(CoverageLocality locality);
    Task<int> SaveChangesAsync();

    // Saves and returns false when a unique index rejects the change (Postgres
    // 23505), e.g. a concurrent request inserted the same locality.
    Task<bool> TrySaveChangesAsync();
}
