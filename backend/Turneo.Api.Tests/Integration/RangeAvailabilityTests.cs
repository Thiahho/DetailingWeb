using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Modules.HomeService.ServiceArea;

namespace Turneo.Api.Tests.Integration;

// One availability rule for the listing and every booking write: a start slot
// is bookable when the range [start, start + service duration) (or the slot
// itself for a service without duration) overlaps no active booking of the
// same professional, is covered by the business' open slots (gaps up to 30
// min allowed) and, for at-home services, keeps the travel buffer with the
// professional's other at-home bookings measured on their real ranges.
// Slots overlapped by an active booking are marked unavailable and freed only
// when no other active booking overlaps them. Each test uses its own tenant.
[Collection("Integration")]
public class RangeAvailabilityTests
{
    private const string OverlapMessage = "Ese horario se superpone con otro turno del mismo profesional";
    private const string NotCoveredMessage = "El servicio no entra en el horario disponible de la agenda";
    private const string BufferMessage = "Ese horario no deja tiempo de traslado con otro turno a domicilio";
    private readonly CustomWebApplicationFactory _factory;

    public RangeAvailabilityTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Setup(Tenant Tenant, string Host, Professional Professional, DateTime Day);

    private async Task<Setup> CreateSetupAsync()
    {
        var slug = $"rng-{Guid.NewGuid():N}"[..20];
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, slug, "Lavadero Rangos");
        var baseDomain = _factory.Services.GetRequiredService<IConfiguration>()["Tenancy:BaseDomain"]!;
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenant.Id, "Rango");
        return new Setup(tenant, $"{slug}.{baseDomain}", professional, DateTime.Today.AddDays(40));
    }

    private async Task<Service> ServiceAsync(Setup setup, int? durationMinutes, ServiceLocationType locationType = ServiceLocationType.OnSite)
    {
        var service = await TestDataFactory.CreateServiceAsync(_factory, setup.Tenant.Id, "Ceramico");
        await TestDataFactory.SetServiceDurationAsync(_factory, service.Id, durationMinutes);
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Services.IgnoreQueryFilters()
            .Where(s => s.Id == service.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.LocationType, locationType));
        service.LocationType = locationType;
        return service;
    }

    private Task<TimeSlot> SlotAsync(Setup setup, double fromHour, double toHour, int? professionalId = -1) =>
        TestDataFactory.CreateTimeSlotAsync(_factory, setup.Tenant.Id,
            setup.Day.AddHours(fromHour), setup.Day.AddHours(toHour),
            professionalId == -1 ? setup.Professional.Id : professionalId);

    // Consecutive one-hour slots [fromHour, toHour).
    private async Task<Dictionary<int, TimeSlot>> HourlySlotsAsync(Setup setup, int fromHour, int toHour, int? professionalId = -1)
    {
        var slots = new Dictionary<int, TimeSlot>();
        for (var hour = fromHour; hour < toHour; hour++)
            slots[hour] = await SlotAsync(setup, hour, hour + 1, professionalId);
        return slots;
    }

    // Anonymous request resolved to the setup's tenant by its host.
    private Task<HttpResponseMessage> SendAsync(Setup setup, HttpMethod method, string url, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (body is not null) request.Content = JsonContent.Create(body);
        request.Headers.Add("X-Tenant-Host", setup.Host);
        return _factory.CreateClient().SendAsync(request);
    }

    private Task<HttpResponseMessage> PostBookingAsync(Setup setup, int slotId, Service? service, CoverageLocality? locality = null) =>
        SendAsync(setup, HttpMethod.Post, "/api/bookings", new
        {
            timeSlotId = slotId,
            customerName = "Cliente Rango",
            customerPhone = "1122334455",
            email = $"rango-{Guid.NewGuid():N}@test.com",
            subject = "Tratamiento",
            service = service?.Slug,
            acceptedTerms = true,
            homeAddress = locality is null ? null : new { street = "Av. Mitre 1234", coverageLocalityId = locality.Id }
        });

    private async Task<int> BookAsync(Setup setup, int slotId, Service? service, CoverageLocality? locality = null)
    {
        var response = await PostBookingAsync(setup, slotId, service, locality);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("booking").GetProperty("id").GetInt32();
    }

    private async Task<List<JsonElement>> AvailableAsync(Setup setup, Service? service, int? professionalId = -1)
    {
        var query = new List<string>();
        var professional = professionalId == -1 ? setup.Professional.Id : professionalId;
        if (professional is not null) query.Add($"professionalId={professional}");
        if (service is not null) query.Add($"serviceSlug={service.Slug}");
        var response = await SendAsync(setup, HttpMethod.Get, "/api/timeslots/available?" + string.Join("&", query));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<JsonElement>>())!;
    }

    private async Task<List<int>> AvailableIdsAsync(Setup setup, Service? service, int? professionalId = -1) =>
        (await AvailableAsync(setup, service, professionalId)).Select(s => s.GetProperty("id").GetInt32()).ToList();

    private async Task<HttpClient> AdminClientAsync(Setup setup)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, setup.Tenant.Id, $"admin-rango-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", setup.Tenant.Id));
        return client;
    }

    private static async Task AssertConflictAsync(HttpResponseMessage response, string message)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(message, body.GetProperty("message").GetString());
    }

    private async Task<bool> IsAvailableAsync(TimeSlot slot) =>
        (await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id))!.IsAvailable;

    private async Task<Booking> ReloadAsync(int bookingId) =>
        (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId))!;

    private Task<HttpResponseMessage> CancelAsync(Setup setup, int bookingId) =>
        SendAsync(setup, HttpMethod.Post, $"/api/bookings/{bookingId}/cancel");

    // --- Long service blocks its real range -----------------------------------

    [Fact]
    public async Task LongBooking_HidesEveryStartWhoseRangeOverlapsIt_FromTheListing()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var noDuration = await ServiceAsync(setup, null);
        var slots = await HourlySlotsAsync(setup, 9, 17);
        await BookAsync(setup, slots[10].Id, threeHours);

        var longIds = await AvailableIdsAsync(setup, threeHours);
        var shortIds = await AvailableIdsAsync(setup, noDuration);

        // 3 h starts: 09 (09-12), 10, 11, 12 overlap 10-13; 13 (13-16) and 14 (14-17) fit; 15, 16 are not covered.
        Assert.Equal(new[] { slots[13].Id, slots[14].Id }, longIds);
        // Services without duration: every free slot that does not overlap 10-13.
        Assert.Equal(new[] { slots[9].Id, slots[13].Id, slots[14].Id, slots[15].Id, slots[16].Id }, shortIds);
    }

    [Fact]
    public async Task LongBooking_MarksOverlappedSlotsUnavailable()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 9, 14);

        await BookAsync(setup, slots[10].Id, threeHours);

        Assert.True(await IsAvailableAsync(slots[9]));
        Assert.False(await IsAvailableAsync(slots[10]));
        Assert.False(await IsAvailableAsync(slots[11]));
        Assert.False(await IsAvailableAsync(slots[12]));
        Assert.True(await IsAvailableAsync(slots[13]));
    }

    [Fact]
    public async Task LongBooking_ApiRejectsAnyOtherBookingOfTheSameProfessionalInsideIt()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 8, 14);
        // A manual slot that starts inside the range but was never claimed.
        var inside = await SlotAsync(setup, 12.5, 13.5);
        await BookAsync(setup, slots[10].Id, threeHours);

        await AssertConflictAsync(await PostBookingAsync(setup, slots[11].Id, null), OverlapMessage);
        await AssertConflictAsync(await PostBookingAsync(setup, slots[12].Id, null), OverlapMessage);
        await AssertConflictAsync(await PostBookingAsync(setup, inside.Id, null), OverlapMessage);
        // A 3 h booking at 08:00 (08-11) also overlaps 10-13.
        await AssertConflictAsync(await PostBookingAsync(setup, slots[8].Id, threeHours), OverlapMessage);
        Assert.True(await IsAvailableAsync(slots[8]));
        // Right after the range is free.
        await BookAsync(setup, slots[13].Id, null);
    }

    [Fact]
    public async Task ConcurrentLongBookings_ExactlyOneWins()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 9, 15);

        var responses = await Task.WhenAll(new[] { 9, 10, 11 }.Select(h => PostBookingAsync(setup, slots[h].Id, threeHours)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(2, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task LongBooking_DoesNotAffectAnotherProfessional()
    {
        var setup = await CreateSetupAsync();
        var other = await TestDataFactory.CreateProfessionalAsync(_factory, setup.Tenant.Id, "Otro");
        var threeHours = await ServiceAsync(setup, 180);
        var mine = await HourlySlotsAsync(setup, 9, 14);
        var theirs = await HourlySlotsAsync(setup, 9, 14, other.Id);
        await BookAsync(setup, mine[10].Id, threeHours);

        Assert.Contains(theirs[11].Id, await AvailableIdsAsync(setup, threeHours, other.Id));
        Assert.True(await IsAvailableAsync(theirs[11]));
        await BookAsync(setup, theirs[11].Id, threeHours);
    }

    // --- Coverage by the business' open agenda ---------------------------------

    [Fact]
    public async Task UncoveredRange_IsNotListed_AndIsRejected()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var ten = await SlotAsync(setup, 10, 11);
        await SlotAsync(setup, 11, 12);
        // Lunch: nothing between 12:00 and 14:00.
        await SlotAsync(setup, 14, 15);

        Assert.DoesNotContain(ten.Id, await AvailableIdsAsync(setup, threeHours));

        await AssertConflictAsync(await PostBookingAsync(setup, ten.Id, threeHours), NotCoveredMessage);
        Assert.True(await IsAvailableAsync(ten));
    }

    [Fact]
    public async Task GapOfThirtyMinutes_KeepsCoverage()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var ten = await SlotAsync(setup, 10, 11);
        await SlotAsync(setup, 11.5, 12.5);
        await SlotAsync(setup, 12.5, 13.5);

        Assert.Contains(ten.Id, await AvailableIdsAsync(setup, threeHours));
        var bookingId = await BookAsync(setup, ten.Id, threeHours);
        Assert.Equal(setup.Day.AddHours(13), (await ReloadAsync(bookingId)).EndDateTime);
    }

    [Fact]
    public async Task GapOfThirtyOneMinutes_BreaksCoverage()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var ten = await SlotAsync(setup, 10, 11);
        var afterGap = setup.Day.AddHours(11).AddMinutes(31);
        await TestDataFactory.CreateTimeSlotAsync(_factory, setup.Tenant.Id, afterGap, afterGap.AddHours(3), setup.Professional.Id);

        Assert.DoesNotContain(ten.Id, await AvailableIdsAsync(setup, threeHours));
        await AssertConflictAsync(await PostBookingAsync(setup, ten.Id, threeHours), NotCoveredMessage);
    }

    [Fact]
    public async Task AnotherProfessionalsSlots_DoNotCoverTheRange()
    {
        var setup = await CreateSetupAsync();
        var other = await TestDataFactory.CreateProfessionalAsync(_factory, setup.Tenant.Id, "Otro");
        var threeHours = await ServiceAsync(setup, 180);
        var ten = await SlotAsync(setup, 10, 11);
        await HourlySlotsAsync(setup, 11, 14, other.Id);

        await AssertConflictAsync(await PostBookingAsync(setup, ten.Id, threeHours), NotCoveredMessage);
    }

    [Fact]
    public async Task UnknownServiceSlug_InTheListing_Is400()
    {
        var setup = await CreateSetupAsync();
        await SlotAsync(setup, 10, 11);

        var response = await SendAsync(setup, HttpMethod.Get, "/api/timeslots/available?serviceSlug=no-existe-" + Guid.NewGuid().ToString("N"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Listing_ExposesTheEndOfTheRangeTheServiceWouldOccupy()
    {
        var setup = await CreateSetupAsync();
        var twoHours = await ServiceAsync(setup, 120);
        var slots = await HourlySlotsAsync(setup, 10, 12);

        var withService = (await AvailableAsync(setup, twoHours)).Single(s => s.GetProperty("id").GetInt32() == slots[10].Id);
        var withoutService = (await AvailableAsync(setup, null)).Single(s => s.GetProperty("id").GetInt32() == slots[10].Id);

        Assert.Equal(setup.Day.AddHours(12), withService.GetProperty("bookingEndDateTime").GetDateTime());
        Assert.Equal(setup.Day.AddHours(11), withoutService.GetProperty("bookingEndDateTime").GetDateTime());
    }

    // --- Cancel / release free overlapped slots --------------------------------

    [Fact]
    public async Task Cancel_FreesOverlappedSlots_OnlyWhenNothingElseOverlapsThem()
    {
        var setup = await CreateSetupAsync();
        var twoHours = await ServiceAsync(setup, 120);
        var slots = await HourlySlotsAsync(setup, 10, 13);
        // A long manual slot overlapped by both bookings below.
        var wide = await SlotAsync(setup, 11.5, 12.5);
        var first = await BookAsync(setup, slots[10].Id, twoHours); // 10-12
        var second = await BookAsync(setup, slots[12].Id, null);    // 12-13
        Assert.False(await IsAvailableAsync(wide));
        Assert.False(await IsAvailableAsync(slots[11]));

        Assert.Equal(HttpStatusCode.OK, (await CancelAsync(setup, first)).StatusCode);

        Assert.True(await IsAvailableAsync(slots[10]));
        Assert.True(await IsAvailableAsync(slots[11]));
        Assert.False(await IsAvailableAsync(wide));

        Assert.Equal(HttpStatusCode.OK, (await CancelAsync(setup, second)).StatusCode);

        Assert.True(await IsAvailableAsync(wide));
        Assert.True(await IsAvailableAsync(slots[12]));
    }

    [Fact]
    public async Task Release_FreesTheSlotsOverlappedByTheReleasedBooking()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 10, 13);
        await BookAsync(setup, slots[10].Id, threeHours);
        var admin = await AdminClientAsync(setup);

        var response = await admin.PutAsync($"/api/timeslots/{slots[10].Id}/release", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await IsAvailableAsync(slots[10]));
        Assert.True(await IsAvailableAsync(slots[11]));
        Assert.True(await IsAvailableAsync(slots[12]));
    }

    [Fact]
    public async Task AdminSlots_ExposeTheBookingThatOccupiesThem()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 10, 14);
        var bookingId = await BookAsync(setup, slots[10].Id, threeHours);
        var admin = await AdminClientAsync(setup);
        var day = setup.Day.ToString("yyyy-MM-dd");

        var response = await admin.GetAsync($"/api/timeslots?from={day}&to={day}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = (await response.Content.ReadFromJsonAsync<List<JsonElement>>())!;
        int? OccupiedBy(TimeSlot slot)
        {
            var element = list.Single(s => s.GetProperty("id").GetInt32() == slot.Id).GetProperty("occupiedByBookingId");
            return element.ValueKind == JsonValueKind.Null ? null : element.GetInt32();
        }
        Assert.Equal(bookingId, OccupiedBy(slots[10]));
        Assert.Equal(bookingId, OccupiedBy(slots[11]));
        Assert.Equal(bookingId, OccupiedBy(slots[12]));
        Assert.Null(OccupiedBy(slots[13]));
    }

    // --- Reschedule and edit exclude the booking itself ------------------------

    [Fact]
    public async Task AdminReschedule_IntoItsOwnRange_IsAllowed_AndMovesTheOccupiedSlots()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 10, 15);
        var bookingId = await BookAsync(setup, slots[10].Id, threeHours);
        var admin = await AdminClientAsync(setup);

        var response = await admin.PostAsJsonAsync($"/api/bookings/{bookingId}/admin-reschedule", new { newTimeSlotId = slots[11].Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var booking = await ReloadAsync(bookingId);
        Assert.Equal(slots[11].Id, booking.TimeSlotId);
        Assert.Equal(setup.Day.AddHours(11), booking.StartDateTime);
        Assert.Equal(setup.Day.AddHours(14), booking.EndDateTime);
        Assert.True(await IsAvailableAsync(slots[10]));
        Assert.False(await IsAvailableAsync(slots[11]));
        Assert.False(await IsAvailableAsync(slots[13]));
        Assert.True(await IsAvailableAsync(slots[14]));
    }

    [Fact]
    public async Task PublicReschedule_IntoItsOwnRange_IsAllowed()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 10, 15);
        var bookingId = await BookAsync(setup, slots[10].Id, threeHours);

        var response = await SendAsync(setup, HttpMethod.Post, $"/api/bookings/{bookingId}/reschedule", new { newTimeSlotId = slots[12].Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await IsAvailableAsync(slots[10]));
        Assert.True(await IsAvailableAsync(slots[11]));
        Assert.False(await IsAvailableAsync(slots[14]));
    }

    [Fact]
    public async Task Reschedule_IntoAnUncoveredRange_Is409_AndBookingUnchanged()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var slots = await HourlySlotsAsync(setup, 10, 13);
        var lonely = await SlotAsync(setup, 16, 17);
        var bookingId = await BookAsync(setup, slots[10].Id, threeHours);
        var admin = await AdminClientAsync(setup);

        var response = await admin.PostAsJsonAsync($"/api/bookings/{bookingId}/admin-reschedule", new { newTimeSlotId = lonely.Id });

        await AssertConflictAsync(response, NotCoveredMessage);
        Assert.Equal(slots[10].Id, (await ReloadAsync(bookingId)).TimeSlotId);
        Assert.True(await IsAvailableAsync(lonely));
        Assert.False(await IsAvailableAsync(slots[11]));
    }

    [Fact]
    public async Task UpdateBooking_ToALongerService_OccupiesTheNewRange_AndBackFreesIt()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var noDuration = await ServiceAsync(setup, null);
        var slots = await HourlySlotsAsync(setup, 10, 14);
        var bookingId = await BookAsync(setup, slots[10].Id, noDuration);
        var admin = await AdminClientAsync(setup);
        object Edit(Service service) => new { customerName = "Cliente Rango", customerPhone = "1122334455", subject = "Tratamiento", service = service.Slug };

        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/bookings/{bookingId}", Edit(threeHours))).StatusCode);

        Assert.Equal(setup.Day.AddHours(13), (await ReloadAsync(bookingId)).EndDateTime);
        Assert.False(await IsAvailableAsync(slots[11]));
        Assert.False(await IsAvailableAsync(slots[12]));
        Assert.True(await IsAvailableAsync(slots[13]));

        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/bookings/{bookingId}", Edit(noDuration))).StatusCode);

        Assert.True(await IsAvailableAsync(slots[11]));
        Assert.True(await IsAvailableAsync(slots[12]));
    }

    [Fact]
    public async Task UpdateBooking_ToAServiceThatDoesNotFit_Is409_AndChangesNothing()
    {
        var setup = await CreateSetupAsync();
        var threeHours = await ServiceAsync(setup, 180);
        var noDuration = await ServiceAsync(setup, null);
        var ten = await SlotAsync(setup, 10, 11);
        var bookingId = await BookAsync(setup, ten.Id, noDuration);
        var admin = await AdminClientAsync(setup);

        var response = await admin.PutAsJsonAsync($"/api/bookings/{bookingId}", new
        {
            customerName = "Cliente Editado",
            customerPhone = "1122334455",
            subject = "Tratamiento",
            service = threeHours.Slug
        });

        await AssertConflictAsync(response, NotCoveredMessage);
        var booking = await ReloadAsync(bookingId);
        Assert.Equal(noDuration.Slug, booking.Service);
        Assert.Equal(setup.Day.AddHours(11), booking.EndDateTime);
    }

    // --- Travel buffer on real ranges ------------------------------------------

    private async Task<CoverageLocality> LocalityAsync(Setup setup)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var locality = new CoverageLocality { TenantId = setup.Tenant.Id, Name = $"Localidad-{Guid.NewGuid():N}", Province = "Buenos Aires", IsActive = true };
        db.CoverageLocalities.Add(locality);
        await db.SaveChangesAsync();
        return locality;
    }

    [Fact]
    public async Task TravelBuffer_UsesTheRealRangeOfTheExistingBooking()
    {
        var setup = await CreateSetupAsync();
        var locality = await LocalityAsync(setup);
        var atHomeLong = await ServiceAsync(setup, 180, ServiceLocationType.AtHome);
        var atHome = await ServiceAsync(setup, null, ServiceLocationType.AtHome);
        var slots = await HourlySlotsAsync(setup, 10, 13);
        var rightAfter = await SlotAsync(setup, 13, 14);   // gap 0 after 10-13
        var afterBuffer = await SlotAsync(setup, 13.5, 14.5);
        await BookAsync(setup, slots[10].Id, atHomeLong, locality);

        var ids = await AvailableIdsAsync(setup, atHome);

        Assert.DoesNotContain(rightAfter.Id, ids);
        Assert.Contains(afterBuffer.Id, ids);
        await AssertConflictAsync(await PostBookingAsync(setup, rightAfter.Id, atHome, locality), BufferMessage);
        await BookAsync(setup, afterBuffer.Id, atHome, locality);
    }

    [Fact]
    public async Task TravelBuffer_UsesTheRealRangeOfTheNewBooking()
    {
        var setup = await CreateSetupAsync();
        var locality = await LocalityAsync(setup);
        var atHomeLong = await ServiceAsync(setup, 180, ServiceLocationType.AtHome);
        var atHome = await ServiceAsync(setup, null, ServiceLocationType.AtHome);
        var slots = await HourlySlotsAsync(setup, 10, 14);
        var later = await SlotAsync(setup, 14, 15);
        await BookAsync(setup, later.Id, atHome, locality); // 14-15

        var ids = await AvailableIdsAsync(setup, atHomeLong);

        // 10-13 leaves 60 min before 14:00; 11-14 leaves none.
        Assert.Contains(slots[10].Id, ids);
        Assert.DoesNotContain(slots[11].Id, ids);
        await AssertConflictAsync(await PostBookingAsync(setup, slots[11].Id, atHomeLong, locality), BufferMessage);
        await BookAsync(setup, slots[10].Id, atHomeLong, locality);
    }

    // --- Services without duration ---------------------------------------------

    [Fact]
    public async Task ServiceWithoutDuration_SingleSlotIsBookable_AsBefore()
    {
        var setup = await CreateSetupAsync();
        var noDuration = await ServiceAsync(setup, null);
        var lonely = await SlotAsync(setup, 10, 11);

        Assert.Contains(lonely.Id, await AvailableIdsAsync(setup, noDuration));
        Assert.Contains(lonely.Id, await AvailableIdsAsync(setup, null));
        var bookingId = await BookAsync(setup, lonely.Id, noDuration);

        var booking = await ReloadAsync(bookingId);
        Assert.Equal(lonely.StartDateTime, booking.StartDateTime);
        Assert.Equal(lonely.EndDateTime, booking.EndDateTime);
        Assert.False(await IsAvailableAsync(lonely));
    }
}
