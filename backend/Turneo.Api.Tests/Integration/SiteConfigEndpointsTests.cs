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

    // Tenant nuevo + cliente admin autenticado + host para leer su config pública.
    private async Task<(HttpClient Client, string TenantHost)> CreateAdminClientAsync(string prefix)
    {
        var configuration = _factory.Services.GetRequiredService<IConfiguration>();
        var baseDomain = configuration["Tenancy:BaseDomain"]!;

        var slug = $"{prefix}-{Guid.NewGuid():N}";
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, slug, "Salón Redes");
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenant.Id, $"admin-{prefix}-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenant.Id));

        return (client, $"{slug}.{baseDomain}");
    }

    private static object SiteConfigPayloadWithLinks(object[] socialLinks) => new
    {
        businessName = "Salón Redes",
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
        socialLinks
    };

    // Guarda los links por PUT y devuelve lo que expone el GET público, como (name, url).
    private async Task<(string? Name, string? Url)[]> SaveAndReadSocialLinksAsync(string prefix, object[] socialLinks)
    {
        var (client, tenantHost) = await CreateAdminClientAsync(prefix);
        var update = await client.PutAsJsonAsync("/api/siteconfig", SiteConfigPayloadWithLinks(socialLinks));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        return await ReadSocialLinksAsync(tenantHost);
    }

    private async Task<(string? Name, string? Url)[]> ReadSocialLinksAsync(string tenantHost)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/siteconfig");
        request.Headers.Add("X-Tenant-Host", tenantHost);
        var response = await _factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("socialLinks").EnumerateArray()
            .Select(l => (l.GetProperty("name").GetString(), l.GetProperty("url").GetString()))
            .ToArray();
    }

    [Fact]
    public async Task Update_SocialLinks_RoundTripTrimmedAndInOrder()
    {
        var links = await SaveAndReadSocialLinksAsync("redes-orden", new object[]
        {
            new { name = "TikTok", url = "https://www.tiktok.com/@salon" },
            new { name = "  Facebook  ", url = "  https://facebook.com/salon  " },
            new { name = "YouTube", url = "https://youtube.com/@salon" }
        });

        Assert.Equal(new (string?, string?)[]
        {
            ("TikTok", "https://www.tiktok.com/@salon"),
            ("Facebook", "https://facebook.com/salon"),
            ("YouTube", "https://youtube.com/@salon")
        }, links);
    }

    [Fact]
    public async Task Update_SocialLinks_DropsNonHttpsAndMalformedUrls()
    {
        var links = await SaveAndReadSocialLinksAsync("redes-esquema", new object[]
        {
            new { name = "Script", url = "javascript:alert(1)" },
            new { name = "Inseguro", url = "http://inseguro.test/perfil" },
            new { name = "Data", url = "data:text/html,<script>alert(1)</script>" },
            new { name = "Relativa", url = "/perfil" },
            new { name = "Sin esquema", url = "facebook.com/salon" },
            new { name = "Sin barras", url = "https:facebook.com/salon" },
            new { name = "Facebook", url = "https://facebook.com/salon" }
        });

        Assert.Equal(new (string?, string?)[] { ("Facebook", "https://facebook.com/salon") }, links);
    }

    [Fact]
    public async Task Update_SocialLinks_DropsEmptyOrTooLongFields()
    {
        var links = await SaveAndReadSocialLinksAsync("redes-vacios", new object[]
        {
            new { name = "", url = "https://facebook.com/sin-nombre" },
            new { name = "   ", url = "https://facebook.com/solo-espacios" },
            new { name = (string?)null, url = "https://facebook.com/nombre-null" },
            new { name = "Sin link", url = "" },
            new { name = new string('n', 41), url = "https://facebook.com/nombre-largo" },
            new { name = "Link largo", url = "https://facebook.com/" + new string('u', 300) },
            new { name = new string('n', 40), url = "https://facebook.com/justo" }
        });

        Assert.Equal(new (string?, string?)[] { (new string('n', 40), "https://facebook.com/justo") }, links);
    }

    [Fact]
    public async Task Update_SocialLinks_CollapsesDuplicateUrlsKeepingTheFirst()
    {
        var links = await SaveAndReadSocialLinksAsync("redes-duplicados", new object[]
        {
            new { name = "Facebook", url = "https://facebook.com/Salon" },
            new { name = "Face repetido", url = "https://facebook.com/salon" },
            new { name = "TikTok", url = "https://www.tiktok.com/@salon" },
            new { name = "Face otra vez", url = "https://facebook.com/Salon" }
        });

        Assert.Equal(new (string?, string?)[]
        {
            ("Facebook", "https://facebook.com/Salon"),
            ("TikTok", "https://www.tiktok.com/@salon")
        }, links);
    }

    [Fact]
    public async Task Update_SocialLinks_KeepsAtMostTwelve()
    {
        var sent = Enumerable.Range(1, 15)
            .Select(i => (object)new { name = $"Red {i}", url = $"https://example.com/red-{i}" })
            .ToArray();

        var links = await SaveAndReadSocialLinksAsync("redes-tope", sent);

        Assert.Equal(12, links.Length);
        Assert.Equal(("Red 1", "https://example.com/red-1"), links[0]);
        Assert.Equal(("Red 12", "https://example.com/red-12"), links[11]);
    }

    [Fact]
    public async Task Update_WithoutSocialLinks_SucceedsAndReturnsEmptyList()
    {
        var (client, tenantHost) = await CreateAdminClientAsync("redes-omitidas");

        // Un cliente viejo (o el seed de e2e) no manda el campo: tiene que seguir andando.
        var update = await client.PutAsJsonAsync("/api/siteconfig", SiteConfigPayload("Salón sin redes"));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        Assert.Empty(await ReadSocialLinksAsync(tenantHost));
    }
}
