namespace Turneo.Api.Core.Settings;

public interface ISiteConfigRepository
{
    Task<SiteConfig?> GetAsync();
    void Add(SiteConfig config);
    Task<int> SaveChangesAsync();

    // Cross-tenant: usado por el Smart Link público, ver implementación.
    Task<string?> GetGoogleReviewUrlIgnoringTenantAsync(int tenantId);
}
