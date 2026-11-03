using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Admin endpoint that reads and saves only the home-service travel buffer.
// Unlike PUT api/businesssettings it never regenerates the time slots.
// Each test uses its own tenant so settings rows do not leak between tests.
[Collection("Integration")]
public class TravelBufferSettingEndpointsTests
{
    private const string BaseUrl = "/api/home-service/travel-buffer";
    private readonly CustomWebApplicationFactory _factory;

    public TravelBufferSettingEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<Tenant> CreateTenantAsync()
    {
        var slug = $"tb-{Guid.NewGuid():N}"[..20];
        return await TestDataFactory.CreateTenantAsync(_factory, slug, "Lavadero Traslado");
    }

    private async Task<HttpClient> ClientAsync(int tenantId, string role = "Admin")
    {
        var email = $"{role.ToLowerInvariant()}-tb-{Guid.NewGuid():N}@test.com";
        var user = role == "Admin"
            ? await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, email, "Password123")
            : await TestDataFactory.CreateStaffUserAsync(_factory, tenantId, email, "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, user.Id, user.Email, role, tenantId));
        return client;
    }

    private async Task<BusinessSettings> SeedSettingsAsync(int tenantId, int bufferMinutes)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var settings = new BusinessSettings
        {
            TenantId = tenantId,
            DaysOfWeek = new[] { 1, 3, 5 },
            StartTime = new TimeSpan(8, 30, 0),
            SlotDuration = 45,
            BreakBetweenSlots = 15,
            MaxDaysInAdvance = 7,
            HomeServiceTravelBufferMinutes = bufferMinutes,
            UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        db.BusinessSettings.Add(settings);
        await db.SaveChangesAsync();
        return settings;
    }

    private async Task<BusinessSettings?> SettingsRowAsync(int tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.BusinessSettings.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(s => s.TenantId == tenantId);
    }

    private async Task<List<(int Id, DateTime Start, DateTime End, bool IsAvailable)>> SlotsAsync(int tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rows = await db.TimeSlots.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Id)
            .Select(t => new { t.Id, t.StartDateTime, t.EndDateTime, t.IsAvailable })
            .ToListAsync();
        return rows.Select(r => (r.Id, r.StartDateTime, r.EndDateTime, r.IsAvailable)).ToList();
    }

    private static async Task<int> MinutesAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("minutes").GetInt32();
    }

    private static async Task<string?> MessageAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("message").GetString();
    }

    [Fact]
    public async Task Get_WithoutSettingsRow_ReturnsDefault()
    {
        var tenant = await CreateTenantAsync();
        var admin = await ClientAsync(tenant.Id);

        Assert.Equal(BusinessSettings.DefaultHomeServiceTravelBufferMinutes, await MinutesAsync(await admin.GetAsync(BaseUrl)));
    }

    [Fact]
    public async Task Get_WithSettingsRow_ReturnsStoredValue()
    {
        var tenant = await CreateTenantAsync();
        await SeedSettingsAsync(tenant.Id, 0);
        var admin = await ClientAsync(tenant.Id);

        Assert.Equal(0, await MinutesAsync(await admin.GetAsync(BaseUrl)));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(45)]
    [InlineData(240)]
    public async Task Put_UpdatesOnlyTheBufferAndLeavesSlotsUntouched(int minutes)
    {
        var tenant = await CreateTenantAsync();
        var before = await SeedSettingsAsync(tenant.Id, 30);
        var day = DateTime.Today.AddDays(5);
        await TestDataFactory.CreateTimeSlotAsync(_factory, tenant.Id, day.AddHours(10), day.AddHours(11));
        var taken = await TestDataFactory.CreateTimeSlotAsync(_factory, tenant.Id, day.AddHours(12), day.AddHours(13));
        await TestDataFactory.SetTimeSlotAvailabilityAsync(_factory, taken.Id, false);
        var slotsBefore = await SlotsAsync(tenant.Id);
        var admin = await ClientAsync(tenant.Id);

        var response = await admin.PutAsJsonAsync(BaseUrl, new { minutes });

        Assert.Equal(minutes, await MinutesAsync(response));
        Assert.Equal(minutes, await MinutesAsync(await admin.GetAsync(BaseUrl)));

        var after = (await SettingsRowAsync(tenant.Id))!;
        Assert.Equal(before.Id, after.Id);
        Assert.Equal(minutes, after.HomeServiceTravelBufferMinutes);
        Assert.Equal(before.DaysOfWeek, after.DaysOfWeek);
        Assert.Equal(before.StartTime, after.StartTime);
        Assert.Equal(before.SlotDuration, after.SlotDuration);
        Assert.Equal(before.BreakBetweenSlots, after.BreakBetweenSlots);
        Assert.Equal(before.MaxDaysInAdvance, after.MaxDaysInAdvance);

        // No slot regeneration: same rows, same times, same availability.
        Assert.Equal(slotsBefore, await SlotsAsync(tenant.Id));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(241)]
    public async Task Put_OutOfRange_ReturnsBadRequestAndKeepsValue(int minutes)
    {
        var tenant = await CreateTenantAsync();
        await SeedSettingsAsync(tenant.Id, 30);
        var admin = await ClientAsync(tenant.Id);

        var response = await admin.PutAsJsonAsync(BaseUrl, new { minutes });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("El tiempo de traslado entre turnos a domicilio debe estar entre 0 y 240 minutos", await MessageAsync(response));
        Assert.Equal(30, (await SettingsRowAsync(tenant.Id))!.HomeServiceTravelBufferMinutes);
    }

    [Fact]
    public async Task Put_WithoutMinutes_ReturnsBadRequest()
    {
        var tenant = await CreateTenantAsync();
        await SeedSettingsAsync(tenant.Id, 30);
        var admin = await ClientAsync(tenant.Id);

        var response = await admin.PutAsJsonAsync(BaseUrl, new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(30, (await SettingsRowAsync(tenant.Id))!.HomeServiceTravelBufferMinutes);
    }

    [Fact]
    public async Task Put_WithoutSettingsRow_ReturnsConflictAndCreatesNothing()
    {
        var tenant = await CreateTenantAsync();
        var admin = await ClientAsync(tenant.Id);

        var response = await admin.PutAsJsonAsync(BaseUrl, new { minutes = 60 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("Configurá primero los horarios de la agenda para poder guardar el tiempo de traslado", await MessageAsync(response));
        Assert.Null(await SettingsRowAsync(tenant.Id));
    }

    [Fact]
    public async Task Staff_IsForbidden()
    {
        var tenant = await CreateTenantAsync();
        await SeedSettingsAsync(tenant.Id, 30);
        var staff = await ClientAsync(tenant.Id, "Staff");

        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(BaseUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PutAsJsonAsync(BaseUrl, new { minutes = 60 })).StatusCode);
        Assert.Equal(30, (await SettingsRowAsync(tenant.Id))!.HomeServiceTravelBufferMinutes);
    }

    [Fact]
    public async Task Anonymous_IsUnauthorized()
    {
        var client = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(BaseUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync(BaseUrl, new { minutes = 60 })).StatusCode);
    }

    [Fact]
    public async Task Put_OnlyChangesTheCallersTenant()
    {
        var tenantA = await CreateTenantAsync();
        var tenantB = await CreateTenantAsync();
        await SeedSettingsAsync(tenantA.Id, 30);
        await SeedSettingsAsync(tenantB.Id, 15);
        var adminA = await ClientAsync(tenantA.Id);
        var adminB = await ClientAsync(tenantB.Id);

        Assert.Equal(90, await MinutesAsync(await adminA.PutAsJsonAsync(BaseUrl, new { minutes = 90 })));

        Assert.Equal(15, (await SettingsRowAsync(tenantB.Id))!.HomeServiceTravelBufferMinutes);
        Assert.Equal(15, await MinutesAsync(await adminB.GetAsync(BaseUrl)));
        Assert.Equal(90, await MinutesAsync(await adminA.GetAsync(BaseUrl)));
    }
}
