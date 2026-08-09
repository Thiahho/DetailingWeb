using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Core.Settings;

public class SiteConfigRepository : ISiteConfigRepository
{
    private readonly ApplicationDbContext _context;

    public SiteConfigRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<SiteConfig?> GetAsync() => _context.SiteConfigs.FirstOrDefaultAsync();

    public void Add(SiteConfig config) => _context.SiteConfigs.Add(config);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();

    // Cross-tenant a propósito: lo consume SmartLinkController (endpoint público de
    // Smart Tag) sin tenant ambiental resuelto de forma confiable — mismo patrón que
    // PaymentsRepository/AutomationRulesRepository.
    public Task<string?> GetGoogleReviewUrlIgnoringTenantAsync(int tenantId) =>
        _context.SiteConfigs.IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId)
            .Select(s => s.GoogleReviewUrl)
            .FirstOrDefaultAsync();
}
