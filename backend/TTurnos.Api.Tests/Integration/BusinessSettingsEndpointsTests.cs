using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace TTurnos.Api.Tests.Integration;

// UpdateSettings dispara TimeSlotGeneratorService.RegenerateAllSlotsAsync.
// Su bucle interno (GenerateSlotsForDayAsync) tenía un bug de loop infinito
// (currentTime a ambos lados de la comparación del while, se cancelaba
// algebraicamente) — corregido en TimeSlotGeneratorService.cs. Cada test
// usa un tenant nuevo (no "legacy") para no pisar el fixture de otras
// clases que comparten el mismo contenedor.
[Collection("Integration")]
public class BusinessSettingsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public BusinessSettingsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-settings-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task GetSettings_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/businesssettings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSettings_ForTenantWithoutConfig_ReturnsNotFound()
    {
        var tenantId = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-settings-{Guid.NewGuid():N}", "Salón Sin Config")).Id;
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.GetAsync("/api/businesssettings");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateSettings_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PutAsJsonAsync("/api/businesssettings", new
        {
            daysOfWeek = new[] { 1, 2, 3, 4, 5 },
            startTime = "09:00",
            slotDuration = 60,
            breakBetweenSlots = 0,
            maxDaysInAdvance = 3
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateSettings_CreatesConfigAndRegeneratesSlots()
    {
        var tenantId = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-settings-{Guid.NewGuid():N}", "Salón Nuevo")).Id;
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PutAsJsonAsync("/api/businesssettings", new
        {
            daysOfWeek = new[] { 1, 2, 3, 4, 5 },
            startTime = "09:00",
            slotDuration = 60,
            breakBetweenSlots = 0,
            maxDaysInAdvance = 3
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var getResponse = await client.GetAsync("/api/businesssettings");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(60, body.GetProperty("slotDuration").GetInt32());
    }
}
