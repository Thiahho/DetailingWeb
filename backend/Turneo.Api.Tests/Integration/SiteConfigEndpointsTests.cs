using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

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

    [Fact]
    public async Task Update_LocalPhotos_KeepsOnlyDistinctHttpsUrls()
    {
        var configuration = _factory.Services.GetRequiredService<IConfiguration>();
        var baseDomain = configuration["Tenancy:BaseDomain"]!;

        var slug = $"siteconfig-photos-{Guid.NewGuid():N}";
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, slug, "Salón Fotos");
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenant.Id, $"admin-photos-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenant.Id));

        const string photoA = "https://res.cloudinary.com/demo/image/upload/local-a.jpg";
        const string photoB = "https://res.cloudinary.com/demo/image/upload/local-b.jpg";
        var payload = new
        {
            businessName = "Salón Fotos",
            whatsAppNumber = "",
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
            metaDescription = "",
            localPhotos = new[] { photoA, " ", "javascript:alert(1)", "http://inseguro.test/x.jpg", photoB, photoA }
        };
        var update = await client.PutAsJsonAsync("/api/siteconfig", payload);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/siteconfig");
        request.Headers.Add("X-Tenant-Host", $"{slug}.{baseDomain}");
        var response = await _factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var photos = body.GetProperty("localPhotos").EnumerateArray().Select(p => p.GetString()).ToArray();
        Assert.Equal(new[] { photoA, photoB }, photos);
    }
}
