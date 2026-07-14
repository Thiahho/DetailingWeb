using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Settings;

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
}
