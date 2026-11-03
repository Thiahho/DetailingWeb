using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Modules.HomeService.ServiceArea;

namespace Turneo.Api.Tests.Integration;

// Admin edit of a booking (PUT /api/bookings/{id}) re-runs the home-service
// policy against the resulting service, so the address/surcharge snapshot never
// gets out of sync with the service location type.
[Collection("Integration")]
public class HomeServiceBookingUpdateTests
{
    private const string OutOfCoverageMessage = "La localidad elegida está fuera de la zona de cobertura";
    private const string MissingStreetMessage = "Ingresá la dirección (calle y número) para el servicio a domicilio";
    private readonly CustomWebApplicationFactory _factory;

    public HomeServiceBookingUpdateTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // Service priced at $1000 (TestDataFactory) with the given location type.
    private async Task<Service> CreateServiceAsync(int tenantId, ServiceLocationType locationType)
    {
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, "Lavado");
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Services.IgnoreQueryFilters().Where(s => s.Id == service.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.LocationType, locationType));
        service.LocationType = locationType;
        return service;
    }

    private async Task<CoverageLocality> CreateLocalityAsync(int tenantId, decimal? surcharge, bool isActive = true)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var locality = new CoverageLocality
        {
            TenantId = tenantId,
            Name = $"Localidad-{Guid.NewGuid():N}",
            Province = "Buenos Aires",
            Surcharge = surcharge,
            IsActive = isActive
        };
        db.CoverageLocalities.Add(locality);
        await db.SaveChangesAsync();
        return locality;
    }

    private static object Address(int? localityId, string? street = "Av. Mitre 1234", string? details = "2B", string? notes = "Portón negro") =>
        new { street, details, notes, coverageLocalityId = localityId };

    private async Task<Booking> BookAsync(int tenantId, string serviceSlug, object? homeAddress)
    {
        var start = DateTime.UtcNow.AddDays(30).AddMinutes(Random.Shared.Next(1, 100_000));
        // Own professional per slot: random times of other at-home bookings in the
        // shared tenant must never fall inside the travel buffer of this one.
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1), professional.Id);
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            timeSlotId = slot.Id,
            customerName = "Cliente Domicilio",
            customerPhone = "1122334455",
            email = $"domicilio-{Guid.NewGuid():N}@test.com",
            subject = "Lavado completo",
            service = serviceSlug,
            acceptedTerms = true,
            homeAddress
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, body.GetProperty("booking").GetProperty("id").GetInt32()))!;
    }

    private async Task<HttpClient> AdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-hsu-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private Task<HttpResponseMessage> PutBookingAsync(HttpClient client, int bookingId, string serviceSlug, object? homeAddress, string customerName = "Cliente Editado") =>
        client.PutAsJsonAsync($"/api/bookings/{bookingId}", new
        {
            customerName,
            customerPhone = "1122334455",
            subject = "Lavado completo",
            service = serviceSlug,
            message = "Editado por admin",
            homeAddress
        });

    private async Task<Booking> ReloadAsync(int bookingId) =>
        (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId))!;

    private static async Task AssertBadRequestAsync(HttpResponseMessage response, string expectedMessage)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(expectedMessage, body.GetProperty("message").GetString());
    }

    private static void AssertNoSnapshot(Booking booking)
    {
        Assert.Null(booking.HomeAddressStreet);
        Assert.Null(booking.HomeAddressDetails);
        Assert.Null(booking.HomeAddressNotes);
        Assert.Null(booking.CoverageLocalityId);
        Assert.Null(booking.CoverageLocalityName);
        Assert.Null(booking.CoverageLocalityProvince);
        Assert.Null(booking.HomeServiceSurcharge);
    }

    [Fact]
    public async Task AtHomeToOnSite_ClearsSnapshotAndDropsSurcharge()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var locality = await CreateLocalityAsync(tenantId, 500m);
        var booking = await BookAsync(tenantId, atHome.Slug, Address(locality.Id));
        Assert.Equal(1500m, PaymentAmountResolver.Resolve(booking, atHome));

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, onSite.Slug, homeAddress: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReloadAsync(booking.Id);
        Assert.Equal(onSite.Slug, updated.Service);
        AssertNoSnapshot(updated);
        Assert.Equal(1000m, PaymentAmountResolver.Resolve(updated, onSite));
    }

    [Fact]
    public async Task AtHomeToOnSite_IgnoresAnAddressSentAlong()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var locality = await CreateLocalityAsync(tenantId, 500m);
        var booking = await BookAsync(tenantId, atHome.Slug, Address(locality.Id));

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, onSite.Slug, Address(locality.Id));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertNoSnapshot(await ReloadAsync(booking.Id));
    }

    [Fact]
    public async Task OnSiteToAtHome_WithoutAddress_ReturnsBadRequestAndLeavesBookingUnchanged()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var booking = await BookAsync(tenantId, onSite.Slug, homeAddress: null);

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, atHome.Slug, homeAddress: null);

        await AssertBadRequestAsync(response, MissingStreetMessage);
        var unchanged = await ReloadAsync(booking.Id);
        Assert.Equal(onSite.Slug, unchanged.Service);
        Assert.Equal("Cliente Domicilio", unchanged.CustomerName);
        Assert.Null(unchanged.Message);
        AssertNoSnapshot(unchanged);
    }

    [Fact]
    public async Task OnSiteToAtHome_WithValidAddress_StoresSnapshotAndSurcharge()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 400m);
        var booking = await BookAsync(tenantId, onSite.Slug, homeAddress: null);

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, atHome.Slug, Address(locality.Id));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReloadAsync(booking.Id);
        Assert.Equal(atHome.Slug, updated.Service);
        Assert.Equal("Av. Mitre 1234", updated.HomeAddressStreet);
        Assert.Equal("2B", updated.HomeAddressDetails);
        Assert.Equal("Portón negro", updated.HomeAddressNotes);
        Assert.Equal(locality.Id, updated.CoverageLocalityId);
        Assert.Equal(locality.Name, updated.CoverageLocalityName);
        Assert.Equal("Buenos Aires", updated.CoverageLocalityProvince);
        Assert.Equal(400m, updated.HomeServiceSurcharge);
        Assert.Equal(1400m, PaymentAmountResolver.Resolve(updated, atHome));
    }

    [Fact]
    public async Task AtHome_EditWithoutAddress_KeepsSnapshotEvenIfLocalitySurchargeChanged()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);
        var booking = await BookAsync(tenantId, atHome.Slug, Address(locality.Id));
        var renamed = $"Renombrada-{Guid.NewGuid():N}";
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.CoverageLocalities.IgnoreQueryFilters().Where(c => c.Id == locality.Id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.Surcharge, 2000m)
                    .SetProperty(c => c.Name, renamed));
        }

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, atHome.Slug, homeAddress: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReloadAsync(booking.Id);
        Assert.Equal("Cliente Editado", updated.CustomerName);
        Assert.Equal("Av. Mitre 1234", updated.HomeAddressStreet);
        Assert.Equal(locality.Name, updated.CoverageLocalityName);
        Assert.Equal(500m, updated.HomeServiceSurcharge);
        Assert.Equal(1500m, PaymentAmountResolver.Resolve(updated, atHome));
    }

    [Fact]
    public async Task AtHome_WithNewAddressInAnotherLocality_RefreshesSnapshot()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var first = await CreateLocalityAsync(tenantId, 500m);
        var second = await CreateLocalityAsync(tenantId, null);
        var booking = await BookAsync(tenantId, atHome.Slug, Address(first.Id));

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, atHome.Slug,
            Address(second.Id, street: "  Calle 9 N° 45  ", details: null, notes: "  "));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReloadAsync(booking.Id);
        Assert.Equal("Calle 9 N° 45", updated.HomeAddressStreet);
        Assert.Null(updated.HomeAddressDetails);
        Assert.Null(updated.HomeAddressNotes);
        Assert.Equal(second.Id, updated.CoverageLocalityId);
        Assert.Equal(second.Name, updated.CoverageLocalityName);
        Assert.Equal(0m, updated.HomeServiceSurcharge);
        Assert.Equal(1000m, PaymentAmountResolver.Resolve(updated, atHome));
    }

    [Fact]
    public async Task AtHome_WithForeignLocality_ReturnsBadRequestAndLeavesBookingUnchanged()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"otro-{Guid.NewGuid():N}"[..20], "Otro negocio");
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);
        var foreign = await CreateLocalityAsync(otherTenant.Id, 100m);
        var booking = await BookAsync(tenantId, atHome.Slug, Address(locality.Id));

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, atHome.Slug, Address(foreign.Id, street: "Otra 1"));

        await AssertBadRequestAsync(response, OutOfCoverageMessage);
        var unchanged = await ReloadAsync(booking.Id);
        Assert.Equal("Cliente Domicilio", unchanged.CustomerName);
        Assert.Equal("Av. Mitre 1234", unchanged.HomeAddressStreet);
        Assert.Equal(locality.Id, unchanged.CoverageLocalityId);
        Assert.Equal(500m, unchanged.HomeServiceSurcharge);
    }

    [Fact]
    public async Task OnSiteToAtHome_WithInactiveLocality_ReturnsBadRequestAndLeavesBookingUnchanged()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var inactive = await CreateLocalityAsync(tenantId, 500m, isActive: false);
        var booking = await BookAsync(tenantId, onSite.Slug, homeAddress: null);

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, atHome.Slug, Address(inactive.Id));

        await AssertBadRequestAsync(response, OutOfCoverageMessage);
        var unchanged = await ReloadAsync(booking.Id);
        Assert.Equal(onSite.Slug, unchanged.Service);
        Assert.Equal("Cliente Domicilio", unchanged.CustomerName);
        AssertNoSnapshot(unchanged);
    }
}
