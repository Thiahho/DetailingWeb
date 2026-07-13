using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace TTurnos.Api.Tests.Integration;

[Collection("Integration")]
public class SiteConfigEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public SiteConfigEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static object SiteConfigPayload(string businessName = "Test") => new
    {
        businessName,
        whatsAppNumber = "5491122334455",
        instagramUrl = "",
        instagramHandle = "",
        location = "",
        locationShort = "",
        mapEmbedUrl = (string?)null,
        siteUrl = "",
        logoUrl = "",
        heroTitle = "",
        heroSubtitle = "",
        heroBadge = "",
        metaDescription = ""
    };

    [Fact]
    public async Task Update_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PutAsJsonAsync("/api/siteconfig", SiteConfigPayload());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_Public_DoesNotLeakAnotherTenantsBusinessName()
    {
        var configuration = _factory.Services.GetRequiredService<IConfiguration>();
        var baseDomain = configuration["Tenancy:BaseDomain"]!;

        var slugA = $"siteconfig-a-{Guid.NewGuid():N}";
        var tenantA = await TestDataFactory.CreateTenantAsync(_factory, slugA, "Salón A");
        var adminA = await TestDataFactory.CreateAdminUserAsync(_factory, tenantA.Id, $"admin-site-a-{Guid.NewGuid():N}@test.com", "Password123");
        var clientA = _factory.CreateClient();
        clientA.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, adminA.Id, adminA.Email, "Admin", tenantA.Id));
        await clientA.PutAsJsonAsync("/api/siteconfig", SiteConfigPayload("Salón Secreto A"));

        var slugB = $"siteconfig-b-{Guid.NewGuid():N}";
        await TestDataFactory.CreateTenantAsync(_factory, slugB, "Salón B");

        var anonClient = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/siteconfig");
        request.Headers.Add("X-Tenant-Host", $"{slugB}.{baseDomain}");
        var response = await anonClient.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(string.Empty, body.GetProperty("businessName").GetString());
    }
}
