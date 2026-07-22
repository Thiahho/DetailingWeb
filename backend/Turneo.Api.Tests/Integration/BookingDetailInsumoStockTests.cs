using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

// Cubre la reconciliación de stock de insumos en PUT /api/bookings/{id}/detail:
// el endpoint reemplaza toda la lista de items en cada guardado, así que el
// descuento de stock se calcula por delta (cantidad nueva - cantidad vieja)
// para que agregar/editar/quitar el mismo insumo repetidas veces sobre el
// mismo turno sea idempotente (ver BookingsController.UpdateBookingDetail).
[Collection("Integration")]
public class BookingDetailInsumoStockTests
{
    private readonly CustomWebApplicationFactory _factory;

    public BookingDetailInsumoStockTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-detail-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static object DetailPayload(params object[] items) => new
    {
        photoUrlsBefore = (string?)null,
        photoUrlsAfter = (string?)null,
        items
    };

    private static object InsumoItem(int insumoId, string name, int quantity) => new
    {
        itemType = "Insumo",
        insumoId,
        name,
        quantity,
        unitPrice = 999 // debe ser ignorado/forzado a 0 por el servidor: el insumo es costo interno
    };

    [Fact]
    public async Task SaveDetail_WithInsumoItem_DiscountsStockAndZeroesPrice()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Insumo", $"insumo-{Guid.NewGuid():N}@test.com");
        var insumo = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Esmalte-{Guid.NewGuid():N}", stock: 10);

        var response = await admin.PutAsJsonAsync($"/api/bookings/{booking.Id}/detail",
            DetailPayload(InsumoItem(insumo.Id, insumo.Name, 2)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reloadedInsumo = await TestDataFactory.GetInsumoIgnoringTenantAsync(_factory, insumo.Id);
        Assert.Equal(8, reloadedInsumo!.Stock);

        // El insumo es costo interno: el server debe forzar unitPrice a 0 aunque el payload mande otro valor.
        var listResponse = await admin.GetAsync("/api/bookings");
        var bookings = await listResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
        var savedBooking = bookings!.Single(b => b.GetProperty("id").GetInt32() == booking.Id);
        var savedItem = savedBooking.GetProperty("items").EnumerateArray().Single();
        Assert.Equal(BookingItemType.Insumo, savedItem.GetProperty("itemType").GetString());
        Assert.Equal(insumo.Id, savedItem.GetProperty("insumoId").GetInt32());
        Assert.Equal(0, savedItem.GetProperty("unitPrice").GetDecimal());
    }

    [Fact]
    public async Task SaveDetail_TwiceWithDifferentQuantity_ReconcilesByDeltaWithoutDoubleDiscount()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slot = await TestDataFactory.CreateTimeSlotAsync(_factory, tenantId, DateTime.UtcNow.AddDays(11), DateTime.UtcNow.AddDays(11).AddHours(1));
        var booking = await TestDataFactory.CreateBookingAsync(_factory, tenantId, slot.Id, "Cliente Insumo 2", $"insumo2-{Guid.NewGuid():N}@test.com");
        var insumo = await TestDataFactory.CreateInsumoAsync(_factory, tenantId, $"Algodon-{Guid.NewGuid():N}", stock: 10);

        // Primer guardado: consume 2 (10 -> 8)
        await admin.PutAsJsonAsync($"/api/bookings/{booking.Id}/detail",
            DetailPayload(InsumoItem(insumo.Id, insumo.Name, 2)));

        // Segundo guardado del mismo turno: sube la cantidad a 5 (8 -> 5, delta de +3 sobre lo ya descontado)
        var response = await admin.PutAsJsonAsync($"/api/bookings/{booking.Id}/detail",
            DetailPayload(InsumoItem(insumo.Id, insumo.Name, 5)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var afterIncrease = await TestDataFactory.GetInsumoIgnoringTenantAsync(_factory, insumo.Id);
        Assert.Equal(5, afterIncrease!.Stock);

        // Tercer guardado: quita el insumo del detalle -> el stock vuelve al original (5 -> 10)
        var removeResponse = await admin.PutAsJsonAsync($"/api/bookings/{booking.Id}/detail", DetailPayload());

        Assert.Equal(HttpStatusCode.OK, removeResponse.StatusCode);
        var afterRemoval = await TestDataFactory.GetInsumoIgnoringTenantAsync(_factory, insumo.Id);
        Assert.Equal(10, afterRemoval!.Stock);
    }
}
