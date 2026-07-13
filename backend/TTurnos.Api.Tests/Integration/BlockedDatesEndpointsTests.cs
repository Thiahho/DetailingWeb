using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace TTurnos.Api.Tests.Integration;

[Collection("Integration")]
public class BlockedDatesEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public BlockedDatesEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-blocked-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task GetBlockedDates_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/blockeddates");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task BlockDate_RemovesAvailableSlotsOnThatDate()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var date = DateTime.UtcNow.Date.AddDays(25);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, date.AddHours(10), date.AddHours(11));
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsJsonAsync("/api/blockeddates", new { date, reason = "Feriado" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloadedSlot = await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id);
        Assert.Null(reloadedSlot);
    }

    [Fact]
    public async Task BlockDate_Duplicate_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var date = DateTime.UtcNow.Date.AddDays(26);
        var client = await CreateAdminClientAsync(tenantId);
        await client.PostAsJsonAsync("/api/blockeddates", new { date, reason = "Feriado" });

        var response = await client.PostAsJsonAsync("/api/blockeddates", new { date, reason = "Feriado" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UnblockDate_Nonexistent_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.DeleteAsync("/api/blockeddates/999999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
