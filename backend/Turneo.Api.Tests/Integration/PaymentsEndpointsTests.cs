using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Turneo.Api.Tests.Integration;

// El AccessToken de MercadoPago está vacío en appsettings.json (sistema en
// demo, ver auditoría hallazgo a) y CustomWebApplicationFactory no lo
// sobreescribe a propósito: los tests sobre _factory corren contra el mismo
// estado de config "sin pasarela habilitada" que producción hoy.
//
// Los tests del webhook que necesitan token/secreto levantan un host aparte
// (WithConfigOverrides) con valores falsos. Los que mandan notificaciones de
// tipo "payment" además reemplazan IMercadoPagoPaymentGateway por un fake:
// el controller nunca llega a llamar a la API real de MercadoPago.
[Collection("Integration")]
public class PaymentsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public PaymentsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreatePreference_ForNonexistentBooking_ReturnsNotFound()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/payments/create-preference", new { bookingId = 999_999_999 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreatePreference_WithInvalidBookingId_ReturnsBadRequest()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/payments/create-preference", new { bookingId = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePreference_ForCancelledBooking_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(20), DateTime.UtcNow.AddDays(20).AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cancelado", $"cancelado-{Guid.NewGuid():N}@test.com", status: BookingStatus.Cancelled);

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/payments/create-preference", new { bookingId = booking.Id });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePreference_WithoutGatewayConfigured_Returns500()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(21), DateTime.UtcNow.AddDays(21).AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Pagador", $"pagador-{Guid.NewGuid():N}@test.com");

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/payments/create-preference", new { bookingId = booking.Id });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    [Fact]
    public async Task Webhook_WithoutGatewayConfigured_Returns500RegardlessOfPayload()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/payments/webhook/mercadopago", new { type = "payment", data = new { id = "123" } });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    private const string WebhookUrl = "/api/payments/webhook/mercadopago";
    private const string FakeAccessToken = "TEST-fake-access-token";
    private const string FakeWebhookSecret = "fake-webhook-secret";

    private static string SignatureHeader(string secret, string dataId, string requestId, string ts)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var v1 = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"id:{dataId};request-id:{requestId};ts:{ts};"))).ToLower();
        return $"ts={ts},v1={v1}";
    }

    [Fact]
    public async Task Webhook_WithAccessTokenButNoWebhookSecret_IsRejected()
    {
        // Token en la clave legacy (MP_ACCESS_TOKEN:AccessToken): sigue valiendo como fallback.
        var host = _factory.WithConfigOverrides(new Dictionary<string, string?>
        {
            ["MP_ACCESS_TOKEN:AccessToken"] = FakeAccessToken,
            ["MercadoPago:WebhookSecret"] = null,
        });

        var response = await host.CreateClient().PostAsJsonAsync(WebhookUrl, new { type = "test", data = new { id = "123" } });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Webhook_WithSecret_MissingOrInvalidSignature_ReturnsUnauthorized()
    {
        var host = _factory.WithConfigOverrides(new Dictionary<string, string?>
        {
            ["MercadoPago:AccessToken"] = FakeAccessToken,
            ["MercadoPago:WebhookSecret"] = FakeWebhookSecret,
        });
        var client = host.CreateClient();
        var payload = new { type = "test", data = new { id = "123" } };

        var unsigned = await client.PostAsJsonAsync(WebhookUrl, payload);
        Assert.Equal(HttpStatusCode.Unauthorized, unsigned.StatusCode);

        // Firma bien formada pero calculada con otro secreto.
        var forged = new HttpRequestMessage(HttpMethod.Post, $"{WebhookUrl}?data.id=123&type=test") { Content = JsonContent.Create(payload) };
        forged.Headers.Add("x-request-id", "req-1");
        forged.Headers.Add("x-signature", SignatureHeader("otro-secreto", "123", "req-1", "1700000000"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(forged)).StatusCode);
    }

    [Fact]
    public async Task Webhook_WithSecret_ValidSignature_IsAccepted()
    {
        var host = _factory.WithConfigOverrides(new Dictionary<string, string?>
        {
            ["MercadoPago:AccessToken"] = FakeAccessToken,
            ["MercadoPago:WebhookSecret"] = FakeWebhookSecret,
        });

        var request = new HttpRequestMessage(HttpMethod.Post, $"{WebhookUrl}?data.id=123&type=test")
        {
            Content = JsonContent.Create(new { type = "test", data = new { id = "123" } })
        };
        request.Headers.Add("x-request-id", "req-1");
        request.Headers.Add("x-signature", SignatureHeader(FakeWebhookSecret, "123", "req-1", "1700000000"));

        var response = await host.CreateClient().SendAsync(request);

        // Firmada pero no es "payment": se acusa recibo sin procesar nada.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Webhook_WithPaymentsDisabled_ReturnsOkWithoutValidatingAnything()
    {
        var host = _factory.WithConfigOverrides(new Dictionary<string, string?> { ["Payments:Enabled"] = "false" });

        var response = await host.CreateClient().PostAsJsonAsync(WebhookUrl, new { type = "payment", data = new { id = "123" } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // --- Webhook "payment" con gateway falso: nunca se llama a la API real ---

    private sealed class FakeMercadoPagoPaymentGateway : IMercadoPagoPaymentGateway
    {
        private readonly Func<long, MercadoPagoPaymentInfo?> _handler;
        public FakeMercadoPagoPaymentGateway(Func<long, MercadoPagoPaymentInfo?> handler) => _handler = handler;

        public Task<MercadoPagoPaymentInfo?> GetPaymentAsync(long paymentId, CancellationToken cancellationToken = default) =>
            Task.FromResult(_handler(paymentId));
    }

    private WebApplicationFactory<Program> HostWithGateway(Func<long, MercadoPagoPaymentInfo?> handler) =>
        _factory.WithConfigOverrides(new Dictionary<string, string?>
            {
                ["MercadoPago:AccessToken"] = FakeAccessToken,
                ["MercadoPago:WebhookSecret"] = FakeWebhookSecret,
            })
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IMercadoPagoPaymentGateway>();
                services.AddSingleton<IMercadoPagoPaymentGateway>(new FakeMercadoPagoPaymentGateway(handler));
            }));

    private static HttpRequestMessage SignedPaymentNotification(string dataId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{WebhookUrl}?data.id={dataId}&type=payment")
        {
            Content = JsonContent.Create(new { type = "payment", data = new { id = dataId } })
        };
        request.Headers.Add("x-request-id", "req-pay");
        request.Headers.Add("x-signature", SignatureHeader(FakeWebhookSecret, dataId, "req-pay", "1700000000"));
        return request;
    }

    private async Task<(Booking booking, Payment payment)> SeedPendingPaymentAsync(decimal amount, int dayOffset)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var start = DateTime.UtcNow.AddDays(dayOffset);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Pagador MP", $"mp-{Guid.NewGuid():N}@test.com");
        var payment = await TestDataFactory.CreatePaymentAsync(_factory, tenantId, booking.Id, amount);
        return (booking, payment);
    }

    // Booking without a local Payment yet: the webhook arrives before create-preference saved it.
    private async Task<Booking> SeedBookingWithoutPaymentAsync(decimal? finalPrice, int dayOffset)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var start = DateTime.UtcNow.AddDays(dayOffset);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, start, start.AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Pagador MP", $"mp-{Guid.NewGuid():N}@test.com");
        await TestDataFactory.SetBookingFinalPriceAsync(_factory, booking.Id, finalPrice);
        return booking;
    }

    [Fact]
    public async Task Webhook_WithoutLocalPayment_ApprovedFullAmount_CreatesApprovedPaymentAndConfirmsBooking()
    {
        var booking = await SeedBookingWithoutPaymentAsync(5000m, 46);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 5000m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555101"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Approved, payment!.Status);
        Assert.Equal(5000m, payment.Amount);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Confirmed, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_WithoutLocalPayment_ApprovedLowerAmount_KeepsPaymentAndBookingPending()
    {
        var booking = await SeedBookingWithoutPaymentAsync(5000m, 47);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 1m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555102"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Pending, payment!.Status);
        Assert.Equal(5000m, payment.Amount);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Pending, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_WithoutLocalPayment_UsesServicePriceWhenBookingHasNoFinalPrice()
    {
        var booking = await SeedBookingWithoutPaymentAsync(null, 49);
        var service = await TestDataFactory.CreateServiceAsync(_factory, booking.TenantId, "Corte MP"); // Price "1000"
        await TestDataFactory.SetBookingServiceAsync(_factory, booking.Id, service.Slug);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 1000m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555104"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(1000m, payment!.Amount);
        Assert.Equal(PaymentStatus.Approved, payment.Status);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Confirmed, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_WithoutLocalPayment_IgnoresServiceFromAnotherTenant()
    {
        var booking = await SeedBookingWithoutPaymentAsync(null, 50);
        var otherTenant = await TestDataFactory.CreateTenantAsync(_factory, $"otro-{Guid.NewGuid():N}"[..20], "Otro negocio");
        var foreignService = await TestDataFactory.CreateServiceAsync(_factory, otherTenant.Id, "Corte ajeno"); // Price "1000"
        await TestDataFactory.SetBookingServiceAsync(_factory, booking.Id, foreignService.Slug);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 1000m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555105"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(0m, payment!.Amount);
        Assert.Equal(PaymentStatus.Pending, payment.Status);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Pending, updatedBooking!.Status);
    }

    // At-home booking: the surcharge frozen on the booking is part of the expected charge.
    private async Task<Booking> SeedAtHomeBookingWithoutPaymentAsync(decimal? finalPrice, decimal surcharge, int dayOffset)
    {
        var booking = await SeedBookingWithoutPaymentAsync(finalPrice, dayOffset);
        var service = await TestDataFactory.CreateServiceAsync(_factory, booking.TenantId, "Lavado MP"); // Price "1000"
        await TestDataFactory.SetBookingServiceAsync(_factory, booking.Id, service.Slug);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Bookings.IgnoreQueryFilters().Where(b => b.Id == booking.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.HomeServiceSurcharge, surcharge));
        return booking;
    }

    [Theory]
    [InlineData(null, 1500, "555106")]
    [InlineData(800, 1300, "555107")]
    public async Task Webhook_WithoutLocalPayment_AtHomeBooking_ExpectsPricePlusSurcharge(int? finalPrice, int expected, string paymentId)
    {
        var booking = await SeedAtHomeBookingWithoutPaymentAsync(finalPrice, 500m, finalPrice is null ? 51 : 52);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), expected, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification(paymentId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(expected, payment!.Amount);
        Assert.Equal(PaymentStatus.Approved, payment.Status);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Confirmed, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_WithoutLocalPayment_AtHomeBookingPaidWithoutSurcharge_KeepsPending()
    {
        var booking = await SeedAtHomeBookingWithoutPaymentAsync(null, 500m, 53);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 1000m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555108"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(1500m, payment!.Amount);
        Assert.Equal(PaymentStatus.Pending, payment.Status);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Pending, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_WithoutLocalPayment_AndNoKnownPrice_KeepsPaymentAndBookingPending()
    {
        var booking = await SeedBookingWithoutPaymentAsync(null, 48);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 1m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555103"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Pending, payment!.Status);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Pending, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_ApprovedPaymentWithMatchingAmount_ApprovesPaymentAndConfirmsBooking()
    {
        var (booking, _) = await SeedPendingPaymentAsync(10000m, 40);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 10000m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555001"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Approved, payment!.Status);
        Assert.NotNull(payment.PaidAt);
        Assert.Equal("555001", payment.ExternalPaymentId);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Confirmed, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_ApprovedPaymentWithLowerAmount_KeepsPaymentAndBookingPending()
    {
        var (booking, _) = await SeedPendingPaymentAsync(10000m, 41);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 1m, "ARS", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555002"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Pending, payment!.Status);
        Assert.Null(payment.PaidAt);
        Assert.Equal("555002", payment.ExternalPaymentId);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Pending, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_ApprovedPaymentInOtherCurrency_KeepsPaymentAndBookingPending()
    {
        var (booking, _) = await SeedPendingPaymentAsync(10000m, 42);
        var host = HostWithGateway(id => new MercadoPagoPaymentInfo(id, "approved", booking.Id.ToString(), 10000m, "USD", "visa", "payer@test.com"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555003"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payment = await TestDataFactory.GetPaymentByBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(PaymentStatus.Pending, payment!.Status);
        var updatedBooking = await TestDataFactory.GetBookingIgnoringTenantAsync(_factory, booking.Id);
        Assert.Equal(BookingStatus.Pending, updatedBooking!.Status);
    }

    [Fact]
    public async Task Webhook_WhenGatewayFails_Returns500SoMercadoPagoRetries()
    {
        var host = HostWithGateway(_ => throw new HttpRequestException("MercadoPago unreachable"));

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("555004"));

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    [Fact]
    public async Task Webhook_WithNonNumericPaymentId_ReturnsOkWithoutCallingGateway()
    {
        var called = false;
        var host = HostWithGateway(_ => { called = true; return null; });

        var response = await host.CreateClient().SendAsync(SignedPaymentNotification("not-a-number"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(called);
    }

    [Fact]
    public async Task GetPaymentByBooking_WithNoPayment_ReturnsNotFound()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/payments/999999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetAllPayments_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/payments");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
