using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Los endpoints públicos de este controller comparten la política
// "public-booking" (20 req/min por IP, IP nula en TestServer → un solo
// balde para toda la clase). Se mantiene el conteo de llamadas HTTP bien
// por debajo del límite sembrando directo en la base todo lo que no sea el
// comportamiento bajo prueba (ver TestDataFactory).
[Collection("Integration")]
public class BookingsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public BookingsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static object CreateBookingPayload(int timeSlotId, string? email = null) => new
    {
        timeSlotId,
        customerName = "Cliente de Prueba",
        customerPhone = "1122334455",
        email = email ?? $"cliente-{Guid.NewGuid():N}@test.com",
        subject = "Corte de pelo",
        acceptedTerms = true
    };

    [Fact]
    public async Task CreateBooking_WithAvailableSlot_ReturnsOkAndMarksSlotUnavailable()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(1));

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/bookings", CreateBookingPayload(slot.Id));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var updatedSlot = await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id);
        Assert.False(updatedSlot!.IsAvailable);
    }

    [Fact]
    public async Task CreateBooking_WithAlreadyTakenSlot_ReturnsConflict()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/bookings", CreateBookingPayload(slot.Id));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task CreateBooking_WithInvalidEmail_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(3), DateTime.UtcNow.AddDays(3).AddHours(1));

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/bookings", CreateBookingPayload(slot.Id, email: "esto-no-es-un-email"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetBookingsByEmail_ReturnsOnlyMatchingBookings()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(4), DateTime.UtcNow.AddDays(4).AddHours(1));
        var email = $"buscar-{Guid.NewGuid():N}@test.com";
        await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Buscado", email);

        var otherSlot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(1));
        await TestDataFactory.CreateBookingAsync(_factory, tenantId, otherSlot.Id, "Otro Cliente", $"otro-{Guid.NewGuid():N}@test.com");

        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/bookings/by-email?email={Uri.EscapeDataString(email)}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var results = await response.Content.ReadFromJsonAsync<List<System.Text.Json.JsonElement>>();
        Assert.Single(results!);
    }

    [Fact]
    public async Task CancelBooking_MarksStatusCancelledAndFreesSlot()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(6), DateTime.UtcNow.AddDays(6).AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, slot.Id, isAvailable: false);
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "A Cancelar", $"cancelar-{Guid.NewGuid():N}@test.com");

        var client = _factory.CreateClient();
        var response = await client.PostAsync($"/api/bookings/{booking.Id}/cancel", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Cancelled, reloaded!.Status);

        var reloadedSlot = await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, slot.Id);
        Assert.True(reloadedSlot!.IsAvailable);
    }

    [Fact]
    public async Task RescheduleBooking_MovesToNewSlotAndFreesOldOne()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var oldSlot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(1));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, oldSlot.Id, isAvailable: false);
        var newSlot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(8), DateTime.UtcNow.AddDays(8).AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, oldSlot.Id, "A Reprogramar", $"reprogramar-{Guid.NewGuid():N}@test.com");

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync($"/api/bookings/{booking.Id}/reschedule", new { newTimeSlotId = newSlot.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var reloaded = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(newSlot.Id, reloaded!.TimeSlotId);

        var reloadedOldSlot = await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, oldSlot.Id);
        Assert.True(reloadedOldSlot!.IsAvailable);

        var reloadedNewSlot = await TestDataFactory.GetTimeSlotIgnoringTenantAsync(_factory, newSlot.Id);
        Assert.False(reloadedNewSlot!.IsAvailable);
    }

    [Fact]
    public async Task GetAllBookings_WithoutAdminToken_ReturnsUnauthorized()
    {
        // No rate-limited: [Authorize(Roles = "Admin")] sin [EnableRateLimiting].
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/bookings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateBooking_WithSmartTagTokenFromSameTenant_RecordsBookingCompletedEvent()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(9), DateTime.UtcNow.AddDays(9).AddHours(1));
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Recepción", action: "BOOKING");

        var payload = new
        {
            timeSlotId = slot.Id,
            customerName = "Cliente Smart Tag",
            customerPhone = "1122334455",
            email = $"smarttag-{Guid.NewGuid():N}@test.com",
            subject = "Corte de pelo",
            smartTagToken = tag.Token,
            acceptedTerms = true,
        };

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/bookings", payload);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var events = await db.SmartTagEvents.IgnoreQueryFilters()
            .Where(e => e.SmartTagId == tag.Id).ToListAsync();

        Assert.Single(events);
        Assert.Equal(SmartTagEventType.BookingCompleted, events[0].EventType);
        Assert.Equal(tenantId, events[0].TenantId);
    }

    [Fact]
    public async Task CreateBooking_WithSmartTagTokenFromAnotherTenant_CreatesBookingButRecordsNoEvent()
    {
        var tenantA = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tenantB = (await TestDataFactory.CreateTenantAsync(_factory, $"tenant-b-{Guid.NewGuid():N}", "Salón B")).Id;
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantA, DateTime.UtcNow.AddDays(9), DateTime.UtcNow.AddDays(9).AddHours(1));
        // El tag pertenece a OTRO tenant (B) que el de la reserva que se va a crear (A).
        var foreignTag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantB, "Recepción B", action: "BOOKING");

        var payload = new
        {
            timeSlotId = slot.Id,
            customerName = "Cliente Smart Tag",
            customerPhone = "1122334455",
            email = $"smarttag-cross-{Guid.NewGuid():N}@test.com",
            subject = "Corte de pelo",
            smartTagToken = foreignTag.Token,
            acceptedTerms = true,
        };

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/bookings", payload);

        // La reserva se crea igual — el token de otro tenant nunca bloquea la reserva.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var eventCount = await db.SmartTagEvents.IgnoreQueryFilters()
            .CountAsync(e => e.SmartTagId == foreignTag.Id);

        Assert.Equal(0, eventCount);
    }
}
