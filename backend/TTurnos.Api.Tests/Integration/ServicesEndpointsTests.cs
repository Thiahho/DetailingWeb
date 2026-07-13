using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace TTurnos.Api.Tests.Integration;

[Collection("Integration")]
public class ServicesEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public ServicesEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-svc-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static object ServicePayload(string slug, bool isActive = true) => new
    {
        title = "Corte",
        slug,
        price = "1000",
        duration = "30min",
        imageUrl = "",
        description = "desc",
        details = new List<string>(),
        isActive
    };

    [Fact]
    public async Task GetAll_Public_ExcludesInactiveServices()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var activeSlug = $"activo-{Guid.NewGuid():N}";
        var inactiveSlug = $"inactivo-{Guid.NewGuid():N}";
        await admin.PostAsJsonAsync("/api/services", ServicePayload(activeSlug, isActive: true));
        await admin.PostAsJsonAsync("/api/services", ServicePayload(inactiveSlug, isActive: false));

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/services");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains(activeSlug, raw);
        Assert.DoesNotContain(inactiveSlug, raw);
    }

    [Fact]
    public async Task GetBySlug_ForInactiveService_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slug = $"oculto-{Guid.NewGuid():N}";
        await admin.PostAsJsonAsync("/api/services", ServicePayload(slug, isActive: false));

        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/services/{slug}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetAllAdmin_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/services/all");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/services", ServicePayload($"anon-{Guid.NewGuid():N}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithDuplicateSlug_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slug = $"duplicado-{Guid.NewGuid():N}";
        await admin.PostAsJsonAsync("/api/services", ServicePayload(slug));

        var response = await admin.PostAsJsonAsync("/api/services", ServicePayload(slug));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
