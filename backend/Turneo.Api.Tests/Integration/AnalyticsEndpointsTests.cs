using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

[Collection("Integration")]
public class AnalyticsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public AnalyticsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetSummary_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/analytics/summary");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSummary_AsAdmin_ReturnsExpectedShape()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-analytics-{Guid.NewGuid():N}@test.com", "Password123");

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));

        var response = await client.GetAsync("/api/analytics/summary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("totalBookings", out _));
        Assert.True(body.TryGetProperty("occupancyRate", out _));
        Assert.True(body.TryGetProperty("topServices", out _));
        Assert.True(body.TryGetProperty("professionalStats", out _));
    }
}
