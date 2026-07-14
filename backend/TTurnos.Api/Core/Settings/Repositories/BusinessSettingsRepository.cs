using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Settings;

public class BusinessSettingsRepository : IBusinessSettingsRepository
{
    private readonly ApplicationDbContext _context;

    public BusinessSettingsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<BusinessSettings?> GetAsync() => _context.BusinessSettings.FirstOrDefaultAsync();

    public void Add(BusinessSettings settings) => _context.BusinessSettings.Add(settings);

    public Task<int> SaveChangesAsync() => _context.SaveChangesAsync();
}
