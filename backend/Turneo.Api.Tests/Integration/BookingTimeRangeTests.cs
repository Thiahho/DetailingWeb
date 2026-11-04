using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

// Booking.StartDateTime / EndDateTime snapshot: start = slot start, end =
// start + the booked service's DurationMinutes, or the slot end when the
// service has no duration. Set on create, public and admin reschedule, and on
// an admin edit that changes the service. Readers still use the TimeSlot; the
// booking range is exposed additively as bookingStartDateTime/bookingEndDateTime.
[Collection("Integration")]
public class BookingTimeRangeTests
{
    private readonly CustomWebApplicationFactory _factory;

    public BookingTimeRangeTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private Task<int> TenantAsync() => TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

    private async Task<Service> ServiceAsync(int tenantId, int? durationMinutes)
    {
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, "Ceramico");
        await TestDataFactory.SetServiceDurationAsync(_factory, service.Id, durationMinutes);
        return service;
    }

    // Whole minutes, far in the future, with its own professional so random
    // times of other tests never collide with this slot.
    private async Task<TimeSlot> SlotAsync(int tenantId, int? professionalId = null)
    {
        professionalId ??= (await TestDataFactory.CreateProfessionalAsync(_factory, tenantId)).Id;
        var start = DateTime.UtcNow.Date.AddDays(40).AddMinutes(Random.Shared.Next(1, 200_000));
        return await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddMinutes(30), professionalId);
    }

    private async Task<(int BookingId, string Email)> BookAsync(int slotId, string? serviceSlug)
    {
        var email = $"rango-{Guid.NewGuid():N}@test.com";
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            timeSlotId = slotId,
            customerName = "Cliente Rango",
            customerPhone = "1122334455",
            email,
            subject = "Tratamiento",
            service = serviceSlug,
            acceptedTerms = true
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (body.GetProperty("booking").GetProperty("id").GetInt32(), email);
    }

    private async Task<Booking> ReloadAsync(int bookingId) =>
        (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId))!;

    private async Task<HttpClient> AdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-rango-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static void AssertRange(Booking booking, DateTime start, DateTime end)
    {
        Assert.Equal(start, booking.StartDateTime);
        Assert.Equal(end, booking.EndDateTime);
    }

    private static void AssertJsonRange(JsonElement item, DateTime start, DateTime end)
    {
        Assert.Equal(start, item.GetProperty("bookingStartDateTime").GetDateTime());
        Assert.Equal(end, item.GetProperty("bookingEndDateTime").GetDateTime());
    }

    [Fact]
    public async Task Create_ServiceWithDuration_EndsAfterTheDuration()
    {
        var tenantId = await TenantAsync();
        var service = await ServiceAsync(tenantId, 180);
        var slot = await SlotAsync(tenantId);

        var (bookingId, _) = await BookAsync(slot.Id, service.Slug);

        AssertRange(await ReloadAsync(bookingId), slot.StartDateTime, slot.StartDateTime.AddMinutes(180));
    }

    [Fact]
    public async Task Create_ServiceWithoutDuration_EndsWithTheSlot()
    {
        var tenantId = await TenantAsync();
        var service = await ServiceAsync(tenantId, null);
        var slot = await SlotAsync(tenantId);

        var (bookingId, _) = await BookAsync(slot.Id, service.Slug);

        AssertRange(await ReloadAsync(bookingId), slot.StartDateTime, slot.EndDateTime);
    }

    [Fact]
    public async Task Create_WithoutService_EndsWithTheSlot()
    {
        var tenantId = await TenantAsync();
        var slot = await SlotAsync(tenantId);

        var (bookingId, _) = await BookAsync(slot.Id, null);

        AssertRange(await ReloadAsync(bookingId), slot.StartDateTime, slot.EndDateTime);
    }

    // The duration is looked up within the booking's tenant only.
    [Fact]
    public async Task Create_ServiceSlugOfAnotherTenant_EndsWithTheSlot()
    {
        var tenantId = await TenantAsync();
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"tenant-rango-{Guid.NewGuid():N}", "Otro Negocio");
        var foreignService = await ServiceAsync(otherTenant.Id, 240);
        var slot = await SlotAsync(tenantId);

        var (bookingId, _) = await BookAsync(slot.Id, foreignService.Slug);

        AssertRange(await ReloadAsync(bookingId), slot.StartDateTime, slot.EndDateTime);
    }

    [Fact]
    public async Task PublicReschedule_RecomputesFromTheNewSlot()
    {
        var tenantId = await TenantAsync();
        var service = await ServiceAsync(tenantId, 120);
        var slot = await SlotAsync(tenantId);
        var newSlot = await SlotAsync(tenantId);
        var (bookingId, _) = await BookAsync(slot.Id, service.Slug);

        var response = await _factory.CreateClient().PostAsJsonAsync($"/api/bookings/{bookingId}/reschedule", new { newTimeSlotId = newSlot.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertRange(await ReloadAsync(bookingId), newSlot.StartDateTime, newSlot.StartDateTime.AddMinutes(120));
    }

    [Fact]
    public async Task AdminReschedule_RecomputesFromTheNewSlot()
    {
        var tenantId = await TenantAsync();
        var service = await ServiceAsync(tenantId, null);
        var slot = await SlotAsync(tenantId);
        var newSlot = await SlotAsync(tenantId);
        var (bookingId, _) = await BookAsync(slot.Id, service.Slug);
        var admin = await AdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync($"/api/bookings/{bookingId}/admin-reschedule", new { newTimeSlotId = newSlot.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertRange(await ReloadAsync(bookingId), newSlot.StartDateTime, newSlot.EndDateTime);
    }

    [Fact]
    public async Task AdminReschedule_ServiceWithDuration_RecomputesFromTheNewSlot()
    {
        var tenantId = await TenantAsync();
        var service = await ServiceAsync(tenantId, 90);
        var slot = await SlotAsync(tenantId);
        var newSlot = await SlotAsync(tenantId);
        var (bookingId, _) = await BookAsync(slot.Id, service.Slug);
        var admin = await AdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync($"/api/bookings/{bookingId}/admin-reschedule", new { newTimeSlotId = newSlot.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertRange(await ReloadAsync(bookingId), newSlot.StartDateTime, newSlot.StartDateTime.AddMinutes(90));
    }

    private static Task<HttpResponseMessage> PutBookingAsync(HttpClient client, int bookingId, string? serviceSlug) =>
        client.PutAsJsonAsync($"/api/bookings/{bookingId}", new
        {
            customerName = "Cliente Rango",
            customerPhone = "1122334455",
            subject = "Tratamiento",
            service = serviceSlug,
            message = "Editado"
        });

    [Fact]
    public async Task UpdateBooking_ServiceChange_RecomputesEndAndKeepsStart()
    {
        var tenantId = await TenantAsync();
        var shortService = await ServiceAsync(tenantId, null);
        var longService = await ServiceAsync(tenantId, 180);
        var slot = await SlotAsync(tenantId);
        var (bookingId, _) = await BookAsync(slot.Id, shortService.Slug);
        var admin = await AdminClientAsync(tenantId);

        var toLong = await PutBookingAsync(admin, bookingId, longService.Slug);
        Assert.Equal(HttpStatusCode.OK, toLong.StatusCode);
        AssertRange(await ReloadAsync(bookingId), slot.StartDateTime, slot.StartDateTime.AddMinutes(180));

        var toShort = await PutBookingAsync(admin, bookingId, shortService.Slug);
        Assert.Equal(HttpStatusCode.OK, toShort.StatusCode);
        AssertRange(await ReloadAsync(bookingId), slot.StartDateTime, slot.EndDateTime);
    }

    // The range is a snapshot: editing other fields keeps it even if the
    // service's duration changed after booking.
    [Fact]
    public async Task UpdateBooking_SameService_KeepsTheSnapshot()
    {
        var tenantId = await TenantAsync();
        var service = await ServiceAsync(tenantId, 60);
        var slot = await SlotAsync(tenantId);
        var (bookingId, _) = await BookAsync(slot.Id, service.Slug);
        await TestDataFactory.SetServiceDurationAsync(_factory, service.Id, 240);
        var admin = await AdminClientAsync(tenantId);

        var response = await PutBookingAsync(admin, bookingId, service.Slug);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertRange(await ReloadAsync(bookingId), slot.StartDateTime, slot.StartDateTime.AddMinutes(60));
    }

    [Fact]
    public async Task ReadDtos_ExposeTheBookingRange()
    {
        var tenantId = await TenantAsync();
        var service = await ServiceAsync(tenantId, 150);
        var slot = await SlotAsync(tenantId);
        var (bookingId, email) = await BookAsync(slot.Id, service.Slug);
        var start = slot.StartDateTime;
        var end = slot.StartDateTime.AddMinutes(150);

        var byId = await _factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/bookings/{bookingId}");
        AssertJsonRange(byId, start, end);
        // Readers keep the slot times until they switch to the booking range.
        Assert.Equal(slot.EndDateTime, byId.GetProperty("endDateTime").GetDateTime());

        var byEmail = await _factory.CreateClient().GetFromJsonAsync<List<JsonElement>>($"/api/bookings/by-email?email={Uri.EscapeDataString(email)}");
        AssertJsonRange(byEmail!.Single(b => b.GetProperty("id").GetInt32() == bookingId), start, end);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, 0, email, "Client", tenantId));
        var mine = await client.GetFromJsonAsync<List<JsonElement>>("/api/bookings/my");
        AssertJsonRange(mine!.Single(b => b.GetProperty("id").GetInt32() == bookingId), start, end);

        var admin = await AdminClientAsync(tenantId);
        var all = await admin.GetFromJsonAsync<List<JsonElement>>("/api/bookings");
        AssertJsonRange(all!.Single(b => b.GetProperty("id").GetInt32() == bookingId), start, end);
    }
}
