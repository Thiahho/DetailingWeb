using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace TTurnos.Api.Tests.Integration;

// Cubre la distinción venta vs. uso interno de un insumo (BookingItem.IsSale):
// un insumo VENDIDO se cobra al cliente (precio real, cuenta como venta) y no
// aparece como "insumo usado" en el historial del cliente; un insumo de USO
// INTERNO es costo (precio forzado a 0) y sí aparece como usado en el servicio.
[Collection("Integration")]
public class BookingDetailInsumoSaleTests
{
    private readonly CustomWebApplicationFactory _factory;

    public BookingDetailInsumoSaleTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-sale-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    [Fact]
    public async Task SaveDetail_WithInsumoMarkedAsSale_KeepsRealPrice()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(20), DateTime.UtcNow.AddDays(20).AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Venta", $"venta-{Guid.NewGuid():N}@test.com");
        var insumo = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Esmalte-{Guid.NewGuid():N}", stock: 10);

        var response = await admin.PutAsJsonAsync($"/api/bookings/{booking.Id}/detail", new
        {
            photoUrlsBefore = (string?)null,
            photoUrlsAfter = (string?)null,
            items = new[]
            {
                new { itemType = "Insumo", insumoId = insumo.Id, isSale = true, name = insumo.Name, quantity = 1, unitPrice = 2500 }
            }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var listResponse = await admin.GetAsync("/api/bookings");
        var bookings = await listResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
        var savedBooking = bookings!.Single(b => b.GetProperty("id").GetInt32() == booking.Id);
        var savedItem = savedBooking.GetProperty("items").EnumerateArray().Single();

        Assert.True(savedItem.GetProperty("isSale").GetBoolean());
        Assert.Equal(2500, savedItem.GetProperty("unitPrice").GetDecimal());

        // La venta también descuenta stock físico, igual que el uso interno.
        var reloadedInsumo = await TestDataFactory.GetInsumoIgnoringTenantAsync(_factory, insumo.Id);
        Assert.Equal(9, reloadedInsumo!.Stock);
    }

    [Fact]
    public async Task CustomerHistory_ExcludesInsumosMarkedAsSale()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var phone = $"sale-history-{Guid.NewGuid():N}".Substring(0, 15);
        var profile = await TestDataFactory.CreateCustomerProfileAsync(_factory, tenantId, phone, "Cliente Historial Venta");
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(21), DateTime.UtcNow.AddDays(21).AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Historial Venta", $"hist-{Guid.NewGuid():N}@test.com", phone: phone);
        var insumoUsado = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Algodon-{Guid.NewGuid():N}", stock: 10);
        var insumoVendido = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Esmalte-{Guid.NewGuid():N}", stock: 10);

        await admin.PutAsJsonAsync($"/api/bookings/{booking.Id}/detail", new
        {
            photoUrlsBefore = (string?)null,
            photoUrlsAfter = (string?)null,
            items = new object[]
            {
                new { itemType = "Insumo", insumoId = insumoUsado.Id, isSale = false, name = insumoUsado.Name, quantity = 1, unitPrice = 0 },
                new { itemType = "Insumo", insumoId = insumoVendido.Id, isSale = true, name = insumoVendido.Name, quantity = 1, unitPrice = 3000 }
            }
        });

        var historyResponse = await admin.GetAsync($"/api/reminders/customers/{profile.Id}/history");
        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);

        var history = await historyResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
        var bookingHistory = history!.Single(h => h.GetProperty("id").GetInt32() == booking.Id);
        var insumosUsados = bookingHistory.GetProperty("insumosUsados").EnumerateArray().ToList();

        var usadoNames = insumosUsados.Select(i => i.GetProperty("name").GetString()).ToList();
        Assert.Contains(insumoUsado.Name, usadoNames);
        Assert.DoesNotContain(insumoVendido.Name, usadoNames);
    }
}
