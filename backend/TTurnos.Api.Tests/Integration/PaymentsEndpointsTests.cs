using System.Net;
using System.Net.Http.Json;

namespace TTurnos.Api.Tests.Integration;

// El AccessToken de MercadoPago está vacío en appsettings.json (sistema en
// demo, ver auditoría hallazgo a) y CustomWebApplicationFactory no lo
// sobreescribe a propósito: estos tests corren contra el mismo estado de
// config "sin pasarela habilitada" que producción hoy.
//
// Hallazgo encontrado al escribir esta suite (no estaba en la auditoría):
// el webhook lee la clave de configuración "MP_ACCESS_TOKEN:AccessToken"
// (PaymentsController.cs:141), que no existe en ningún appsettings — la
// clave real es "MercadoPago:AccessToken". Como consecuencia, el webhook
// devuelve 500 para *cualquier* notificación de MercadoPago, sin importar
// si la firma es válida o no; el hallazgo (a) de la auditoría (firma HMAC
// opcional) es hoy inalcanzable en la práctica porque el webhook nunca
// llega a evaluarla. Reportado aparte al usuario, no corregido acá.
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
