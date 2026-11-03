using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

// Admin management of the localities a tenant covers for at-home services.
[Collection("Integration")]
public class CoverageLocalitiesEndpointsTests
{
    private const string BaseUrl = "/api/home-service/coverage-localities";
    private readonly CustomWebApplicationFactory _factory;

    public CoverageLocalitiesEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-cov-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static object Payload(string name, string province = "Buenos Aires", decimal? surcharge = null,
        string? georefId = null, bool isActive = true) => new
    {
        name,
        province,
        georefId,
        surcharge,
        isActive
    };

    private static string UniqueName(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    private static async Task<int> CreateAsync(HttpClient client, object payload)
    {
        var response = await client.PostAsJsonAsync(BaseUrl, payload);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private static async Task<List<JsonElement>> ListAsync(HttpClient client)
    {
        var response = await client.GetAsync(BaseUrl);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<JsonElement>>())!;
    }

    [Fact]
    public async Task Create_AsAdmin_ReturnsLocalityAndListsIt()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var name = UniqueName("Quilmes");

        var response = await admin.PostAsJsonAsync(BaseUrl, Payload(name, surcharge: 1500.50m, georefId: "06658010000"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(name, created.GetProperty("name").GetString());
        Assert.Equal("Buenos Aires", created.GetProperty("province").GetString());
        Assert.Equal("06658010000", created.GetProperty("georefId").GetString());
        Assert.Equal(1500.50m, created.GetProperty("surcharge").GetDecimal());
        Assert.True(created.GetProperty("isActive").GetBoolean());

        var list = await ListAsync(admin);
        Assert.Contains(list, l => l.GetProperty("name").GetString() == name);
    }

    [Fact]
    public async Task Create_WithoutSurchargeOrGeorefId_StoresNulls()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var name = UniqueName("Bernal");

        var id = await CreateAsync(admin, Payload(name));

        var row = (await ListAsync(admin)).Single(l => l.GetProperty("id").GetInt32() == id);
        Assert.Equal(JsonValueKind.Null, row.GetProperty("surcharge").ValueKind);
        Assert.Equal(JsonValueKind.Null, row.GetProperty("georefId").ValueKind);
    }

    [Fact]
    public async Task Update_AsAdmin_ChangesFields()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var id = await CreateAsync(admin, Payload(UniqueName("Lanus")));
        var newName = UniqueName("Lanus Oeste");

        var response = await admin.PutAsJsonAsync($"{BaseUrl}/{id}", Payload(newName, "Buenos Aires", 800m, isActive: false));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var row = (await ListAsync(admin)).Single(l => l.GetProperty("id").GetInt32() == id);
        Assert.Equal(newName, row.GetProperty("name").GetString());
        Assert.Equal(800m, row.GetProperty("surcharge").GetDecimal());
        Assert.False(row.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Delete_AsAdmin_RemovesLocality()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var id = await CreateAsync(admin, Payload(UniqueName("Temperley")));

        var response = await admin.DeleteAsync($"{BaseUrl}/{id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.DoesNotContain(await ListAsync(admin), l => l.GetProperty("id").GetInt32() == id);
    }

    [Fact]
    public async Task UpdateOrDelete_UnknownId_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var update = await admin.PutAsJsonAsync($"{BaseUrl}/999999", Payload(UniqueName("Nada")));
        var delete = await admin.DeleteAsync($"{BaseUrl}/999999");

        Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
    }

    [Theory]
    [InlineData("", "Buenos Aires", null)]
    [InlineData("   ", "Buenos Aires", null)]
    [InlineData("Adrogue", "", null)]
    [InlineData("Adrogue", "Buenos Aires", -1)]
    public async Task Create_WithInvalidInput_ReturnsBadRequest(string name, string province, int? surcharge)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync(BaseUrl, Payload(name, province, surcharge));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_DuplicateLocalityInSameTenant_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var name = UniqueName("Banfield");
        await CreateAsync(admin, Payload(name));

        // Same locality with different casing and surrounding spaces is still a duplicate.
        var response = await admin.PostAsJsonAsync(BaseUrl, Payload($"  {name.ToUpperInvariant()} ", "buenos aires"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_DuplicateDifferingOnlyInCase_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var name = $"Moron-{Guid.NewGuid():N}";
        await CreateAsync(admin, Payload(name));

        var response = await admin.PostAsJsonAsync(BaseUrl, Payload(name.ToLowerInvariant()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_DuplicateGeorefIdInSameTenant_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var georefId = Guid.NewGuid().ToString("N")[..11];
        await CreateAsync(admin, Payload(UniqueName("Wilde"), georefId: georefId));

        var response = await admin.PostAsJsonAsync(BaseUrl, Payload(UniqueName("Wilde Este"), georefId: georefId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_ToNameOfAnotherLocality_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var existingName = UniqueName("Avellaneda");
        await CreateAsync(admin, Payload(existingName));
        var otherId = await CreateAsync(admin, Payload(UniqueName("Sarandi")));

        var response = await admin.PutAsJsonAsync($"{BaseUrl}/{otherId}", Payload(existingName));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_KeepingOwnName_Succeeds()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var name = UniqueName("Lomas");
        var id = await CreateAsync(admin, Payload(name, georefId: "06490010000"));

        var response = await admin.PutAsJsonAsync($"{BaseUrl}/{id}", Payload(name, surcharge: 100m, georefId: "06490010000"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SameLocality_InDifferentTenants_IsAllowed()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-cov-{Guid.NewGuid():N}", "Detailing B")).Id;
        var adminA = await CreateAdminClientAsync(tenantA);
        var adminB = await CreateAdminClientAsync(tenantB);
        var name = UniqueName("Moron");

        await CreateAsync(adminA, Payload(name));
        var response = await adminB.PostAsJsonAsync(BaseUrl, Payload(name));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task OtherTenant_CannotListUpdateOrDeleteLocality()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-cov-{Guid.NewGuid():N}", "Detailing B")).Id;
        var adminA = await CreateAdminClientAsync(tenantA);
        var adminB = await CreateAdminClientAsync(tenantB);
        var nameB = UniqueName("Ituzaingo");
        var idB = await CreateAsync(adminB, Payload(nameB));

        Assert.DoesNotContain(await ListAsync(adminA), l => l.GetProperty("name").GetString() == nameB);

        var update = await adminA.PutAsJsonAsync($"{BaseUrl}/{idB}", Payload(UniqueName("Hijacked")));
        var delete = await adminA.DeleteAsync($"{BaseUrl}/{idB}");
        Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);

        var rowB = (await ListAsync(adminB)).Single(l => l.GetProperty("id").GetInt32() == idB);
        Assert.Equal(nameB, rowB.GetProperty("name").GetString());
    }

    [Fact]
    public async Task AllEndpoints_WithoutToken_ReturnUnauthorized()
    {
        var client = _factory.CreateClient();

        var list = await client.GetAsync(BaseUrl);
        var create = await client.PostAsJsonAsync(BaseUrl, Payload(UniqueName("Anon")));
        var update = await client.PutAsJsonAsync($"{BaseUrl}/1", Payload(UniqueName("Anon")));
        var delete = await client.DeleteAsync($"{BaseUrl}/1");

        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, create.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, update.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, delete.StatusCode);
    }

    [Fact]
    public async Task NonAdminRoles_AreForbidden()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var existingId = await CreateAsync(admin, Payload(UniqueName("Glew")));
        var staff = await TestDataFactory.CreateStaffUserAsync(_factory, tenantId, $"staff-cov-{Guid.NewGuid():N}@test.com", "Password123");
        var staffClient = _factory.CreateClient();
        staffClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, staff.Id, staff.Email, "Staff", tenantId));

        var list = await staffClient.GetAsync(BaseUrl);
        var create = await staffClient.PostAsJsonAsync(BaseUrl, Payload(UniqueName("Staff")));
        var update = await staffClient.PutAsJsonAsync($"{BaseUrl}/{existingId}", Payload(UniqueName("Staff")));
        var delete = await staffClient.DeleteAsync($"{BaseUrl}/{existingId}");

        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, update.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
        Assert.Contains(await ListAsync(admin), l => l.GetProperty("id").GetInt32() == existingId);
    }
}
