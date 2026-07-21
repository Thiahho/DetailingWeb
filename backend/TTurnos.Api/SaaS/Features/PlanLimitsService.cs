using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.SaaS.Features;

public class PlanLimitsService : IPlanLimitsService
{
    // Convención: un valor numérico de "-1" en PlanFeature.Value significa
    // "sin límite" (documentado también en Feature.Description).
    private const int Unlimited = -1;

    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenant _currentTenant;

    public PlanLimitsService(ApplicationDbContext context, ICurrentTenant currentTenant)
    {
        _context = context;
        _currentTenant = currentTenant;
    }

    public async Task<bool> IsWithinLimitAsync(string featureKey, int currentCount)
    {
        var planId = await _context.Tenants
            .AsNoTracking()
            .Where(t => t.Id == _currentTenant.TenantId)
            .Select(t => t.PlanId)
            .FirstOrDefaultAsync();

        if (planId is null)
            return true;

        var value = await _context.PlanFeatures
            .AsNoTracking()
            .Where(pf => pf.PlanId == planId && pf.Feature!.Key == featureKey)
            .Select(pf => pf.Value)
            .FirstOrDefaultAsync();

        if (value is null || !int.TryParse(value, out var limit))
            return true;

        return limit == Unlimited || currentCount < limit;
    }

    public Task<bool> IsFeatureEnabledAsync(string featureKey) =>
        IsFeatureEnabledAsync(_currentTenant.TenantId, featureKey);

    public async Task<bool> IsFeatureEnabledAsync(int tenantId, string featureKey)
    {
        var planId = await _context.Tenants
            .AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.PlanId)
            .FirstOrDefaultAsync();

        if (planId is null)
            return true;

        var value = await _context.PlanFeatures
            .AsNoTracking()
            .Where(pf => pf.PlanId == planId && pf.Feature!.Key == featureKey)
            .Select(pf => pf.Value)
            .FirstOrDefaultAsync();

        if (value is null || !bool.TryParse(value, out var enabled))
            return true;

        return enabled;
    }
}
