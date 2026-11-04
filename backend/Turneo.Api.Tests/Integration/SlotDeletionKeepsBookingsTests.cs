using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Turneo.Api.Tests.Integration;

// Deleting or cleaning up slots never deletes bookings or payments: Booking -> TimeSlot
// and Payment -> Booking are ON DELETE RESTRICT, and every slot-deleting path skips
// slots that have any booking (any status, Cancelled included). Each test uses its
// own tenant because expired cleanup and regeneration act on the whole tenant.
[Collection("Integration")]
public class SlotDeletionKeepsBookingsTests
{
    private const string ForeignKeyViolation = "23503";
    private static readonly TimeZoneInfo ArgentinaZone =
        TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");

    private readonly CustomWebApplicationFactory _factory;

    public SlotDeletionKeepsBookingsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static DateTime NowArgentina() => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ArgentinaZone);

    private async Task<int> CreateTenantAsync(string name) =>
        (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-slotdel-{Guid.NewGuid():N}", name)).Id;

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-slotdel-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private async Task<(Booking Booking, Payment Payment)> CreateBookingWithPaymentAsync(int tenantId, int slotId, string status)
    {
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slotId, "Cliente Historial", $"hist-{Guid.NewGuid():N}@test.com", status);
        var payment = await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 5000m, PaymentStatus.Rejected);
        return (booking, payment);
    }

    private async Task AssertBookingAndPaymentExistAsync(int bookingId)
    {
        Assert.NotNull(await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId));
        Assert.NotNull(await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, bookingId));
    }

    [Fact]
    public async Task DeleteSlot_WithCancelledBooking_ReturnsBadRequestAndKeepsBookingAndPayment()
    {
        var tenantId = await CreateTenantAsync("Salón Borrado Con Reserva");
        var start = NowArgentina().Date.AddDays(10).AddHours(10);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var (booking, _) = await CreateBookingWithPaymentAsync(tenantId, slot.Id, BookingStatus.Cancelled);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/timeslots/{slot.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Este horario tiene reservas registradas y no se puede borrar", body.GetProperty("message").GetString());
        Assert.NotNull(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id));
        await AssertBookingAndPaymentExistAsync(booking.Id);
    }

    [Fact]
    public async Task DeleteSlot_ExpiredWithBooking_ReturnsBadRequestAndKeepsBooking()
    {
        var tenantId = await CreateTenantAsync("Salón Borrado Vencido Con Reserva");
        var start = NowArgentina().Date.AddDays(-3).AddHours(10);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);
        var (booking, _) = await CreateBookingWithPaymentAsync(tenantId, slot.Id, BookingStatus.Confirmed);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/timeslots/{slot.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertBookingAndPaymentExistAsync(booking.Id);
    }

    [Fact]
    public async Task DeleteSlot_WithoutBookings_DeletesTheSlot()
    {
        var tenantId = await CreateTenantAsync("Salón Borrado Sin Reserva");
        var start = NowArgentina().Date.AddDays(10).AddHours(11);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/timeslots/{slot.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id));
    }

    [Fact]
    public async Task DeleteExpired_RemovesOnlyExpiredSlotsWithoutBookings_ComparingWithArgentinaNow()
    {
        var tenantId = await CreateTenantAsync("Salón Limpieza Vencidos");
        var now = NowArgentina();
        var expiredEmpty = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, now.AddDays(-2), now.AddDays(-2).AddHours(1));
        var expiredWithBooking = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, now.AddDays(-2).AddHours(2), now.AddDays(-2).AddHours(3));
        var (booking, _) = await CreateBookingWithPaymentAsync(tenantId, expiredWithBooking.Id, BookingStatus.Cancelled);
        // Ends in one hour Argentina time: already "past" if compared with UTC (Argentina is UTC-3).
        var endsSoon = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, now.AddMinutes(-30), now.AddHours(1));
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.DeleteAsync("/api/bookings/expired");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, body.GetProperty("deletedTimeSlots").GetInt32());
        Assert.Null(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, expiredEmpty.Id));
        Assert.NotNull(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, expiredWithBooking.Id));
        Assert.NotNull(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, endsSoon.Id));
        await AssertBookingAndPaymentExistAsync(booking.Id);
    }

    [Fact]
    public async Task DeleteExpired_DoesNotTouchOtherTenants()
    {
        var tenantA = await CreateTenantAsync("Salón Limpieza A");
        var tenantB = await CreateTenantAsync("Salón Limpieza B");
        var past = NowArgentina().AddDays(-2);
        var slotB = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantB, past, past.AddHours(1));
        var client = await CreateAdminClientAsync(tenantA);

        var response = await client.DeleteAsync("/api/bookings/expired");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slotB.Id));
    }

    [Fact]
    public async Task RegenerateSlots_KeepsAvailableSlotsThatHaveCancelledBookings()
    {
        var tenantId = await CreateTenantAsync("Salón Regeneración");
        var day = DateTime.Today.AddDays(2);
        var withCancelled = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, day.AddHours(3).AddMinutes(17), day.AddHours(3).AddMinutes(47));
        var (booking, _) = await CreateBookingWithPaymentAsync(tenantId, withCancelled.Id, BookingStatus.Cancelled);
        var empty = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, day.AddHours(4).AddMinutes(17), day.AddHours(4).AddMinutes(47));
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PutAsJsonAsync("/api/businesssettings", new
        {
            daysOfWeek = new[] { 1, 2, 3, 4, 5 },
            startTime = "09:00",
            slotDuration = 60,
            breakBetweenSlots = 0,
            maxDaysInAdvance = 3
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, withCancelled.Id));
        Assert.Null(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, empty.Id));
        await AssertBookingAndPaymentExistAsync(booking.Id);
    }

    [Fact]
    public async Task BlockDate_KeepsAvailableSlotsThatHaveBookings()
    {
        var tenantId = await CreateTenantAsync("Salón Bloqueo");
        var date = DateTime.UtcNow.Date.AddDays(27);
        var withCancelled = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, date.AddHours(10), date.AddHours(11));
        var (booking, _) = await CreateBookingWithPaymentAsync(tenantId, withCancelled.Id, BookingStatus.Cancelled);
        var empty = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, date.AddHours(12), date.AddHours(13));
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PostAsJsonAsync("/api/blockeddates", new { date, reason = "Feriado" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Fecha bloqueada. 1 turnos eliminados.", body.GetProperty("message").GetString());
        Assert.NotNull(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, withCancelled.Id));
        Assert.Null(await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, empty.Id));
        await AssertBookingAndPaymentExistAsync(booking.Id);
    }

    [Fact]
    public async Task ReleaseSlot_PendingBookingWithPayment_IsCancelledInsteadOfDeleted()
    {
        var tenantId = await CreateTenantAsync("Salón Habilitar Con Pago");
        var start = NowArgentina().Date.AddDays(12).AddHours(10);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);
        var (booking, _) = await CreateBookingWithPaymentAsync(tenantId, slot.Id, BookingStatus.Pending);
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PutAsync($"/api/timeslots/{slot.Id}/release", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.NotNull(reloaded);
        Assert.Equal(BookingStatus.Cancelled, reloaded!.Status);
        Assert.NotNull(await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id));
        Assert.True((await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id))!.IsAvailable);
    }

    [Fact]
    public async Task ReleaseSlot_PendingBookingWithoutPayment_IsStillDeleted()
    {
        var tenantId = await CreateTenantAsync("Salón Habilitar Sin Pago");
        var start = NowArgentina().Date.AddDays(12).AddHours(11);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Pendiente", $"pend-{Guid.NewGuid():N}@test.com");
        var client = await CreateAdminClientAsync(tenantId);

        var response = await client.PutAsync($"/api/timeslots/{slot.Id}/release", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id));
    }

    [Fact]
    public async Task Database_RejectsDeletingASlotThatHasABooking()
    {
        var tenantId = await CreateTenantAsync("Salón FK Turno");
        var start = NowArgentina().Date.AddDays(15).AddHours(10);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente FK", $"fk-{Guid.NewGuid():N}@test.com", BookingStatus.Cancelled);

        var ex = await Assert.ThrowsAnyAsync<Exception>(async () =>
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.TimeSlots.IgnoreQueryFilters().Where(t => t.Id == slot.Id).ExecuteDeleteAsync();
        });

        Assert.Equal(ForeignKeyViolation, FindPostgresException(ex)?.SqlState);
        Assert.NotNull(await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id));
    }

    [Fact]
    public async Task Database_RejectsDeletingABookingThatHasAPayment()
    {
        var tenantId = await CreateTenantAsync("Salón FK Pago");
        var start = NowArgentina().Date.AddDays(15).AddHours(11);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var (booking, _) = await CreateBookingWithPaymentAsync(tenantId, slot.Id, BookingStatus.Cancelled);

        var ex = await Assert.ThrowsAnyAsync<Exception>(async () =>
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Bookings.IgnoreQueryFilters().Where(b => b.Id == booking.Id).ExecuteDeleteAsync();
        });

        Assert.Equal(ForeignKeyViolation, FindPostgresException(ex)?.SqlState);
        await AssertBookingAndPaymentExistAsync(booking.Id);
    }

    private static PostgresException? FindPostgresException(Exception? ex)
    {
        while (ex != null)
        {
            if (ex is PostgresException pg) return pg;
            ex = ex.InnerException;
        }
        return null;
    }
}
