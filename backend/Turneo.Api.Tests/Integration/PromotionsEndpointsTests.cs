using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Un profesional gestiona solo SUS promociones y solo sobre servicios que ofrece.
[Collection("Integration")]
public class PromotionsEndpointsTests
{
    private const string Url = "/api/professionals/me/promotions";

    private readonly CustomWebApplicationFactory _factory;

    public PromotionsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, Professional Professional, Service Service)> CreateProfessionalClientAsync(int tenantId)
    {
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, "Corte promo");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var p = await db.Professionals.IgnoreQueryFilters()
                .Include(x => x.Services)
                .SingleAsync(x => x.Id == professional.Id);
            var s = await db.Services.IgnoreQueryFilters().SingleAsync(x => x.Id == service.Id);
            p.Services.Add(s);
            await db.SaveChangesAsync();
        }

        var user = await TestDataFactory.CreateProfessionalUserAsync(
            _factory, tenantId, professional.Id, $"prof-promo-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, user.Id, user.Email, "Professional", tenantId, professional.Id));
        return (client, professional, service);
    }

    private static object Body(int serviceId, string type = "Percent", decimal value = 20, bool active = true,
        DateTime? start = null, DateTime? end = null) => new
    {
        name = "Promo verano",
        discountType = type,
        value,
        serviceIds = new[] { serviceId },
        startsAt = start ?? DateTime.UtcNow.AddDays(-1),
        endsAt = end ?? DateTime.UtcNow.AddDays(7),
        isActive = active
    };

    [Fact]
    public async Task Create_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _factory.CreateClient().GetAsync(Url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_ThenGet_ReturnsOwnPromotion()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var (client, _, service) = await CreateProfessionalClientAsync(tenantId);

        var create = await client.PostAsJsonAsync(Url, Body(service.Id));
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);

        var list = await client.GetFromJsonAsync<JsonElement>(Url);
        Assert.Equal(1, list.GetArrayLength());
        Assert.Equal("Percent", list[0].GetProperty("discountType").GetString());
        Assert.Equal(20m, list[0].GetProperty("value").GetDecimal());
    }

    [Fact]
    public async Task Create_WithServiceNotOffered_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var (client, _, _) = await CreateProfessionalClientAsync(tenantId);
        var foreign = await TestDataFactory.CreateServiceAsync(_factory, tenantId, "Servicio ajeno");

        var response = await client.PostAsJsonAsync(Url, Body(foreign.Id));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("Percent", 0)]
    [InlineData("Percent", 101)]
    [InlineData("FixedAmount", 0)]
    public async Task Create_WithInvalidValue_ReturnsBadRequest(string type, decimal value)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var (client, _, service) = await CreateProfessionalClientAsync(tenantId);

        var response = await client.PostAsJsonAsync(Url, Body(service.Id, type, value));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithEndBeforeStart_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var (client, _, service) = await CreateProfessionalClientAsync(tenantId);

        var response = await client.PostAsJsonAsync(Url,
            Body(service.Id, start: DateTime.UtcNow.AddDays(2), end: DateTime.UtcNow.AddDays(1)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateAndDelete_OtherProfessionalsPromotion_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var (owner, _, ownerService) = await CreateProfessionalClientAsync(tenantId);
        var (other, _, _) = await CreateProfessionalClientAsync(tenantId);

        var created = await (await owner.PostAsJsonAsync(Url, Body(ownerService.Id)))
            .Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var put = await other.PutAsJsonAsync($"{Url}/{id}", Body(ownerService.Id, value: 50));
        var delete = await other.DeleteAsync($"{Url}/{id}");

        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
        Assert.Equal(1, (await owner.GetFromJsonAsync<JsonElement>(Url)).GetArrayLength());
    }

    [Fact]
    public async Task Update_OwnPromotion_ChangesValueAndPausesIt()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var (client, _, service) = await CreateProfessionalClientAsync(tenantId);
        var created = await (await client.PostAsJsonAsync(Url, Body(service.Id)))
            .Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var put = await client.PutAsJsonAsync($"{Url}/{id}", Body(service.Id, value: 35, active: false));

        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var updated = await put.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(35m, updated.GetProperty("value").GetDecimal());
        Assert.False(updated.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Delete_OwnPromotion_ReturnsNoContentAndRemovesIt()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var (client, _, service) = await CreateProfessionalClientAsync(tenantId);
        var created = await (await client.PostAsJsonAsync(Url, Body(service.Id)))
            .Content.ReadFromJsonAsync<JsonElement>();

        var delete = await client.DeleteAsync($"{Url}/{created.GetProperty("id").GetInt32()}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(0, (await client.GetFromJsonAsync<JsonElement>(Url)).GetArrayLength());
    }
}
