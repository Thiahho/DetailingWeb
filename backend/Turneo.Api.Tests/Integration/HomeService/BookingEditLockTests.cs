using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Modules.HomeService.ServiceArea;

namespace Turneo.Api.Tests.Integration;

// Admin edit (PUT /api/bookings/{id}) is locked once a booking is confirmed or
// has an approved payment: the request is rejected before any field is assigned
// or the home-service policy runs, so the booking stays exactly as it was.
[Collection("Integration")]
public class BookingEditLockTests
{
    private const string LockedMessage = "No se puede editar una reserva confirmada o pagada";
    private readonly CustomWebApplicationFactory _factory;

    public BookingEditLockTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

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

    private async Task<CoverageLocality> CreateLocalityAsync(int tenantId, decimal? surcharge)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var locality = new CoverageLocality
        {
            TenantId = tenantId,
            Name = $"Localidad-{Guid.NewGuid():N}",
            Province = "Buenos Aires",
            Surcharge = surcharge,
            IsActive = true
        };
        db.CoverageLocalities.Add(locality);
        await db.SaveChangesAsync();
        return locality;
    }

    private static object Address(int localityId, string street = "Av. Mitre 1234") =>
        new { street, details = "2B", notes = "Portón negro", coverageLocalityId = localityId };

    private async Task<Booking> BookAsync(int tenantId, string serviceSlug, object? homeAddress)
    {
        var start = DateTime.UtcNow.AddDays(30).AddMinutes(Random.Shared.Next(1, 100_000));
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            timeSlotId = slot.Id,
            customerName = "Cliente Original",
            customerPhone = "1122334455",
            email = $"lock-{Guid.NewGuid():N}@test.com",
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
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-lock-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static Task<HttpResponseMessage> PutBookingAsync(HttpClient client, int bookingId, string serviceSlug, object? homeAddress) =>
        client.PutAsJsonAsync($"/api/bookings/{bookingId}", new
        {
            customerName = "Cliente Editado",
            customerPhone = "1199998888",
            subject = "Asunto editado",
            service = serviceSlug,
            message = "Editado por admin",
            homeAddress
        });

    private async Task<Booking> ReloadAsync(int bookingId) =>
        (await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, bookingId))!;

    private static async Task AssertLockedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(LockedMessage, body.GetProperty("message").GetString());
    }

    private static void AssertBaseFieldsUnchanged(Booking booking, string serviceSlug)
    {
        Assert.Equal("Cliente Original", booking.CustomerName);
        Assert.Equal("1122334455", booking.CustomerPhone);
        Assert.Equal("Lavado completo", booking.Subject);
        Assert.Equal(serviceSlug, booking.Service);
        Assert.Null(booking.Message);
    }

    [Fact]
    public async Task ConfirmedBooking_EditIsRejectedAndLeavesBookingAndAtHomeSnapshotUnchanged()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var original = await CreateLocalityAsync(tenantId, 500m);
        var other = await CreateLocalityAsync(tenantId, 900m);
        var booking = await BookAsync(tenantId, atHome.Slug, Address(original.Id));
        var admin = await AdminClientAsync(tenantId);
        var confirm = await admin.PatchAsync($"/api/bookings/{booking.Id}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var response = await PutBookingAsync(admin, booking.Id, atHome.Slug, Address(other.Id, street: "Calle Nueva 99"));

        await AssertLockedAsync(response);
        var unchanged = await ReloadAsync(booking.Id);
        Assert.Equal(BookingStatus.Confirmed, unchanged.Status);
        AssertBaseFieldsUnchanged(unchanged, atHome.Slug);
        Assert.Equal("Av. Mitre 1234", unchanged.HomeAddressStreet);
        Assert.Equal("2B", unchanged.HomeAddressDetails);
        Assert.Equal("Portón negro", unchanged.HomeAddressNotes);
        Assert.Equal(original.Id, unchanged.CoverageLocalityId);
        Assert.Equal(original.Name, unchanged.CoverageLocalityName);
        Assert.Equal("Buenos Aires", unchanged.CoverageLocalityProvince);
        Assert.Equal(500m, unchanged.HomeServiceSurcharge);
    }

    [Fact]
    public async Task ConfirmedBooking_LockWinsOverHomeServicePolicyErrors()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var booking = await BookAsync(tenantId, onSite.Slug, homeAddress: null);
        var admin = await AdminClientAsync(tenantId);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsync($"/api/bookings/{booking.Id}/confirm", null)).StatusCode);

        // Switching to an at-home service without an address would fail the
        // home-service policy; the lock must reject it first.
        var response = await PutBookingAsync(admin, booking.Id, atHome.Slug, homeAddress: null);

        await AssertLockedAsync(response);
        AssertBaseFieldsUnchanged(await ReloadAsync(booking.Id), onSite.Slug);
    }

    [Fact]
    public async Task PendingBookingWithApprovedPayment_EditIsRejectedAndLeavesBookingUnchanged()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var atHome = await CreateServiceAsync(tenantId, ServiceLocationType.AtHome);
        var locality = await CreateLocalityAsync(tenantId, 500m);
        var booking = await BookAsync(tenantId, atHome.Slug, Address(locality.Id));
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 1500m, PaymentStatus.Approved);

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, atHome.Slug, homeAddress: null);

        await AssertLockedAsync(response);
        var unchanged = await ReloadAsync(booking.Id);
        Assert.NotEqual(BookingStatus.Confirmed, unchanged.Status);
        AssertBaseFieldsUnchanged(unchanged, atHome.Slug);
        Assert.Equal("Av. Mitre 1234", unchanged.HomeAddressStreet);
        Assert.Equal(locality.Id, unchanged.CoverageLocalityId);
        Assert.Equal(500m, unchanged.HomeServiceSurcharge);
    }

    [Theory]
    [InlineData(PaymentStatus.Pending)]
    [InlineData(PaymentStatus.Rejected)]
    public async Task BookingWithNonApprovedPayment_EditIsAllowed(string paymentStatus)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var booking = await BookAsync(tenantId, onSite.Slug, homeAddress: null);
        await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, 1000m, paymentStatus);

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, onSite.Slug, homeAddress: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReloadAsync(booking.Id);
        Assert.Equal("Cliente Editado", updated.CustomerName);
        Assert.Equal("Editado por admin", updated.Message);
    }

    [Fact]
    public async Task UnconfirmedUnpaidBooking_EditIsAllowed()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var onSite = await CreateServiceAsync(tenantId, ServiceLocationType.OnSite);
        var booking = await BookAsync(tenantId, onSite.Slug, homeAddress: null);
        Assert.NotEqual(BookingStatus.Confirmed, booking.Status);

        var response = await PutBookingAsync(await AdminClientAsync(tenantId), booking.Id, onSite.Slug, homeAddress: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReloadAsync(booking.Id);
        Assert.Equal("Cliente Editado", updated.CustomerName);
        Assert.Equal("1199998888", updated.CustomerPhone);
        Assert.Equal("Asunto editado", updated.Subject);
        Assert.Equal("Editado por admin", updated.Message);
    }
}
