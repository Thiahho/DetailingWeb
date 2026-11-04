using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration;

// Service.DurationMinutes: how long a booking of the service blocks the agenda
// (null = the booking lasts its start slot). Validated 5–1440 when present.
// PUT is a full replace, like locationType: omitting it clears it.
[Collection("Integration")]
public class ServiceDurationTests
{
    private const string RangeMessage = "La duración del turno debe estar entre 5 y 1440 minutos";
    private readonly CustomWebApplicationFactory _factory;

    public ServiceDurationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-dur-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static Dictionary<string, object?> ServicePayload(string slug, bool includeDuration, int? durationMinutes)
    {
        var payload = new Dictionary<string, object?>
        {
            ["title"] = "Tratamiento cerámico",
            ["slug"] = slug,
            ["price"] = "50000",
            ["duration"] = "3 hs",
            ["imageUrl"] = "",
            ["description"] = "desc",
            ["details"] = new List<string>(),
            ["isActive"] = true
        };
        if (includeDuration) payload["durationMinutes"] = durationMinutes;
        return payload;
    }

    private static int? ReadDuration(JsonElement service)
    {
        var value = service.GetProperty("durationMinutes");
        return value.ValueKind == JsonValueKind.Null ? null : value.GetInt32();
    }

    // Model validation answers with ProblemDetails: errors.{field}: [messages].
    private static async Task AssertRangeErrorAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var messages = body.GetProperty("errors").EnumerateObject()
            .SelectMany(e => e.Value.EnumerateArray().Select(m => m.GetString()));
        Assert.Contains(RangeMessage, messages);
    }

    private async Task<(HttpClient Admin, string Slug, int Id)> CreateAsync(int? durationMinutes)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var slug = $"dur-{Guid.NewGuid():N}";
        var create = await admin.PostAsJsonAsync("/api/services", ServicePayload(slug, true, durationMinutes));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(durationMinutes, ReadDuration(created));
        return (admin, slug, created.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Create_WithDuration_IsReturnedByEveryRead()
    {
        var (admin, slug, _) = await CreateAsync(180);

        var bySlug = await _factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/services/{slug}");
        Assert.Equal(180, ReadDuration(bySlug));

        var publicList = await _factory.CreateClient().GetFromJsonAsync<List<JsonElement>>("/api/services");
        Assert.Equal(180, ReadDuration(publicList!.Single(s => s.GetProperty("slug").GetString() == slug)));

        var adminList = await admin.GetFromJsonAsync<List<JsonElement>>("/api/services/all");
        Assert.Equal(180, ReadDuration(adminList!.Single(s => s.GetProperty("slug").GetString() == slug)));
    }

    [Fact]
    public async Task Create_WithNullDuration_IsAccepted()
    {
        var (_, slug, _) = await CreateAsync(null);

        var bySlug = await _factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/services/{slug}");
        Assert.Null(ReadDuration(bySlug));
    }

    [Fact]
    public async Task ExistingServiceRow_HasNoDuration()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var service = await TestDataFactory.CreateServiceAsync(_factory, tenantId, $"legacy-dur-{Guid.NewGuid():N}");

        var adminList = await admin.GetFromJsonAsync<List<JsonElement>>("/api/services/all");
        Assert.Null(ReadDuration(adminList!.Single(s => s.GetProperty("id").GetInt32() == service.Id)));
    }

    [Theory]
    [InlineData(4)]
    [InlineData(1441)]
    [InlineData(0)]
    public async Task Create_WithDurationOutOfRange_ReturnsBadRequest(int durationMinutes)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync("/api/services", ServicePayload($"dur-bad-{Guid.NewGuid():N}", true, durationMinutes));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertRangeErrorAsync(response);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(1440)]
    public async Task Create_WithDurationAtBounds_IsAccepted(int durationMinutes)
    {
        await CreateAsync(durationMinutes);
    }

    [Fact]
    public async Task Update_ChangesDuration()
    {
        var (admin, slug, id) = await CreateAsync(60);

        var update = await admin.PutAsJsonAsync($"/api/services/{id}", ServicePayload(slug, true, 240));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var bySlug = await _factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/services/{slug}");
        Assert.Equal(240, ReadDuration(bySlug));
    }

    [Fact]
    public async Task Update_WithNullDuration_ClearsIt()
    {
        var (admin, slug, id) = await CreateAsync(60);

        var update = await admin.PutAsJsonAsync($"/api/services/{id}", ServicePayload(slug, true, null));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var bySlug = await _factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/services/{slug}");
        Assert.Null(ReadDuration(bySlug));
    }

    // Full replace, same contract as locationType: the admin form always sends it.
    [Fact]
    public async Task Update_OmittingDuration_ClearsIt()
    {
        var (admin, slug, id) = await CreateAsync(60);

        var update = await admin.PutAsJsonAsync($"/api/services/{id}", ServicePayload(slug, false, null));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var bySlug = await _factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/services/{slug}");
        Assert.Null(ReadDuration(bySlug));
    }

    [Fact]
    public async Task Update_WithDurationOutOfRange_ReturnsBadRequestAndKeepsDuration()
    {
        var (admin, slug, id) = await CreateAsync(60);

        var update = await admin.PutAsJsonAsync($"/api/services/{id}", ServicePayload(slug, true, 1441));
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        await AssertRangeErrorAsync(update);

        var bySlug = await _factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/services/{slug}");
        Assert.Equal(60, ReadDuration(bySlug));
    }
}
