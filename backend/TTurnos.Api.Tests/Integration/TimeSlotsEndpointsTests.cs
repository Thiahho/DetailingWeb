using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace TTurnos.Api.Tests.Integration;

// El caller nunca controla professionalId "para sí mismo" — CallerProfessionalId()
// lee el claim del JWT, no el body. Es la única línea de defensa contra que un
// profesional cree/edite turnos a nombre de otro.
[Collection("Integration")]
public class TimeSlotsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public TimeSlotsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateProfessionalClientAsync(int tenantId, int professionalId)
    {
        var user = await TestDataFactory.CreateProfessionalUserAsync(_factory, tenantId, professionalId, $"prof-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, user.Id, user.Email, "Professional", tenantId, professionalId));
        return client;
    }

    [Fact]
    public async Task GetAvailableSlots_Public_OnlyReturnsFutureAvailableSlots()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var futureSlot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(30), DateTime.UtcNow.AddDays(30).AddHours(1));
        var pastSlot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(-30).AddHours(1));

        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/timeslots/available");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var results = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        var ids = results!.Select(r => r.GetProperty("id").GetInt32()).ToList();

        Assert.Contains(futureSlot.Id, ids);
        Assert.DoesNotContain(pastSlot.Id, ids);
    }

    [Fact]
    public async Task GetAllSlots_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/timeslots");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateSlot_AsProfessional_IgnoresProfessionalIdFromBody()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var owner = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, firstName: "Dueño");
        var impersonated = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, firstName: "Suplantado");
        var client = await CreateProfessionalClientAsync(tenantId, owner.Id);

        var response = await client.PostAsJsonAsync("/api/timeslots", new
        {
            startDateTime = DateTime.UtcNow.AddDays(15),
            endDateTime = DateTime.UtcNow.AddDays(15).AddHours(1),
            professionalId = impersonated.Id
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(owner.Id, body.GetProperty("slot").GetProperty("professionalId").GetInt32());
    }

    [Fact]
    public async Task CreateSlot_WithPastDate_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var client = await CreateProfessionalClientAsync(tenantId, professional.Id);

        var response = await client.PostAsJsonAsync("/api/timeslots", new
        {
            startDateTime = DateTime.UtcNow.AddDays(-1),
            endDateTime = DateTime.UtcNow.AddHours(1)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateSlot_ByDifferentProfessional_ReturnsForbidden()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var owner = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var intruder = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(16), DateTime.UtcNow.AddDays(16).AddHours(1), owner.Id);
        var client = await CreateProfessionalClientAsync(tenantId, intruder.Id);

        var response = await client.PutAsJsonAsync($"/api/timeslots/{slot.Id}", new
        {
            startDateTime = DateTime.UtcNow.AddDays(17)
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteSlot_ThatIsReserved_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(18), DateTime.UtcNow.AddDays(18).AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-del-slot-{Guid.NewGuid():N}@test.com", "Password123");

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));

        var response = await client.DeleteAsync($"/api/timeslots/{slot.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
