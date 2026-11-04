using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

// PUT /api/timeslots/{id}/release must not cancel a booking with an approved
// payment (those go through POST /api/bookings/{id}/admin-cancel-refund).
// GET /api/timeslots accepts an optional from/to date range (inclusive days,
// Argentina wall-clock dates like StartDateTime) and carries the payment of
// each slot's booking; the public /available endpoint never does.
[Collection("Integration")]
public class TimeSlotsPaidReleaseAndRangeTests
{
    private const string PaidReleaseMessage =
        "Esta reserva está pagada. Usá \"Cancelar y devolver\" para cancelarla y registrar la devolución.";

    private readonly CustomWebApplicationFactory _factory;

    public TimeSlotsPaidReleaseAndRangeTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(int TenantId, HttpClient Admin)> NewTenantWithAdminAsync()
    {
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, $"slots-{Guid.NewGuid():N}", "Negocio Turnos");
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenant.Id, $"admin-slots-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenant.Id));
        return (tenant.Id, client);
    }

    private async Task<(TimeSlot Slot, Booking Booking)> CreateReservedSlotAsync(int tenantId, string bookingStatus, DateTime? start = null)
    {
        var from = start ?? DateTime.UtcNow.AddDays(20).AddMinutes(Random.Shared.Next(1, 100_000));
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, from, from.AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Turno",
            $"slot-{Guid.NewGuid():N}@test.com", bookingStatus);
        return (slot, booking);
    }

    private static async Task<string?> MessageAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.TryGetProperty("message", out var message) ? message.GetString() : null;
    }

    private static async Task<List<JsonElement>> GetSlotsAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/timeslots{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<JsonElement>>())!;
    }

    // ---- Release of paid bookings ----

    [Theory]
    [InlineData(BookingStatus.Confirmed)]
    [InlineData(BookingStatus.Pending)]
    public async Task Release_BookingWithApprovedPayment_IsRejectedAndChangesNothing(string bookingStatus)
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var (slot, booking) = await CreateReservedSlotAsync(tenantId, bookingStatus);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 3000m, PaymentStatus.Approved);

        var response = await admin.PutAsync($"/api/timeslots/{slot.Id}/release", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(PaidReleaseMessage, body.GetProperty("message").GetString());

        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.NotNull(reloaded);
        Assert.Equal(bookingStatus, reloaded!.Status);
        Assert.Null(reloaded.CancelledAt);
        Assert.False((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id))!.IsAvailable);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Approved, payment!.Status);
    }

    [Fact]
    public async Task Release_UnpaidConfirmedBooking_CancelsItAndFreesTheSlot()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var (slot, booking) = await CreateReservedSlotAsync(tenantId, BookingStatus.Confirmed);

        var response = await admin.PutAsync($"/api/timeslots/{slot.Id}/release", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Cancelled, reloaded!.Status);
        Assert.NotNull(reloaded.CancelledAt);
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id))!.IsAvailable);
    }

    [Fact]
    public async Task Release_UnpaidPendingBooking_DeletesItAndFreesTheSlot()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var (slot, booking) = await CreateReservedSlotAsync(tenantId, BookingStatus.Pending);

        var response = await admin.PutAsync($"/api/timeslots/{slot.Id}/release", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id));
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id))!.IsAvailable);
    }

    [Theory]
    [InlineData(PaymentStatus.Pending)]
    [InlineData(PaymentStatus.Rejected)]
    [InlineData(PaymentStatus.Refunded)]
    public async Task Release_BookingWithNonApprovedPayment_IsAllowed(string paymentStatus)
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var (slot, booking) = await CreateReservedSlotAsync(tenantId, BookingStatus.Confirmed);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 3000m, paymentStatus);

        var response = await admin.PutAsync($"/api/timeslots/{slot.Id}/release", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Cancelled, reloaded!.Status);
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id))!.IsAvailable);
    }

    // ---- GET /api/timeslots date range ----

    [Fact]
    public async Task GetAll_WithRange_ReturnsOnlySlotsStartingInsideTheInclusiveDays()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var beforeFrom = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 3, 9, 23, 30, 0), new DateTime(2031, 3, 10, 0, 30, 0));
        var atFrom = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 3, 10, 0, 0, 0), new DateTime(2031, 3, 10, 1, 0, 0));
        var middle = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 3, 11, 12, 0, 0), new DateTime(2031, 3, 11, 13, 0, 0));
        var endOfTo = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 3, 12, 23, 59, 0), new DateTime(2031, 3, 13, 0, 59, 0));
        var afterTo = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 3, 13, 0, 0, 0), new DateTime(2031, 3, 13, 1, 0, 0));

        var ids = (await GetSlotsAsync(admin, "?from=2031-03-10&to=2031-03-12"))
            .Select(s => s.GetProperty("id").GetInt32()).ToList();

        Assert.Equal(new[] { atFrom.Id, middle.Id, endOfTo.Id }, ids);
        Assert.DoesNotContain(beforeFrom.Id, ids);
        Assert.DoesNotContain(afterTo.Id, ids);
    }

    [Fact]
    public async Task GetAll_WithOnlyFromOrOnlyTo_IsOpenEndedOnTheOtherSide()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var early = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 5, 1, 10, 0, 0), new DateTime(2031, 5, 1, 11, 0, 0));
        var late = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 5, 20, 10, 0, 0), new DateTime(2031, 5, 20, 11, 0, 0));

        var fromOnly = (await GetSlotsAsync(admin, "?from=2031-05-10")).Select(s => s.GetProperty("id").GetInt32()).ToList();
        var toOnly = (await GetSlotsAsync(admin, "?to=2031-05-10")).Select(s => s.GetProperty("id").GetInt32()).ToList();

        Assert.Contains(late.Id, fromOnly);
        Assert.DoesNotContain(early.Id, fromOnly);
        Assert.Contains(early.Id, toOnly);
        Assert.DoesNotContain(late.Id, toOnly);
    }

    [Fact]
    public async Task GetAll_WithoutRange_StillReturnsEverySlotOfTheTenant()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var past = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2020, 1, 1, 10, 0, 0), new DateTime(2020, 1, 1, 11, 0, 0));
        var future = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2035, 1, 1, 10, 0, 0), new DateTime(2035, 1, 1, 11, 0, 0));

        var ids = (await GetSlotsAsync(admin)).Select(s => s.GetProperty("id").GetInt32()).ToList();

        Assert.Equal(new[] { past.Id, future.Id }, ids);
    }

    [Fact]
    public async Task GetAll_WithFromAfterTo_ReturnsBadRequest()
    {
        var (_, admin) = await NewTenantWithAdminAsync();

        var response = await admin.GetAsync("/api/timeslots?from=2031-03-12&to=2031-03-10");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("La fecha \"desde\" no puede ser posterior a \"hasta\"", await MessageAsync(response));
    }

    [Fact]
    public async Task GetAll_WithRange_NeverReturnsAnotherTenantsSlots()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var (otherTenantId, _) = await NewTenantWithAdminAsync();
        var mine = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, new DateTime(2031, 7, 1, 10, 0, 0), new DateTime(2031, 7, 1, 11, 0, 0));
        var theirs = await TestDataFactory.CreateTimeSlotAsync(_factory, otherTenantId, new DateTime(2031, 7, 1, 10, 0, 0), new DateTime(2031, 7, 1, 11, 0, 0));

        var ids = (await GetSlotsAsync(admin, "?from=2031-07-01&to=2031-07-01")).Select(s => s.GetProperty("id").GetInt32()).ToList();

        Assert.Contains(mine.Id, ids);
        Assert.DoesNotContain(theirs.Id, ids);
    }

    // ---- Payment info on the slot booking ----

    [Fact]
    public async Task GetAll_IncludesThePaymentOfEachSlotBooking()
    {
        var (tenantId, admin) = await NewTenantWithAdminAsync();
        var (paidSlot, paidBooking) = await CreateReservedSlotAsync(tenantId, BookingStatus.Confirmed, new DateTime(2031, 8, 1, 10, 0, 0));
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, paidBooking.Id, 4500m, PaymentStatus.Approved);
        var (unpaidSlot, _) = await CreateReservedSlotAsync(tenantId, BookingStatus.Pending, new DateTime(2031, 8, 1, 12, 0, 0));

        var slots = await GetSlotsAsync(admin, "?from=2031-08-01&to=2031-08-01");

        var paid = slots.Single(s => s.GetProperty("id").GetInt32() == paidSlot.Id).GetProperty("booking");
        Assert.Equal(PaymentStatus.Approved, paid.GetProperty("paymentStatus").GetString());
        Assert.Equal(4500m, paid.GetProperty("paymentAmount").GetDecimal());

        var unpaid = slots.Single(s => s.GetProperty("id").GetInt32() == unpaidSlot.Id).GetProperty("booking");
        Assert.Equal(JsonValueKind.Null, unpaid.GetProperty("paymentStatus").ValueKind);
        Assert.Equal(JsonValueKind.Null, unpaid.GetProperty("paymentAmount").ValueKind);
    }

    [Fact]
    public async Task GetAvailable_NeverExposesPaymentFields()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var start = DateTime.UtcNow.AddDays(40).AddMinutes(Random.Shared.Next(1, 100_000));
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));

        var response = await _factory.CreateClient().GetAsync("/api/timeslots/available");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains($"\"id\":{slot.Id}", raw);
        Assert.DoesNotContain("payment", raw, StringComparison.OrdinalIgnoreCase);
    }
}
