using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Modules.HomeService.ServiceArea;

namespace Turneo.Api.Tests.Integration;

// Travel buffer between at-home bookings of the same professional: available
// slots for an at-home service hide the ones that leave less than the buffer
// (business setting, default 30 min) before or after another active at-home
// booking, and the server rejects bookings that land inside it.
// Each test uses its own tenant so the default buffer is not affected by
// settings written by other tests.
[Collection("Integration")]
public class HomeServiceTravelBufferTests
{
    private const string BufferMessage = "Ese horario no deja tiempo de traslado con otro turno a domicilio";
    private readonly CustomWebApplicationFactory _factory;

    public HomeServiceTravelBufferTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Setup(Tenant Tenant, string Host, Professional Professional, Service AtHome, Service OnSite, CoverageLocality Locality, DateTime Day);

    private async Task<Setup> CreateSetupAsync()
    {
        var slug = $"buf-{Guid.NewGuid():N}"[..20];
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, slug, "Lavadero Buffer");
        var baseDomain = _factory.Services.GetRequiredService<IConfiguration>()["Tenancy:BaseDomain"]!;
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenant.Id);
        var atHome = await CreateServiceAsync(tenant.Id, ServiceLocationType.AtHome);
        var onSite = await CreateServiceAsync(tenant.Id, ServiceLocationType.OnSite);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var locality = new CoverageLocality { TenantId = tenant.Id, Name = $"Localidad-{Guid.NewGuid():N}", Province = "Buenos Aires", IsActive = true };
        db.CoverageLocalities.Add(locality);
        await db.SaveChangesAsync();

        return new Setup(tenant, $"{slug}.{baseDomain}", professional, atHome, onSite, locality, DateTime.Today.AddDays(40));
    }

    private async Task<Service> CreateServiceAsync(int tenantId, ServiceLocationType locationType)
    {
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, $"Lavado {locationType}");
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Services.IgnoreQueryFilters().Where(s => s.Id == service.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.LocationType, locationType));
        service.LocationType = locationType;
        return service;
    }

    // One-hour slot starting at the given time of the setup day.
    private async Task<TimeSlot> SlotAsync(Setup setup, int hour, int minute = 0, int? professionalId = -1)
    {
        var start = setup.Day.AddHours(hour).AddMinutes(minute);
        return await TestDataFactory.CreateTimeSlotAsync(_factory, setup.Tenant.Id, start, start.AddHours(1),
            professionalId == -1 ? setup.Professional.Id : professionalId);
    }

    // Booking inserted directly; atHome sets the snapshot marker (HomeServiceSurcharge).
    private async Task<Booking> ExistingBookingAsync(Setup setup, TimeSlot slot, bool atHome, string status = BookingStatus.Pending, int? professionalId = -1)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var booking = new Booking
        {
            TenantId = setup.Tenant.Id,
            TimeSlotId = slot.Id,
            // Same range the API stores for a service without duration (the
            // database rejects a booking that ends at or before its start).
            StartDateTime = slot.StartDateTime,
            EndDateTime = slot.EndDateTime,
            ProfessionalId = professionalId == -1 ? setup.Professional.Id : professionalId,
            CustomerName = "Cliente Existente",
            CustomerPhone = "1122334455",
            Email = "existente@test.com",
            CustomerEmailNormalized = "existente@test.com",
            Subject = "Lavado",
            Service = atHome ? setup.AtHome.Slug : setup.OnSite.Slug,
            Status = status,
            HomeAddressStreet = atHome ? "Calle 1" : null,
            HomeServiceSurcharge = atHome ? 0m : null
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();
        await db.TimeSlots.IgnoreQueryFilters().Where(t => t.Id == slot.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsAvailable, status == BookingStatus.Cancelled));
        return booking;
    }

    private async Task SetBufferAsync(Setup setup, int minutes)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.BusinessSettings.Add(new BusinessSettings
        {
            TenantId = setup.Tenant.Id,
            DaysOfWeek = new[] { 1, 2, 3, 4, 5 },
            StartTime = TimeSpan.FromHours(9),
            SlotDuration = 60,
            MaxDaysInAdvance = 3,
            HomeServiceTravelBufferMinutes = minutes
        });
        await db.SaveChangesAsync();
    }

    private async Task<List<int>> AvailableSlotIdsAsync(Setup setup, string? serviceSlug, int? professionalId)
    {
        var query = new List<string>();
        if (professionalId is not null) query.Add($"professionalId={professionalId}");
        if (serviceSlug is not null) query.Add($"serviceSlug={serviceSlug}");
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/timeslots/available?" + string.Join("&", query));
        request.Headers.Add("X-Tenant-Host", setup.Host);
        var response = await _factory.CreateClient().SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = (await response.Content.ReadFromJsonAsync<List<JsonElement>>())!;
        return list.Select(s => s.GetProperty("id").GetInt32()).ToList();
    }

    private Task<HttpResponseMessage> PostBookingAsync(Setup setup, int slotId, Service service)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/bookings")
        {
            Content = JsonContent.Create(new
            {
                timeSlotId = slotId,
                customerName = "Cliente Domicilio",
                customerPhone = "1122334455",
                email = $"buffer-{Guid.NewGuid():N}@test.com",
                subject = "Lavado completo",
                service = service.Slug,
                acceptedTerms = true,
                homeAddress = service.LocationType == ServiceLocationType.AtHome
                    ? new { street = "Av. Mitre 1234", coverageLocalityId = setup.Locality.Id }
                    : null
            })
        };
        request.Headers.Add("X-Tenant-Host", setup.Host);
        return _factory.CreateClient().SendAsync(request);
    }

    private async Task<HttpClient> AdminClientAsync(Setup setup)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, setup.Tenant.Id, $"admin-buffer-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", setup.Tenant.Id));
        return client;
    }

    private static async Task AssertBufferConflictAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(BufferMessage, body.GetProperty("message").GetString());
    }

    private async Task<bool> IsAvailableAsync(int slotId) =>
        (await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slotId))!.IsAvailable;

    [Fact]
    public async Task Listing_AtHomeService_HidesSlotsInsideDefaultBufferBeforeAndAfter()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var before30 = await SlotAsync(setup, 8, 30);   // ends 09:30, gap 30 -> visible
        var before15 = await SlotAsync(setup, 8, 45);   // ends 09:45, gap 15 -> hidden
        var after0 = await SlotAsync(setup, 11);        // gap 0 -> hidden
        var after15 = await SlotAsync(setup, 11, 15);   // gap 15 -> hidden
        var after30 = await SlotAsync(setup, 11, 30);   // gap 30 -> visible

        var ids = await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, setup.Professional.Id);

        Assert.Contains(before30.Id, ids);
        Assert.Contains(after30.Id, ids);
        Assert.DoesNotContain(before15.Id, ids);
        Assert.DoesNotContain(after0.Id, ids);
        Assert.DoesNotContain(after15.Id, ids);
    }

    [Fact]
    public async Task Listing_OnSiteServiceOrNoService_IsUnchanged()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var after0 = await SlotAsync(setup, 11);

        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, setup.OnSite.Slug, setup.Professional.Id));
        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, null, setup.Professional.Id));
    }

    [Fact]
    public async Task Listing_AtHomeBookingOfAnotherProfessional_DoesNotHide()
    {
        var setup = await CreateSetupAsync();
        var other = await TestDataFactory.CreateProfessionalAsync(_factory, setup.Tenant.Id, "Otro");
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10, professionalId: other.Id), atHome: true, professionalId: other.Id);
        var after0 = await SlotAsync(setup, 11);

        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, setup.Professional.Id));
        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, null));
    }

    [Fact]
    public async Task Listing_OnSiteBookingNextToSlot_DoesNotHide()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: false);
        var after0 = await SlotAsync(setup, 11);

        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, setup.Professional.Id));
    }

    [Fact]
    public async Task Listing_UnassignedSlots_AreScopedToTheTenant()
    {
        // Single-person businesses have unassigned slots: unassigned bookings of the
        // same tenant count as the same professional; another tenant's never do.
        var setup = await CreateSetupAsync();
        var otherTenant = await CreateSetupAsync();
        await ExistingBookingAsync(otherTenant, await SlotAsync(otherTenant, 10, professionalId: null), atHome: true, professionalId: null);
        var after0 = await SlotAsync(setup, 11, professionalId: null);

        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, null));

        await ExistingBookingAsync(setup, await SlotAsync(setup, 10, professionalId: null), atHome: true, professionalId: null);

        Assert.DoesNotContain(after0.Id, await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, null));
    }

    [Fact]
    public async Task Create_AtHomeInsideBuffer_ReturnsConflictAndKeepsSlotAvailable()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var after15 = await SlotAsync(setup, 11, 15);

        var response = await PostBookingAsync(setup, after15.Id, setup.AtHome);

        await AssertBufferConflictAsync(response);
        Assert.True(await IsAvailableAsync(after15.Id));
    }

    [Fact]
    public async Task Create_AtHomeOutsideBuffer_IsAllowed()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var after30 = await SlotAsync(setup, 11, 30);

        var response = await PostBookingAsync(setup, after30.Id, setup.AtHome);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Create_OnSiteNextToAtHomeBooking_IsAllowed()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var after0 = await SlotAsync(setup, 11);

        var response = await PostBookingAsync(setup, after0.Id, setup.OnSite);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Create_AtHomeNextToOnSiteBooking_IsAllowed()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: false);
        var after0 = await SlotAsync(setup, 11);

        var response = await PostBookingAsync(setup, after0.Id, setup.AtHome);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task BufferZero_DisablesTheRule()
    {
        var setup = await CreateSetupAsync();
        await SetBufferAsync(setup, 0);
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var after0 = await SlotAsync(setup, 11);

        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, setup.Professional.Id));
        var response = await PostBookingAsync(setup, after0.Id, setup.AtHome);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ConfiguredBuffer_IsUsedInsteadOfDefault()
    {
        var setup = await CreateSetupAsync();
        await SetBufferAsync(setup, 60);
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var after45 = await SlotAsync(setup, 11, 45);   // gap 45 < 60 -> hidden
        var after60 = await SlotAsync(setup, 12);       // gap 60 -> visible

        var ids = await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, setup.Professional.Id);

        Assert.DoesNotContain(after45.Id, ids);
        Assert.Contains(after60.Id, ids);
    }

    [Fact]
    public async Task CancelledAtHomeBooking_DoesNotBlock()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true, status: BookingStatus.Cancelled);
        var after0 = await SlotAsync(setup, 11);

        Assert.Contains(after0.Id, await AvailableSlotIdsAsync(setup, setup.AtHome.Slug, setup.Professional.Id));
        var response = await PostBookingAsync(setup, after0.Id, setup.AtHome);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Reschedule_AtHomeBookingIntoBuffer_ReturnsConflictAndKeepsOriginalSlot()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var originalSlot = await SlotAsync(setup, 15);
        var moving = await ExistingBookingAsync(setup, originalSlot, atHome: true);
        var after0 = await SlotAsync(setup, 11);

        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/bookings/{moving.Id}/reschedule")
        {
            Content = JsonContent.Create(new { newTimeSlotId = after0.Id })
        };
        request.Headers.Add("X-Tenant-Host", setup.Host);
        var response = await _factory.CreateClient().SendAsync(request);

        await AssertBufferConflictAsync(response);
        Assert.True(await IsAvailableAsync(after0.Id));
        Assert.False(await IsAvailableAsync(originalSlot.Id));
        Assert.Equal(originalSlot.Id, (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, moving.Id))!.TimeSlotId);
    }

    [Fact]
    public async Task AdminReschedule_AtHomeBookingIntoBuffer_ReturnsConflict()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var moving = await ExistingBookingAsync(setup, await SlotAsync(setup, 15), atHome: true);
        var after0 = await SlotAsync(setup, 11);
        var client = await AdminClientAsync(setup);

        var response = await client.PostAsJsonAsync($"/api/bookings/{moving.Id}/admin-reschedule", new { newTimeSlotId = after0.Id });

        await AssertBufferConflictAsync(response);
        Assert.True(await IsAvailableAsync(after0.Id));
    }

    [Fact]
    public async Task Reschedule_OnSiteBookingNextToAtHomeBooking_IsAllowed()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var moving = await ExistingBookingAsync(setup, await SlotAsync(setup, 15), atHome: false);
        var after0 = await SlotAsync(setup, 11);
        var client = await AdminClientAsync(setup);

        var response = await client.PostAsJsonAsync($"/api/bookings/{moving.Id}/admin-reschedule", new { newTimeSlotId = after0.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateBooking_SwitchToAtHomeInsideBuffer_ReturnsConflictAndChangesNothing()
    {
        var setup = await CreateSetupAsync();
        await ExistingBookingAsync(setup, await SlotAsync(setup, 10), atHome: true);
        var editing = await ExistingBookingAsync(setup, await SlotAsync(setup, 11), atHome: false);
        var client = await AdminClientAsync(setup);

        var response = await client.PutAsJsonAsync($"/api/bookings/{editing.Id}", new
        {
            customerName = "Cliente Editado",
            customerPhone = "1122334455",
            subject = "Lavado",
            service = setup.AtHome.Slug,
            homeAddress = new { street = "Av. Mitre 1234", coverageLocalityId = setup.Locality.Id }
        });

        await AssertBufferConflictAsync(response);
        var reloaded = (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, editing.Id))!;
        Assert.Null(reloaded.HomeServiceSurcharge);
        Assert.Equal("Cliente Existente", reloaded.CustomerName);
    }
}
