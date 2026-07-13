using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace TTurnos.Api.Tests.Integration;

[Collection("Integration")]
public class ContentVideosEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public ContentVideosEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-videos-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task GetActive_Public_ExcludesInactiveVideos()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var activeTitle = $"activo-{Guid.NewGuid():N}";
        var inactiveTitle = $"inactivo-{Guid.NewGuid():N}";
        await admin.PostAsJsonAsync("/api/content-videos", new { title = activeTitle, videoUrl = "https://example.com/a.mp4", thumbnailUrl = "", isActive = true });
        await admin.PostAsJsonAsync("/api/content-videos", new { title = inactiveTitle, videoUrl = "https://example.com/b.mp4", thumbnailUrl = "", isActive = false });

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/content-videos");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains(activeTitle, raw);
        Assert.DoesNotContain(inactiveTitle, raw);
    }

    [Fact]
    public async Task GetAll_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/content-videos/all");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithMissingTitle_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsJsonAsync("/api/content-videos", new { title = "", videoUrl = "https://example.com/a.mp4" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
