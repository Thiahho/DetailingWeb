using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Deleting a professional sets its bookings' ProfessionalId to NULL (FK SET
// NULL), which can collide with the overlap constraint on null-professional
// bookings. So DELETE /api/professionals/{id} is blocked with 409 while the
// professional still has active (non-cancelled) bookings that end in the
// future; past or cancelled bookings never block it.
[Collection("Integration")]
public class ProfessionalDeleteWithBookingsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public ProfessionalDeleteWithBookingsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // Random far-future / far-past days: each test uses its own professional,
    // so its bookings never collide with other tests' bookings.
    private static DateTime FutureTenAm() =>
        new DateTime(2041, 1, 1, 10, 0, 0).AddDays(Random.Shared.Next(0, 20_000));

    private static DateTime PastTenAm() =>
        new DateTime(2001, 1, 1, 10, 0, 0).AddDays(Random.Shared.Next(0, 3_000));

    private async Task<HttpClient> AdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-delprof-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private async Task<Booking> BookingAsync(int tenantId, int professionalId, DateTime start, string status)
    {
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1), professionalId);
        return await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Baja",
            $"baja-{Guid.NewGuid():N}@test.com", status, professionalId: professionalId);
    }

    private async Task<bool> ProfessionalExistsAsync(int professionalId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Professionals.IgnoreQueryFilters().AnyAsync(p => p.Id == professionalId);
    }

    private static async Task AssertBlockedAsync(HttpResponseMessage response, string expectedMessage)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(expectedMessage, body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Delete_WithFuturePendingBooking_Is409_AndNothingChanges()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, "ConTurno");
        var booking = await BookingAsync(tenantId, professional.Id, FutureTenAm(), BookingStatus.Pending);
        var client = await AdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/professionals/{professional.Id}");

        await AssertBlockedAsync(response,
            "Este profesional tiene 1 turno activo pendiente. Reasignalo o cancelalo antes de eliminarlo.");
        Assert.True(await ProfessionalExistsAsync(professional.Id));
        var reloaded = (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id))!;
        Assert.Equal(professional.Id, reloaded.ProfessionalId);
        Assert.Equal(BookingStatus.Pending, reloaded.Status);
    }

    [Fact]
    public async Task Delete_WithFutureConfirmedBookings_Is409_WithTheCount()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, "Confirmados");
        var start = FutureTenAm();
        var first = await BookingAsync(tenantId, professional.Id, start, BookingStatus.Confirmed);
        var second = await BookingAsync(tenantId, professional.Id, start.AddHours(2), BookingStatus.Confirmed);
        // Cancelled and past bookings are not counted.
        await BookingAsync(tenantId, professional.Id, start.AddHours(4), BookingStatus.Cancelled);
        await BookingAsync(tenantId, professional.Id, PastTenAm(), BookingStatus.Confirmed);
        var client = await AdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/professionals/{professional.Id}");

        await AssertBlockedAsync(response,
            "Este profesional tiene 2 turnos activos pendientes. Reasignalos o cancelalos antes de eliminarlo.");
        Assert.True(await ProfessionalExistsAsync(professional.Id));
        Assert.Equal(professional.Id, (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, first.Id))!.ProfessionalId);
        Assert.Equal(professional.Id, (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, second.Id))!.ProfessionalId);
    }

    [Fact]
    public async Task Delete_WithOnlyCancelledFutureBookings_IsAllowed()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, "Cancelados");
        var booking = await BookingAsync(tenantId, professional.Id, FutureTenAm(), BookingStatus.Cancelled);
        var client = await AdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/professionals/{professional.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(await ProfessionalExistsAsync(professional.Id));
        // FK SET NULL keeps the booking, now without professional.
        Assert.Null((await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id))!.ProfessionalId);
    }

    [Fact]
    public async Task Delete_WithOnlyPastBookings_IsAllowed()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, "Pasados");
        var booking = await BookingAsync(tenantId, professional.Id, PastTenAm(), BookingStatus.Confirmed);
        var client = await AdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/professionals/{professional.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(await ProfessionalExistsAsync(professional.Id));
        Assert.Null((await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id))!.ProfessionalId);
    }

    [Fact]
    public async Task Delete_WithNoBookings_IsAllowed()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId, "SinTurnos");
        var client = await AdminClientAsync(tenantId);

        var response = await client.DeleteAsync($"/api/professionals/{professional.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(await ProfessionalExistsAsync(professional.Id));
    }

    [Fact]
    public async Task Delete_OtherTenantsBookings_DoNotBlock()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-delprof-{Guid.NewGuid():N}", "Salón B")).Id;
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantA, "OtroTenant");
        // A future booking of tenant B pointing at tenant A's professional id is
        // outside tenant A's scope and must not be counted.
        await BookingAsync(tenantB, professional.Id, FutureTenAm(), BookingStatus.Pending);
        var client = await AdminClientAsync(tenantA);

        var response = await client.DeleteAsync($"/api/professionals/{professional.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(await ProfessionalExistsAsync(professional.Id));
    }
}
