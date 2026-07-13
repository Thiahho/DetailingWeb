using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace TTurnos.Api.Tests.Integration;

// GetAll/GetById (público) excluyen Commission a propósito — dato financiero
// interno (ver auditoría sección 6, "Commission excluida deliberadamente de
// la respuesta pública"). GetAllAdmin sí la incluye. Ningún endpoint de este
// controller tiene rate limiting propio (aceptado en la auditoría, hallazgo
// c, para catálogos públicos de solo lectura).
[Collection("Integration")]
public class ProfessionalsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public ProfessionalsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-prof-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task GetAll_Public_DoesNotExposeCommission()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, commission: 15);

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/professionals");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("commission", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetById_Public_DoesNotExposeCommission()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, commission: 20);

        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/professionals/{professional.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("commission", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetAllAdmin_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/professionals/all");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetAllAdmin_AsAdmin_ExposesCommission()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, commission: 25);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.GetAsync("/api/professionals/all");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains("commission", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Create_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/professionals", new
        {
            firstName = "Nueva",
            lastName = "Persona",
            calendarColor = "#7c3aed"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithInvalidCalendarColor_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsJsonAsync("/api/professionals", new
        {
            firstName = "Nueva",
            lastName = "Persona",
            calendarColor = "not-a-color"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_AsAdmin_PersistsCommissionEvenThoughPublicEndpointsHideIt()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsJsonAsync("/api/professionals", new
        {
            firstName = "Con",
            lastName = "Comision",
            calendarColor = "#123abc",
            commission = 30
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(30, body.GetProperty("commission").GetDecimal());
    }

    [Fact]
    public async Task Delete_AsAdmin_RemovesProfessionalFromPublicListing()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var client = await CreateAdminClientAsync(tenantId);

        var deleteResponse = await client.DeleteAsync($"/api/professionals/{professional.Id}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        var getResponse = await client.GetAsync($"/api/professionals/{professional.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }
}
