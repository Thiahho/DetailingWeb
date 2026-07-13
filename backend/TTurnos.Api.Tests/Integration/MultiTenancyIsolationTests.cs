using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace TTurnos.Api.Tests.Integration;

// Cubre el pilar más nuevo y riesgoso del sistema (ver ADR-002/003): el query
// filter global por TenantId en ApplicationDbContext. Antes de esta suite no
// había ni un test verificando que un tenant no pueda ver datos de otro.
[Collection("Integration")]
public class MultiTenancyIsolationTests
{
    private readonly CustomWebApplicationFactory _factory;

    public MultiTenancyIsolationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetAllBookings_AsAdmin_OnlyReturnsBookingsFromOwnTenant()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-b-{Guid.NewGuid():N}", "Salón B")).Id;

        var slotA = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantA, DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(1));
        var bookingA = await TestDataFactory.CreateBookingAsync(_factory, tenantA, slotA.Id, "Cliente Tenant A", $"a-{Guid.NewGuid():N}@test.com");

        var slotB = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantB, DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(1));
        await TestDataFactory.CreateBookingAsync(_factory, tenantB, slotB.Id, "Cliente Tenant B", $"b-{Guid.NewGuid():N}@test.com");

        var adminA = await TestDataFactory.CreateAdminUserAsync(_factory, tenantA, $"admin-a-{Guid.NewGuid():N}@test.com", "Password123");
        var tokenA = TestJwtFactory.CreateToken(_factory, adminA.Id, adminA.Email, "Admin", tenantA);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenA);

        var response = await client.GetAsync("/api/bookings");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var results = await response.Content.ReadFromJsonAsync<List<System.Text.Json.JsonElement>>();
        var names = results!.Select(r => r.GetProperty("customerName").GetString()).ToList();

        Assert.Contains("Cliente Tenant A", names);
        Assert.DoesNotContain("Cliente Tenant B", names);
    }

    [Fact]
    public async Task GetBooking_FromAnotherTenant_ReturnsNotFoundEvenForAdmin()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-b-{Guid.NewGuid():N}", "Salón B")).Id;

        var slotB = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantB, DateTime.UtcNow.AddDays(11), DateTime.UtcNow.AddDays(11).AddHours(1));
        var bookingB = await TestDataFactory.CreateBookingAsync(_factory, tenantB, slotB.Id, "Cliente Tenant B", $"b-{Guid.NewGuid():N}@test.com");

        var adminA = await TestDataFactory.CreateAdminUserAsync(_factory, tenantA, $"admin-a-{Guid.NewGuid():N}@test.com", "Password123");
        var tokenA = TestJwtFactory.CreateToken(_factory, adminA.Id, adminA.Email, "Admin", tenantA);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenA);

        // El admin de Tenant A es Admin (rol con permiso de ver cualquier booking
        // de SU tenant), pero el query filter global excluye la fila de Tenant B
        // antes de que el controller llegue a evaluar el rol — por eso 404, no 403.
        var response = await client.GetAsync($"/api/bookings/{bookingB.Id}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetAllAdminProfessionals_OnlyReturnsOwnTenant()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-b-{Guid.NewGuid():N}", "Salón B")).Id;

        await TestDataFactory.CreateProfessionalAsync(_factory, tenantA, firstName: "ProfesionalA");
        await TestDataFactory.CreateProfessionalAsync(_factory, tenantB, firstName: "ProfesionalB");

        var adminA = await TestDataFactory.CreateAdminUserAsync(_factory, tenantA, $"admin-prof-a-{Guid.NewGuid():N}@test.com", "Password123");
        var tokenA = TestJwtFactory.CreateToken(_factory, adminA.Id, adminA.Email, "Admin", tenantA);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenA);

        var response = await client.GetAsync("/api/professionals/all");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var results = await response.Content.ReadFromJsonAsync<List<System.Text.Json.JsonElement>>();
        var names = results!.Select(r => r.GetProperty("firstName").GetString()).ToList();

        Assert.Contains("ProfesionalA", names);
        Assert.DoesNotContain("ProfesionalB", names);
    }

    [Fact]
    public async Task SameEmail_CanHaveIndependentAdminAccountsInDifferentTenants()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-b-{Guid.NewGuid():N}", "Salón B")).Id;
        var sharedEmail = $"shared-{Guid.NewGuid():N}@test.com";

        var userA = await TestDataFactory.CreateAdminUserAsync(_factory, tenantA, sharedEmail, "PasswordA123");
        var userB = await TestDataFactory.CreateAdminUserAsync(_factory, tenantB, sharedEmail, "PasswordB123");

        Assert.NotEqual(userA.Id, userB.Id);
    }

    [Fact]
    public async Task PublicBookingCreation_ResolvesTenantFromXTenantHostHeader()
    {
        var configuration = _factory.Services.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
        var baseDomain = configuration["Tenancy:BaseDomain"]!;
        var slug = $"tenant-host-{Guid.NewGuid():N}";
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, slug, "Salón por Host")).Id;
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantB, DateTime.UtcNow.AddDays(12), DateTime.UtcNow.AddDays(12).AddHours(1));

        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/bookings")
        {
            Content = JsonContent.Create(new
            {
                timeSlotId = slot.Id,
                customerName = "Cliente Via Host",
                customerPhone = "1122334455",
                email = $"via-host-{Guid.NewGuid():N}@test.com",
                subject = "Corte de pelo"
            })
        };
        request.Headers.Add("X-Tenant-Host", $"{slug}.{baseDomain}");

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // La reserva marcó el slot ocupado y sigue perteneciendo al tenant del
        // header, no al tenant default ("legacy") — confirma que el header
        // efectivamente gobernó la resolución, no el fallback.
        var reloadedSlot = await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id);
        Assert.False(reloadedSlot!.IsAvailable);
        Assert.Equal(tenantB, reloadedSlot.TenantId);
    }
}
