using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

// A service is performed either at the business (OnSite) or at the client's
// address (AtHome). Existing services and requests that omit the field stay OnSite.
[Collection("Integration")]
public class ServiceLocationTypeTests
{
    private readonly CustomWebApplicationFactory _factory;

    public ServiceLocationTypeTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-loc-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static Dictionary<string, object?> ServicePayload(string slug, object? locationType = null)
    {
        var payload = new Dictionary<string, object?>
        {
            ["title"] = "Lavado",
            ["slug"] = slug,
            ["price"] = "5000",
            ["duration"] = "60min",
            ["imageUrl"] = "",
            ["description"] = "desc",
            ["details"] = new List<string>(),
            ["isActive"] = true
        };
        if (locationType != null) payload["locationType"] = locationType;
        return payload;
    }

    private static async Task<JsonElement> GetBySlugAsync(HttpClient client, string slug)
    {
        var response = await client.GetAsync($"/api/services/{slug}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task Create_WithoutLocationType_DefaultsToOnSite()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slug = $"onsite-{Guid.NewGuid():N}";

        var create = await admin.PostAsJsonAsync("/api/services", ServicePayload(slug));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var service = await GetBySlugAsync(_factory.CreateClient(), slug);
        Assert.Equal("OnSite", service.GetProperty("locationType").GetString());
    }

    [Fact]
    public async Task ExistingServiceRow_DefaultsToOnSite()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, $"legacy-{Guid.NewGuid():N}");

        var response = await admin.GetAsync("/api/services/all");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        var row = list!.Single(s => s.GetProperty("id").GetInt32() == service.Id);
        Assert.Equal("OnSite", row.GetProperty("locationType").GetString());
    }

    [Fact]
    public async Task Create_AsAtHome_IsReturnedByPublicAndAdminReads()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slug = $"athome-{Guid.NewGuid():N}";

        var create = await admin.PostAsJsonAsync("/api/services", ServicePayload(slug, "AtHome"));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("AtHome", created.GetProperty("locationType").GetString());

        var bySlug = await GetBySlugAsync(_factory.CreateClient(), slug);
        Assert.Equal("AtHome", bySlug.GetProperty("locationType").GetString());

        var publicList = await _factory.CreateClient().GetFromJsonAsync<List<JsonElement>>("/api/services");
        Assert.Equal("AtHome", publicList!.Single(s => s.GetProperty("slug").GetString() == slug).GetProperty("locationType").GetString());

        var adminList = await admin.GetFromJsonAsync<List<JsonElement>>("/api/services/all");
        Assert.Equal("AtHome", adminList!.Single(s => s.GetProperty("slug").GetString() == slug).GetProperty("locationType").GetString());
    }

    [Fact]
    public async Task Update_ChangesLocationType()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slug = $"switch-{Guid.NewGuid():N}";
        var create = await admin.PostAsJsonAsync("/api/services", ServicePayload(slug));
        var id = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var update = await admin.PutAsJsonAsync($"/api/services/{id}", ServicePayload(slug, "AtHome"));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var service = await GetBySlugAsync(_factory.CreateClient(), slug);
        Assert.Equal("AtHome", service.GetProperty("locationType").GetString());
    }

    [Fact]
    public async Task Create_WithUnknownLocationType_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync("/api/services", ServicePayload($"bad-{Guid.NewGuid():N}", 7));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
