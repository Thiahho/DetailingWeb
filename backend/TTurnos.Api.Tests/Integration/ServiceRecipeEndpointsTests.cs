using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace TTurnos.Api.Tests.Integration;

// Cubre la receta de un Service (qué insumos consume y en qué cantidad),
// usada para auto-agregar esos insumos al detalle de un turno cuando el
// servicio se carga (ver ServicesController.GetRecipe/UpdateRecipe).
[Collection("Integration")]
public class ServiceRecipeEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public ServiceRecipeEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-recipe-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task GetRecipe_ForServiceWithNoRecipe_ReturnsEmptyList()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, $"Manicura-{Guid.NewGuid():N}");

        var response = await admin.GetAsync($"/api/services/{service.Id}/recipe");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var items = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.Empty(items!);
    }

    [Fact]
    public async Task UpdateRecipe_ThenGet_ReturnsPersistedItems()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, $"Manicura-{Guid.NewGuid():N}");
        var insumo = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Esmalte-{Guid.NewGuid():N}", stock: 20);

        var putResponse = await admin.PutAsJsonAsync($"/api/services/{service.Id}/recipe", new
        {
            items = new[] { new { insumoId = insumo.Id, quantity = 2 } }
        });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await admin.GetAsync($"/api/services/{service.Id}/recipe");
        var items = await getResponse.Content.ReadFromJsonAsync<List<JsonElement>>();

        var item = Assert.Single(items!);
        Assert.Equal(insumo.Id, item.GetProperty("insumoId").GetInt32());
        Assert.Equal(insumo.Name, item.GetProperty("insumoName").GetString());
        Assert.Equal(2, item.GetProperty("quantity").GetInt32());
    }

    [Fact]
    public async Task UpdateRecipe_ReplacesPreviousItems()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, $"Pedicura-{Guid.NewGuid():N}");
        var insumoA = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Algodon-{Guid.NewGuid():N}", stock: 20);
        var insumoB = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Acetona-{Guid.NewGuid():N}", stock: 20);

        await admin.PutAsJsonAsync($"/api/services/{service.Id}/recipe", new
        {
            items = new[] { new { insumoId = insumoA.Id, quantity = 1 } }
        });

        var replaceResponse = await admin.PutAsJsonAsync($"/api/services/{service.Id}/recipe", new
        {
            items = new[] { new { insumoId = insumoB.Id, quantity = 3 } }
        });
        Assert.Equal(HttpStatusCode.OK, replaceResponse.StatusCode);

        var getResponse = await admin.GetAsync($"/api/services/{service.Id}/recipe");
        var items = await getResponse.Content.ReadFromJsonAsync<List<JsonElement>>();

        var item = Assert.Single(items!);
        Assert.Equal(insumoB.Id, item.GetProperty("insumoId").GetInt32());
        Assert.Equal(3, item.GetProperty("quantity").GetInt32());
    }

    [Fact]
    public async Task UpdateRecipe_ForMissingService_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PutAsJsonAsync("/api/services/999999/recipe", new { items = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetRecipe_WithoutAdminToken_ReturnsUnauthorized()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, $"Corte-{Guid.NewGuid():N}");
        var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/services/{service.Id}/recipe");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
