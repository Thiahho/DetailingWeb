using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Un subdominio del dominio base que no corresponde a ningún tenant debe
// cortar con 404 en vez de seguir con tenant 0 (sitio vacío / writes rotos).
[Collection("Integration")]
public class TenantSubdomainResolutionTests
{
    private readonly CustomWebApplicationFactory _factory;

    public TenantSubdomainResolutionTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private string BaseDomain =>
        _factory.Services.GetRequiredService<IConfiguration>()["Tenancy:BaseDomain"]!;

    [Fact]
    public async Task PublicGet_WithUnknownSubdomain_ReturnsNotFound()
    {
        var response = await SendWithHostAsync($"nope-{Guid.NewGuid():N}.{BaseDomain}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("Negocio no encontrado", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task PublicGet_WithExistingTenantSubdomain_ReturnsOk()
    {
        var slug = $"subdomain-{Guid.NewGuid():N}";
        await TestDataFactory.CreateTenantAsync(_factory, slug, "Salón Subdominio");

        var response = await SendWithHostAsync($"{slug}.{BaseDomain}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PublicGet_WithExistingTenantSubdomainInUppercase_ReturnsOk()
    {
        var slug = $"subdomain-upper-{Guid.NewGuid():N}";
        await TestDataFactory.CreateTenantAsync(_factory, slug, "Salón Subdominio");

        var response = await SendWithHostAsync($"{slug.ToUpperInvariant()}.{BaseDomain}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("otro-dominio.com")]
    [InlineData("localhost")]
    public async Task PublicGet_WithHostOutsideBaseDomain_FallsBackToDefaultTenant(string host)
    {
        await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

        var response = await SendWithHostAsync(host);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PublicGet_WithApexOrWwwHost_FallsBackToDefaultTenant()
    {
        await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

        Assert.Equal(HttpStatusCode.OK, (await SendWithHostAsync(BaseDomain)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SendWithHostAsync($"www.{BaseDomain}")).StatusCode);
    }

    [Fact]
    public async Task PublicGet_WithReservedSubdomain_KeepsPreviousBehavior()
    {
        // "api" puede ser el host propio del backend: nunca es un tenant, así que
        // no debe cortar con 404 las llamadas directas a la API.
        var response = await SendWithHostAsync($"api.{BaseDomain}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AuthenticatedRequest_WithUnknownSubdomain_UsesTenantClaim()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-sub-{Guid.NewGuid():N}@test.com", "Password123");

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/services");
        request.Headers.Add("X-Tenant-Host", $"nope-{Guid.NewGuid():N}.{BaseDomain}");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<HttpResponseMessage> SendWithHostAsync(string host)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/services");
        request.Headers.Add("X-Tenant-Host", host);
        return await _factory.CreateClient().SendAsync(request);
    }
}
