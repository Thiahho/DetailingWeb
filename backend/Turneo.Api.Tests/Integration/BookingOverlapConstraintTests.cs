using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Turneo.Api.Tests.Integration;

// Database guarantee (migration AddBookingOverlapConstraint): two active
// bookings (any status but Cancelled) of the same professional in the same
// tenant never overlap in [StartDateTime, EndDateTime). Bookings without a
// professional share one resource. The exclusion violation (23P01) on a
// booking write answers 409 and leaves everything as it was.
[Collection("Integration")]
public class BookingOverlapConstraintTests
{
    private const string OverlapMessage = "Ese horario se superpone con otro turno del mismo profesional";
    private readonly CustomWebApplicationFactory _factory;

    public BookingOverlapConstraintTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private Task<int> TenantAsync() => TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

    private async Task<int> ProfessionalAsync(int tenantId) =>
        (await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, "Solapado")).Id;

    // A random far-future day at 10:00: tests with their own professional never
    // collide; tests without professional pick a day no other test uses.
    private static DateTime TenAm() =>
        new DateTime(2041, 1, 1, 10, 0, 0).AddDays(Random.Shared.Next(0, 20_000));

    private Task<TimeSlot> SlotAsync(int tenantId, DateTime start, int minutes, int? professionalId) =>
        TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddMinutes(minutes), professionalId);

    private Task<HttpResponseMessage> PostBookingAsync(int slotId, string? serviceSlug = null) =>
        _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            timeSlotId = slotId,
            customerName = "Cliente Solapado",
            customerPhone = "1122334455",
            email = $"solapado-{Guid.NewGuid():N}@test.com",
            subject = "Tratamiento",
            service = serviceSlug,
            acceptedTerms = true
        });

    private async Task<int> BookAsync(int slotId, string? serviceSlug = null)
    {
        var response = await PostBookingAsync(slotId, serviceSlug);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("booking").GetProperty("id").GetInt32();
    }

    private static async Task AssertOverlapConflictAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(OverlapMessage, body.GetProperty("message").GetString());
    }

    private async Task<Booking> ReloadAsync(int bookingId) =>
        (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId))!;

    private async Task<TimeSlot> ReloadSlotAsync(int slotId) =>
        (await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slotId))!;

    private async Task<HttpClient> AdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-solape-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private async Task<Service> ServiceAsync(int tenantId, int? durationMinutes)
    {
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, "Ceramico");
        await TestDataFactory.SetServiceDurationAsync(_factory, service.Id, durationMinutes);
        return service;
    }

    [Fact]
    public async Task Create_OverlappingSlotsSameProfessional_SecondIs409_FirstIntact()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var start = TenAm();
        var first = await SlotAsync(tenantId, start, 60, professionalId);
        var second = await SlotAsync(tenantId, start.AddMinutes(30), 60, professionalId);
        var firstBookingId = await BookAsync(first.Id);

        var response = await PostBookingAsync(second.Id);

        await AssertOverlapConflictAsync(response);
        var firstBooking = await ReloadAsync(firstBookingId);
        Assert.Equal(BookingStatus.Pending, firstBooking.Status);
        Assert.Equal(start, firstBooking.StartDateTime);
        Assert.Equal(start.AddMinutes(60), firstBooking.EndDateTime);
        // The claim of the second slot was rolled back with the booking.
        Assert.True((await ReloadSlotAsync(second.Id)).IsAvailable);
    }

    [Fact]
    public async Task Create_LongServiceOverlapsALaterBooking_Is409()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var longService = await ServiceAsync(tenantId, 180);
        var start = TenAm();
        var later = await SlotAsync(tenantId, start.AddHours(2), 30, professionalId);
        var early = await SlotAsync(tenantId, start, 30, professionalId);
        await BookAsync(later.Id);

        var response = await PostBookingAsync(early.Id, longService.Slug);

        await AssertOverlapConflictAsync(response);
        Assert.True((await ReloadSlotAsync(early.Id)).IsAvailable);
    }

    [Fact]
    public async Task Create_AdjacentRanges_AreAllowed()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var start = TenAm();
        var tenToEleven = await SlotAsync(tenantId, start, 60, professionalId);
        var elevenToTwelve = await SlotAsync(tenantId, start.AddHours(1), 60, professionalId);

        await BookAsync(tenToEleven.Id);
        await BookAsync(elevenToTwelve.Id);
    }

    [Fact]
    public async Task Create_OverlappingRangesDifferentProfessionals_AreAllowed()
    {
        var tenantId = await TenantAsync();
        var start = TenAm();
        var first = await SlotAsync(tenantId, start, 60, await ProfessionalAsync(tenantId));
        var second = await SlotAsync(tenantId, start.AddMinutes(30), 60, await ProfessionalAsync(tenantId));

        await BookAsync(first.Id);
        await BookAsync(second.Id);
    }

    [Fact]
    public async Task Create_WithoutProfessional_SharesOneResource()
    {
        var tenantId = await TenantAsync();
        var start = TenAm();
        var first = await SlotAsync(tenantId, start, 60, null);
        var second = await SlotAsync(tenantId, start.AddMinutes(30), 60, null);
        await BookAsync(first.Id);

        var response = await PostBookingAsync(second.Id);

        await AssertOverlapConflictAsync(response);
    }

    [Fact]
    public async Task Create_SameRangeInAnotherTenant_IsAllowed()
    {
        var tenantId = await TenantAsync();
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"tenant-solape-{Guid.NewGuid():N}", "Otro Negocio");
        var start = TenAm();
        var ownSlot = await SlotAsync(tenantId, start, 60, null);
        var otherSlot = await SlotAsync(otherTenant.Id, start, 60, null);
        await TestDataFactory.CreateBookingAsync(_factory, otherTenant.Id, otherSlot.Id, "Cliente Otro", "otro@test.com");

        await BookAsync(ownSlot.Id);
    }

    [Fact]
    public async Task Create_CancelledBookingDoesNotBlock()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var start = TenAm();
        var first = await SlotAsync(tenantId, start, 60, professionalId);
        var second = await SlotAsync(tenantId, start.AddMinutes(30), 60, professionalId);
        var firstBookingId = await BookAsync(first.Id);
        var cancel = await _factory.CreateClient().PostAsync($"/api/bookings/{firstBookingId}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        await BookAsync(second.Id);
    }

    [Fact]
    public async Task Confirm_CancelledBooking_IsRejectedAndStaysCancelled()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var slot = await SlotAsync(tenantId, TenAm(), 60, professionalId);
        var bookingId = await BookAsync(slot.Id);
        var cancel = await _factory.CreateClient().PostAsync($"/api/bookings/{bookingId}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        var admin = await AdminClientAsync(tenantId);
        var confirm = await admin.PatchAsync($"/api/bookings/{bookingId}/confirm", null);

        Assert.Equal(HttpStatusCode.BadRequest, confirm.StatusCode);
        var stored = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId);
        Assert.Equal(BookingStatus.Cancelled, stored!.Status);
    }

    // Statuses that occupy time: Pending, Confirmed and the legacy "Reservado".
    [Theory]
    [InlineData(BookingStatus.Confirmed)]
    [InlineData(BookingStatus.LegacyReserved)]
    public async Task Create_ConfirmedOrLegacyReservedBookingBlocks(string status)
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var start = TenAm();
        var first = await SlotAsync(tenantId, start, 60, professionalId);
        var second = await SlotAsync(tenantId, start.AddMinutes(30), 60, professionalId);
        var previous = await TestDataFactory.CreateBookingAsync(_factory, tenantId, first.Id, "Cliente Previo", "previo@test.com", status);
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, first.Id, false);
        using (var scope = _factory.Services.CreateScope())
        {
            // The factory leaves ProfessionalId empty; the API copies it from the slot.
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Bookings.IgnoreQueryFilters()
                .Where(b => b.Id == previous.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.ProfessionalId, professionalId));
        }

        var response = await PostBookingAsync(second.Id);

        await AssertOverlapConflictAsync(response);
    }

    [Fact]
    public async Task PublicReschedule_IntoAnOverlappingRange_Is409_AndBookingUnchanged()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var start = TenAm();
        var occupied = await SlotAsync(tenantId, start, 60, professionalId);
        var current = await SlotAsync(tenantId, start.AddHours(4), 60, professionalId);
        var target = await SlotAsync(tenantId, start.AddMinutes(30), 60, professionalId);
        await BookAsync(occupied.Id);
        var bookingId = await BookAsync(current.Id);

        var response = await _factory.CreateClient().PostAsJsonAsync($"/api/bookings/{bookingId}/reschedule", new { newTimeSlotId = target.Id });

        await AssertOverlapConflictAsync(response);
        await AssertUnmovedAsync(bookingId, current, target);
    }

    [Fact]
    public async Task AdminReschedule_IntoAnOverlappingRange_Is409_AndBookingUnchanged()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var start = TenAm();
        var occupied = await SlotAsync(tenantId, start, 60, professionalId);
        var current = await SlotAsync(tenantId, start.AddHours(4), 60, professionalId);
        var target = await SlotAsync(tenantId, start.AddMinutes(30), 60, professionalId);
        await BookAsync(occupied.Id);
        var bookingId = await BookAsync(current.Id);
        var admin = await AdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync($"/api/bookings/{bookingId}/admin-reschedule", new { newTimeSlotId = target.Id });

        await AssertOverlapConflictAsync(response);
        await AssertUnmovedAsync(bookingId, current, target);
    }

    private async Task AssertUnmovedAsync(int bookingId, TimeSlot current, TimeSlot target)
    {
        var booking = await ReloadAsync(bookingId);
        Assert.Equal(current.Id, booking.TimeSlotId);
        Assert.Equal(current.StartDateTime, booking.StartDateTime);
        Assert.Equal(current.EndDateTime, booking.EndDateTime);
        // Claim of the target and release of the current slot were rolled back.
        Assert.False((await ReloadSlotAsync(current.Id)).IsAvailable);
        Assert.True((await ReloadSlotAsync(target.Id)).IsAvailable);
    }

    [Fact]
    public async Task UpdateBooking_ServiceChangeExtendsIntoAnotherBooking_Is409_AndBookingUnchanged()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var shortService = await ServiceAsync(tenantId, null);
        var longService = await ServiceAsync(tenantId, 180);
        var start = TenAm();
        var early = await SlotAsync(tenantId, start, 30, professionalId);
        var later = await SlotAsync(tenantId, start.AddHours(2), 30, professionalId);
        var bookingId = await BookAsync(early.Id, shortService.Slug);
        await BookAsync(later.Id);
        var admin = await AdminClientAsync(tenantId);

        var response = await admin.PutAsJsonAsync($"/api/bookings/{bookingId}", new
        {
            customerName = "Cliente Editado",
            customerPhone = "1122334455",
            subject = "Tratamiento",
            service = longService.Slug,
            message = "Editado"
        });

        await AssertOverlapConflictAsync(response);
        var booking = await ReloadAsync(bookingId);
        Assert.Equal(shortService.Slug, booking.Service);
        Assert.Equal("Cliente Solapado", booking.CustomerName);
        Assert.Equal(early.StartDateTime, booking.StartDateTime);
        Assert.Equal(early.EndDateTime, booking.EndDateTime);
    }

    [Fact]
    public async Task ConcurrentCreates_OfOverlappingBookings_ExactlyOneWins()
    {
        var tenantId = await TenantAsync();
        var professionalId = await ProfessionalAsync(tenantId);
        var start = TenAm();
        var slots = new List<TimeSlot>();
        for (var i = 0; i < 4; i++)
            slots.Add(await SlotAsync(tenantId, start.AddMinutes(10 * i), 60, professionalId));

        var responses = await Task.WhenAll(slots.Select(s => PostBookingAsync(s.Id)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(3, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        foreach (var conflict in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
            await AssertOverlapConflictAsync(conflict);
        // Only the winner's slot stays claimed.
        var claimed = 0;
        foreach (var slot in slots)
            if (!(await ReloadSlotAsync(slot.Id)).IsAvailable) claimed++;
        Assert.Equal(1, claimed);
    }

    // A booking whose range ends at or before its start is rejected by the
    // CHECK constraint (a forgotten range would otherwise store 0001-01-01).
    [Fact]
    public async Task Database_RejectsABookingEndingAtItsStart()
    {
        var tenantId = await TenantAsync();
        var slot = await SlotAsync(tenantId, TenAm(), 60, await ProfessionalAsync(tenantId));

        string connectionString;
        using (var scope = _factory.Services.CreateScope())
            connectionString = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.GetConnectionString()!;
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var insert = new NpgsqlCommand(@"
            INSERT INTO ""Bookings"" (""TenantId"", ""TimeSlotId"", ""CustomerName"", ""Description"", ""CustomerPhone"",
                ""CustomerEmailNormalized"", ""Subject"", ""Status"", ""TermsAcceptedAt"", ""TermsVersion"", ""CreatedAt"",
                ""StartDateTime"", ""EndDateTime"")
            VALUES (@tenant, @slot, 'Sin Rango', '', '1122334455', 'sin-rango@test.com', 'Corte', 'Cancelled', now(), 'v1', now(),
                @start, @start)", connection);
        insert.Parameters.AddWithValue("tenant", tenantId);
        insert.Parameters.AddWithValue("slot", slot.Id);
        insert.Parameters.AddWithValue("start", slot.StartDateTime);

        var error = await Assert.ThrowsAsync<PostgresException>(() => insert.ExecuteNonQueryAsync());

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("CK_Bookings_EndAfterStart", error.ConstraintName);
    }
}
