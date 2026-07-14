namespace TTurnos.Api.Core.Settings;

public interface ISiteConfigRepository
{
    Task<SiteConfig?> GetAsync();
    void Add(SiteConfig config);
    Task<int> SaveChangesAsync();
}
