using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

[Collection("Integration")]
public class GalleryEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public GalleryEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-gallery-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task GetActive_Public_ExcludesInactiveItems()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var activeTitle = $"activo-{Guid.NewGuid():N}";
        var inactiveTitle = $"inactivo-{Guid.NewGuid():N}";
        await admin.PostAsJsonAsync("/api/gallery", new { title = activeTitle, tag = "corte", imageUrl = "https://example.com/a.jpg", isActive = true, order = 0 });
        await admin.PostAsJsonAsync("/api/gallery", new { title = inactiveTitle, tag = "corte", imageUrl = "https://example.com/b.jpg", isActive = false, order = 0 });

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/gallery");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains(activeTitle, raw);
        Assert.DoesNotContain(inactiveTitle, raw);
    }

    [Fact]
    public async Task GetAll_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/gallery/all");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Delete_AsAdmin_RemovesItem()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var createResponse = await admin.PostAsJsonAsync("/api/gallery", new { title = "A borrar", tag = "corte", imageUrl = "https://example.com/c.jpg", isActive = true, order = 0 });
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResponse = await admin.DeleteAsync($"/api/gallery/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var allResponse = await admin.GetAsync("/api/gallery/all");
        var raw = await allResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("A borrar", raw);
    }
}
