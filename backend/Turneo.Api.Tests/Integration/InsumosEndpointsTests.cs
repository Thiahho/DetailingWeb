using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Turneo.Api.Tests.Integration;

[Collection("Integration")]
public class InsumosEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public InsumosEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-insumo-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static object InsumoPayload(string name, int stock = 10, int lowStockThreshold = 2, decimal unitCost = 5, bool isActive = true) => new
    {
        name,
        stock,
        lowStockThreshold,
        unitCost,
        isActive,
        order = 0
    };

    [Fact]
    public async Task GetAll_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/insumos");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithAdminToken_ReturnsOkAndPersistsInsumo()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var name = $"Esmalte-{Guid.NewGuid():N}";

        var response = await admin.PostAsJsonAsync("/api/insumos", InsumoPayload(name, stock: 10));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var listResponse = await admin.GetAsync("/api/insumos");
        var raw = await listResponse.Content.ReadAsStringAsync();
        Assert.Contains(name, raw);
    }

    [Fact]
    public async Task Update_AdjustsStockManually()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var insumo = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Algodon-{Guid.NewGuid():N}", stock: 10);

        var response = await admin.PutAsJsonAsync($"/api/insumos/{insumo.Id}", InsumoPayload(insumo.Name, stock: 25));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloaded = await TestDataFactory.GetInsumoIgnoringTenantAsync(_factory, insumo.Id);
        Assert.Equal(25, reloaded!.Stock);
    }

    [Fact]
    public async Task Delete_RemovesInsumo()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var insumo = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Cera-{Guid.NewGuid():N}", stock: 5);

        var response = await admin.DeleteAsync($"/api/insumos/{insumo.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloaded = await TestDataFactory.GetInsumoIgnoringTenantAsync(_factory, insumo.Id);
        Assert.Null(reloaded);
    }

    [Fact]
    public async Task Update_ForMissingInsumo_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PutAsJsonAsync("/api/insumos/999999", InsumoPayload("No existe"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
