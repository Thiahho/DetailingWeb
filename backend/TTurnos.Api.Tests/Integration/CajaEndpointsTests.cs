using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

// Cubre la lógica de dinero de mayor riesgo del módulo Caja: no permitir dos
// sesiones abiertas a la vez, no permitir movimientos sin sesión abierta, y el
// cálculo de efectivo esperado / diferencia al cerrar (ver docs/auditoriabelleza_0507.md,
// sección "Módulo Caja"). Cada test abre su propia caja porque solo puede
// haber UNA sesión abierta por tenant a la vez.
[Collection("Integration")]
public class CajaEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public CajaEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient client, int tenantId)> CreateAdminClientAsync()
    {
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, $"caja-{Guid.NewGuid():N}", "Negocio Caja");
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenant.Id, $"admin-caja-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenant.Id));
        return (client, tenant.Id);
    }

    [Fact]
    public async Task Open_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 1000 });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Current_WithoutOpenSession_ReturnsOpenFalse()
    {
        var (client, _) = await CreateAdminClientAsync();

        var response = await client.GetAsync("/api/caja/current");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("open").GetBoolean());
    }

    [Fact]
    public async Task Open_Twice_ReturnsBadRequestOnSecondAttempt()
    {
        var (client, _) = await CreateAdminClientAsync();

        var first = await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 1000 });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 500 });
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }

    [Fact]
    public async Task CreateMovement_WithoutOpenSession_ReturnsBadRequest()
    {
        var (client, _) = await CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync("/api/caja/movements", new
        {
            type = "Charge",
            method = "Cash",
            amount = 5000
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateMovement_InvalidType_ReturnsBadRequest()
    {
        var (client, _) = await CreateAdminClientAsync();
        await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 0 });

        var response = await client.PostAsJsonAsync("/api/caja/movements", new
        {
            type = "NotAValidType",
            method = "Cash",
            amount = 5000
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Charge_Cash_IncreasesExpectedCash()
    {
        var (client, _) = await CreateAdminClientAsync();
        await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 1000 });

        var movementResponse = await client.PostAsJsonAsync("/api/caja/movements", new
        {
            type = "Charge",
            method = "Cash",
            amount = 5000
        });
        Assert.Equal(HttpStatusCode.OK, movementResponse.StatusCode);

        var current = await (await client.GetAsync("/api/caja/current")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(6000m, current.GetProperty("expectedCash").GetDecimal());
    }

    [Fact]
    public async Task Refund_Cash_DecreasesExpectedCash()
    {
        var (client, _) = await CreateAdminClientAsync();
        await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 1000 });
        await client.PostAsJsonAsync("/api/caja/movements", new { type = "Charge", method = "Cash", amount = 5000 });

        var refundResponse = await client.PostAsJsonAsync("/api/caja/movements", new
        {
            type = "Refund",
            method = "Cash",
            amount = 2000
        });
        Assert.Equal(HttpStatusCode.OK, refundResponse.StatusCode);

        var current = await (await client.GetAsync("/api/caja/current")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(4000m, current.GetProperty("expectedCash").GetDecimal());
    }

    [Fact]
    public async Task Transfer_DoesNotAffectExpectedCash()
    {
        var (client, _) = await CreateAdminClientAsync();
        await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 1000 });

        await client.PostAsJsonAsync("/api/caja/movements", new { type = "Charge", method = "Transfer", amount = 9000 });

        var current = await (await client.GetAsync("/api/caja/current")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1000m, current.GetProperty("expectedCash").GetDecimal());
        Assert.Equal(9000m, current.GetProperty("totals").GetProperty("transferTotal").GetDecimal());
    }

    [Fact]
    public async Task Close_ComputesDifferenceBetweenDeclaredAndExpectedCash()
    {
        var (client, _) = await CreateAdminClientAsync();
        await client.PostAsJsonAsync("/api/caja/open", new { openingCashBalance = 1000 });
        await client.PostAsJsonAsync("/api/caja/movements", new { type = "Charge", method = "Cash", amount = 5000 });
        // expectedCash = 1000 + 5000 = 6000

        var closeResponse = await client.PostAsJsonAsync("/api/caja/close", new { closingCashCounted = 5800, notes = "Faltaron $200" });

        Assert.Equal(HttpStatusCode.OK, closeResponse.StatusCode);
        var body = await closeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(6000m, body.GetProperty("expectedCash").GetDecimal());
        Assert.Equal(-200m, body.GetProperty("difference").GetDecimal());

        // Cerrada, ya no debería contar como sesión abierta
        var current = await (await client.GetAsync("/api/caja/current")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(current.GetProperty("open").GetBoolean());
    }

    [Fact]
    public async Task Close_WithoutOpenSession_ReturnsBadRequest()
    {
        var (client, _) = await CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync("/api/caja/close", new { closingCashCounted = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
