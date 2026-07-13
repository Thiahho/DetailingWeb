using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace TTurnos.Api.Tests.Integration;

[Collection("Integration")]
public class RemindersEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public RemindersEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-reminders-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task GetReminders_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/reminders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateCustomer_AsAdmin_ReturnsCreated()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsJsonAsync("/api/reminders/customers", new
        {
            phone = $"11{Guid.NewGuid():N}".Substring(0, 12),
            name = "Cliente Recordatorio",
            email = (string?)null,
            notes = (string?)null
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomer_Nonexistent_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.GetAsync("/api/reminders/customers/999999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateReminder_ForNonexistentProfile_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsJsonAsync("/api/reminders", new
        {
            customerProfileId = 999999999,
            bookingId = (int?)null,
            serviceLabel = "Corte",
            scheduledFor = DateTime.UtcNow.AddDays(1),
            intervalDays = (int?)null,
            messageTemplate = (string?)null
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CancelReminder_Nonexistent_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsync("/api/reminders/999999999/cancel", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
