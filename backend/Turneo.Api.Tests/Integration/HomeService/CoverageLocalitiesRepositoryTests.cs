using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Modules.HomeService.ServiceArea;

namespace Turneo.Api.Tests.Integration;

// The controller pre-checks duplicates, but two concurrent requests can both
// pass that check. These tests skip the pre-check and hit the real Postgres
// unique indexes, proving TrySaveChangesAsync turns a 23505 into "false"
// (which the controller maps to the same 400 duplicate response).
[Collection("Integration")]
public class CoverageLocalitiesRepositoryTests
{
    private readonly CustomWebApplicationFactory _factory;

    public CoverageLocalitiesRepositoryTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<bool> InsertAsync(int tenantId, string name, string province, string? georefId)
    {
        using var scope = _factory.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<CurrentTenantService>().SetTenant(tenantId);
        var repository = new CoverageLocalitiesRepository(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());

        repository.Add(new CoverageLocality { TenantId = tenantId, Name = name, Province = province, GeorefId = georefId });
        return await repository.TrySaveChangesAsync();
    }

    [Fact]
    public async Task TrySaveChanges_SameNameAndProvince_ReturnsFalse()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var name = $"Castelar-{Guid.NewGuid():N}";

        Assert.True(await InsertAsync(tenantId, name, "Buenos Aires", null));
        Assert.False(await InsertAsync(tenantId, name, "Buenos Aires", null));
    }

    [Fact]
    public async Task TrySaveChanges_SameGeorefId_ReturnsFalse()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var georefId = Guid.NewGuid().ToString("N")[..11];

        Assert.True(await InsertAsync(tenantId, $"Haedo-{Guid.NewGuid():N}", "Buenos Aires", georefId));
        Assert.False(await InsertAsync(tenantId, $"Haedo Sur-{Guid.NewGuid():N}", "Buenos Aires", georefId));
    }

    [Fact]
    public async Task TrySaveChanges_SeveralLocalitiesWithoutGeorefId_AreAllowed()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

        Assert.True(await InsertAsync(tenantId, $"Merlo-{Guid.NewGuid():N}", "Buenos Aires", null));
        Assert.True(await InsertAsync(tenantId, $"Padua-{Guid.NewGuid():N}", "Buenos Aires", null));
    }
}
