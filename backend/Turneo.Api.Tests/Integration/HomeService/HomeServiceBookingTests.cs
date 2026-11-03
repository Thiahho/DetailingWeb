using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Modules.HomeService.ServiceArea;

namespace Turneo.Api.Tests.Integration;

// Public booking of an at-home service: the client's address must fall inside
// the tenant's coverage localities, and the locality surcharge is frozen on the
// booking and charged on top of the service/promotion price.
[Collection("Integration")]
public class HomeServiceBookingTests
{
    private const string PublicLocalitiesUrl = "/api/home-service/coverage-localities/active";
    private readonly CustomWebApplicationFactory _factory;

    public HomeServiceBookingTests(CustomWebApplicationFactory factory)
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

    private async Task<int> CreateSlotAsync(int tenantId, int? professionalId = null)
    {
        // Own professional per slot: random times of other at-home bookings in the
        // shared tenant must never fall inside the travel buffer of this one.
        professionalId ??= (await TestDataFactory.CreateProfessionalAsync(_factory, tenantId)).Id;
        var start = DateTime.UtcNow.AddDays(30).AddMinutes(Random.Shared.Next(1, 100_000));
        return (await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1), professionalId)).Id;
    }

    private Task<HttpResponseMessage> PostBookingAsync(int slotId, string serviceSlug, object? homeAddress, int? professionalId = null) =>
        _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            timeSlotId = slotId,
            customerName = "Cliente Domicilio",
            customerPhone = "1122334455",
            email = $"domicilio-{Guid.NewGuid():N}@test.com",
            subject = "Lavado completo",
            service = serviceSlug,
            professionalId,
            acceptedTerms = true,
            homeAddress
        });

    private static object Address(int? localityId, string? street = "Av. Mitre 1234", string? details = "2B", string? notes = "Portón negro") =>
        new { street, details, notes, coverageLocalityId = localityId };

    private async Task<Booking> BookOkAsync(int slotId, string serviceSlug, object? homeAddress, int? professionalId = null)
    {
        var response = await PostBookingAsync(slotId, serviceSlug, homeAddress, professionalId);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, body.GetProperty("booking").GetProperty("id").GetInt32()))!;
    }

    private static async Task AssertBadRequestAsync(HttpResponseMessage response, string expectedMessage)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(expectedMessage, body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task AtHome_WithActiveLocality_StoresAddressSnapshotAndSurcharge()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);

        var booking = await BookOkAsync(await CreateSlotAsync(tenantId), service.Slug, Address(locality.Id));

        Assert.Equal("Av. Mitre 1234", booking.HomeAddressStreet);
        Assert.Equal("2B", booking.HomeAddressDetails);
        Assert.Equal("Portón negro", booking.HomeAddressNotes);
        Assert.Equal(locality.Id, booking.CoverageLocalityId);
        Assert.Equal(locality.Name, booking.CoverageLocalityName);
        Assert.Equal("Buenos Aires", booking.CoverageLocalityProvince);
        Assert.Equal(500m, booking.HomeServiceSurcharge);
        Assert.Equal(1500m, PaymentAmountResolver.Resolve(booking, service));
    }

    [Fact]
    public async Task AtHome_WithLocalityWithoutSurcharge_StoresZeroSurcharge()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, null);

        var booking = await BookOkAsync(await CreateSlotAsync(tenantId), service.Slug, Address(locality.Id, details: null, notes: null));

        Assert.Equal(0m, booking.HomeServiceSurcharge);
        Assert.Null(booking.HomeAddressDetails);
        Assert.Null(booking.HomeAddressNotes);
        Assert.Equal(1000m, PaymentAmountResolver.Resolve(booking, service));
    }

    [Fact]
    public async Task AtHome_WithoutAddress_ReturnsBadRequestAndKeepsSlotAvailable()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var slotId = await CreateSlotAsync(tenantId);

        var response = await PostBookingAsync(slotId, service.Slug, homeAddress: null);

        await AssertBadRequestAsync(response, "Ingresá la dirección (calle y número) para el servicio a domicilio");
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slotId))!.IsAvailable);
    }

    [Fact]
    public async Task AtHome_WithBlankStreet_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);

        var response = await PostBookingAsync(await CreateSlotAsync(tenantId), service.Slug, Address(locality.Id, street: "   "));

        await AssertBadRequestAsync(response, "Ingresá la dirección (calle y número) para el servicio a domicilio");
    }

    [Fact]
    public async Task AtHome_WithoutLocality_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);

        var response = await PostBookingAsync(await CreateSlotAsync(tenantId), service.Slug, Address(localityId: null));

        await AssertBadRequestAsync(response, "Elegí la localidad del servicio a domicilio");
    }

    [Fact]
    public async Task AtHome_WithTooLongAddress_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);

        var response = await PostBookingAsync(await CreateSlotAsync(tenantId), service.Slug, Address(locality.Id, notes: new string('x', 501)));

        await AssertBadRequestAsync(response, "La dirección supera el largo permitido");
    }

    [Fact]
    public async Task AtHome_WithInactiveLocality_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m, isActive: false);
        var slotId = await CreateSlotAsync(tenantId);

        var response = await PostBookingAsync(slotId, service.Slug, Address(locality.Id));

        await AssertBadRequestAsync(response, "La localidad elegida está fuera de la zona de cobertura");
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slotId))!.IsAvailable);
    }

    [Fact]
    public async Task AtHome_WithOtherTenantsLocality_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"otro-{Guid.NewGuid():N}"[..20], "Otro negocio");
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var foreignLocality = await CreateLocalityAsync(otherTenant.Id, 500m);

        var response = await PostBookingAsync(await CreateSlotAsync(tenantId), service.Slug, Address(foreignLocality.Id));

        await AssertBadRequestAsync(response, "La localidad elegida está fuera de la zona de cobertura");
    }

    [Fact]
    public async Task AtHome_WithUnknownLocality_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);

        var response = await PostBookingAsync(await CreateSlotAsync(tenantId), service.Slug, Address(int.MaxValue));

        await AssertBadRequestAsync(response, "La localidad elegida está fuera de la zona de cobertura");
    }

    [Fact]
    public async Task OnSite_IgnoresAddressAndKeepsPrice()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"otro-{Guid.NewGuid():N}"[..20], "Otro negocio");
        var foreignLocality = await CreateLocalityAsync(otherTenant.Id, 500m);

        // Even an address that would be rejected for an at-home service is ignored.
        var booking = await BookOkAsync(await CreateSlotAsync(tenantId), service.Slug, Address(foreignLocality.Id, street: ""));

        Assert.Null(booking.HomeAddressStreet);
        Assert.Null(booking.CoverageLocalityId);
        Assert.Null(booking.CoverageLocalityName);
        Assert.Null(booking.HomeServiceSurcharge);
        Assert.Null(booking.FinalPrice);
        Assert.Equal(1000m, PaymentAmountResolver.Resolve(booking, service));
    }

    [Fact]
    public async Task AtHome_WithPromotion_ChargesPromotionPricePlusSurcharge()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Promotions.Add(new Promotion
            {
                TenantId = tenantId,
                ProfessionalId = professional.Id,
                Name = "20% off",
                DiscountType = PromotionDiscountType.Percent,
                Value = 20,
                ServiceIds = new List<int> { service.Id },
                StartsAt = DateTime.UtcNow.AddDays(-1),
                EndsAt = DateTime.UtcNow.AddDays(7),
                IsActive = true
            });
            await db.SaveChangesAsync();
        }

        var booking = await BookOkAsync(await CreateSlotAsync(tenantId, professional.Id), service.Slug, Address(locality.Id), professional.Id);

        Assert.NotNull(booking.PromotionId);
        Assert.Equal(800m, booking.FinalPrice);
        Assert.Equal(500m, booking.HomeServiceSurcharge);
        Assert.Equal(1300m, PaymentAmountResolver.Resolve(booking, service));
    }

    [Fact]
    public async Task LaterLocalityChanges_DoNotAlterExistingBooking()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);
        var booking = await BookOkAsync(await CreateSlotAsync(tenantId), service.Slug, Address(locality.Id));

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.CoverageLocalities.IgnoreQueryFilters().Where(c => c.Id == locality.Id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.Surcharge, 2000m)
                    .SetProperty(c => c.Name, "Renombrada")
                    .SetProperty(c => c.IsActive, false));
        }

        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(500m, reloaded!.HomeServiceSurcharge);
        Assert.Equal(locality.Name, reloaded.CoverageLocalityName);
        Assert.Equal(1500m, PaymentAmountResolver.Resolve(reloaded, service));
    }

    [Fact]
    public async Task AdminBookingsList_ExposesHomeServiceSnapshot()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var service = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 750m);
        var booking = await BookOkAsync(await CreateSlotAsync(tenantId), service.Slug, Address(locality.Id));

        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-hs-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));

        var response = await client.GetAsync("/api/bookings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        var item = list!.Single(b => b.GetProperty("id").GetInt32() == booking.Id);
        var address = item.GetProperty("homeServiceAddress");
        Assert.Equal("Av. Mitre 1234", address.GetProperty("street").GetString());
        Assert.Equal("2B", address.GetProperty("details").GetString());
        Assert.Equal("Portón negro", address.GetProperty("notes").GetString());
        Assert.Equal(locality.Id, address.GetProperty("coverageLocalityId").GetInt32());
        Assert.Equal(locality.Name, address.GetProperty("localityName").GetString());
        Assert.Equal("Buenos Aires", address.GetProperty("province").GetString());
        Assert.Equal(750m, address.GetProperty("surcharge").GetDecimal());
    }

    [Fact]
    public async Task PublicLocalities_ListsOnlyActiveLocalitiesOfCurrentTenant()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var active = await CreateLocalityAsync(tenantId, 300m);
        var inactive = await CreateLocalityAsync(tenantId, 300m, isActive: false);
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"otro-{Guid.NewGuid():N}"[..20], "Otro negocio");
        var foreign = await CreateLocalityAsync(otherTenant.Id, 300m);

        var response = await _factory.CreateClient().GetAsync(PublicLocalitiesUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = (await response.Content.ReadFromJsonAsync<List<JsonElement>>())!;
        var ids = list.Select(l => l.GetProperty("id").GetInt32()).ToList();
        Assert.Contains(active.Id, ids);
        Assert.DoesNotContain(inactive.Id, ids);
        Assert.DoesNotContain(foreign.Id, ids);

        var item = list.Single(l => l.GetProperty("id").GetInt32() == active.Id);
        Assert.Equal(active.Name, item.GetProperty("name").GetString());
        Assert.Equal("Buenos Aires", item.GetProperty("province").GetString());
        Assert.Equal(300m, item.GetProperty("surcharge").GetDecimal());
        Assert.False(item.TryGetProperty("isActive", out _));
        Assert.False(item.TryGetProperty("tenantId", out _));
    }

    [Fact]
    public async Task PublicLocalities_ResolvesTenantFromHost()
    {
        var legacyTenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var legacyLocality = await CreateLocalityAsync(legacyTenantId, null);
        var slug = $"cov-host-{Guid.NewGuid():N}"[..20];
        var tenantB = await TestDataFactory.CreateTenantAsync(_factory, slug, "Lavadero B");
        var localityB = await CreateLocalityAsync(tenantB.Id, null);
        var baseDomain = _factory.Services.GetRequiredService<IConfiguration>()["Tenancy:BaseDomain"]!;

        var request = new HttpRequestMessage(HttpMethod.Get, PublicLocalitiesUrl);
        request.Headers.Add("X-Tenant-Host", $"{slug}.{baseDomain}");
        var response = await _factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = (await response.Content.ReadFromJsonAsync<List<JsonElement>>())!;
        var only = Assert.Single(list);
        Assert.Equal(localityB.Id, only.GetProperty("id").GetInt32());
        Assert.Equal(JsonValueKind.Null, only.GetProperty("surcharge").ValueKind);
        Assert.NotEqual(legacyLocality.Id, only.GetProperty("id").GetInt32());
    }
}
