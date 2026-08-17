using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

[Collection("Integration")]
public class SmartLinkEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public SmartLinkEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ResolveSmartLink_WithValidToken_ReturnsOk_AndRecordsInteractionEvent()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Recepción", action: "BOOKING");

        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/smart/{tag.Token}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("BOOKING", body.GetProperty("action").GetString());
        Assert.Equal(tag.Id, body.GetProperty("smartTagId").GetInt32());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var events = await db.SmartTagEvents.IgnoreQueryFilters()
            .Where(e => e.SmartTagId == tag.Id).ToListAsync();

        Assert.Single(events);
        Assert.Equal(SmartTagEventType.Interaction, events[0].EventType);
        Assert.Equal(tenantId, events[0].TenantId);
    }

    [Fact]
    public async Task ResolveSmartLink_WithNonexistentToken_ReturnsNotFound()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/smart/NOEXISTE1234");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ResolveSmartLink_WithInactiveTag_ReturnsNotFound_AndRecordsNoEvent()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Inactiva", isActive: false);

        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/smart/{tag.Token}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var eventCount = await db.SmartTagEvents.IgnoreQueryFilters()
            .CountAsync(e => e.SmartTagId == tag.Id);

        Assert.Equal(0, eventCount);
    }

    [Fact]
    public async Task SubmitReview_WithHighRating_ReturnsConfiguredRedirectUrl_AndRecordsCompletedEvent()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Espejo", action: "REVIEW");
        await TestDataFactory.SetGoogleReviewUrlAsync(_factory, tenantId, "https://g.page/r/test/review");

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync($"/api/smart/{tag.Token}/review", new { rating = 5 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("https://g.page/r/test/review", body.GetProperty("redirectUrl").GetString());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var recorded = await db.SmartTagEvents.IgnoreQueryFilters()
            .Where(e => e.SmartTagId == tag.Id).ToListAsync();
        Assert.Single(recorded);
        Assert.Equal(SmartTagEventType.ReviewCompleted, recorded[0].EventType);
    }

    [Fact]
    public async Task SubmitReview_WithLowRating_ReturnsNullRedirectUrl()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Espejo", action: "REVIEW");
        await TestDataFactory.SetGoogleReviewUrlAsync(_factory, tenantId, "https://g.page/r/test/review");

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync($"/api/smart/{tag.Token}/review", new { rating = 2 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(System.Text.Json.JsonValueKind.Null, body.GetProperty("redirectUrl").ValueKind);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public async Task SubmitReview_WithRatingOutOfRange_ReturnsBadRequest(int rating)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Espejo", action: "REVIEW");

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync($"/api/smart/{tag.Token}/review", new { rating });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitReview_WithNonexistentToken_ReturnsNotFound()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/smart/NOEXISTE1234/review", new { rating = 5 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
