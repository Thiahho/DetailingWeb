using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;

namespace Turneo.Api.Tests.Integration;

// El AccessToken de MercadoPago está vacío en appsettings.json (sistema en
// demo, ver auditoría hallazgo a) y CustomWebApplicationFactory no lo
// sobreescribe a propósito: los tests sobre _factory corren contra el mismo
// estado de config "sin pasarela habilitada" que producción hoy.
//
// Los tests del webhook que necesitan token/secreto levantan un host aparte
// (WithConfigOverrides) con valores falsos y solo mandan notificaciones que
// no son de tipo "payment": el controller nunca llega a llamar a la API real
// de MercadoPago.
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
