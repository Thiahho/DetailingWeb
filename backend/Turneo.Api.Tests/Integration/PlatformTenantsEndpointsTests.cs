using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Turneo.Api.Tests.Integration;

[Collection("Integration")]
public class PlatformTenantsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public PlatformTenantsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateTenant_WithValidSlug_ReturnsOkWithNormalizedSlug()
    {
        var slug = $"Salon-{Guid.NewGuid():N}"[..20];

        var response = await PlatformOwnerClient().PostAsJsonAsync("/api/platform/tenants", Payload($"  {slug}  "));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(slug.ToLowerInvariant(), body.GetProperty("slug").GetString());
    }

    [Theory]
    [InlineData("mi salon")]
    [InlineData("estética")]
    [InlineData("salon.belleza")]
    [InlineData("-salon")]
    [InlineData("ab")]
    public async Task CreateTenant_WithInvalidSlug_ReturnsBadRequest(string slug)
    {
        var response = await PlatformOwnerClient().PostAsJsonAsync("/api/platform/tenants", Payload(slug));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("message").GetString()));
    }

    [Theory]
    [InlineData("api")]
    [InlineData("Admin")]
    [InlineData("www")]
    public async Task CreateTenant_WithReservedSlug_ReturnsBadRequest(string slug)
    {
        var response = await PlatformOwnerClient().PostAsJsonAsync("/api/platform/tenants", Payload(slug));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("message").GetString()));
    }

    private HttpClient PlatformOwnerClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, 0, "owner@test.com", "PlatformOwner", 0));
        return client;
    }

    private static object Payload(string slug) => new
    {
        name = "Salón Nuevo",
        slug,
        vertical = "Beauty",
        commercialModel = 0,
        planId = (int?)null,
        adminEmail = $"admin-{Guid.NewGuid():N}@test.com",
        adminPassword = "Password123",
        acceptedTerms = true
    };
}
