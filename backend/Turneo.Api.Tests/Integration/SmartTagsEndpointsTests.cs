using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QRCoder;

namespace Turneo.Api.Tests.Integration;

[Collection("Integration")]
public class SmartTagsEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public SmartTagsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> CreateAdminClientAsync(int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-st-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    private static object CreatePayload(string name = "Recepción", string? location = "Entrada", string action = "BOOKING") =>
        new { name, location, action };

    [Fact]
    public async Task Create_ReturnsCreated_WithValidToken()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync("/api/smart-tags", CreatePayload());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var token = body.GetProperty("token").GetString();
        Assert.NotNull(token);
        // Alfabeto Crockford Base32 sin 0/O/1/I/L, 12 caracteres (ver SmartTagTokenGenerator).
        Assert.Matches(new Regex("^[2-9A-HJ-KM-NP-Z]{12}$"), token!);
        Assert.Contains($"/s/{token}", body.GetProperty("smartLinkUrl").GetString());
    }

    [Fact]
    public async Task Create_ReturnsChannelUrls_ForNfcAndQr()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync("/api/smart-tags", CreatePayload());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var smartLinkUrl = body.GetProperty("smartLinkUrl").GetString();
        Assert.Equal($"{smartLinkUrl}?src=nfc", body.GetProperty("nfcUrl").GetString());
        Assert.Equal($"{smartLinkUrl}?src=qr", body.GetProperty("qrUrl").GetString());
    }

    [Fact]
    public async Task Create_WithInvalidAction_ReturnsBadRequest()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.PostAsJsonAsync("/api/smart-tags", CreatePayload(action: "TELEPORT"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithoutAdminToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/smart-tags", CreatePayload());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Update_DoesNotChangeTokenOrActiveState()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Original");

        var response = await admin.PutAsJsonAsync($"/api/smart-tags/{tag.Id}",
            new { name = "Editado", location = "Mostrador", action = "REVIEW" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("Editado", body.GetProperty("name").GetString());
        Assert.Equal("REVIEW", body.GetProperty("action").GetString());
        Assert.Equal(tag.Token, body.GetProperty("token").GetString());
        Assert.True(body.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task SetStatus_Deactivates_AndReactivates()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Activable");

        var deactivate = await admin.PatchAsJsonAsync($"/api/smart-tags/{tag.Id}/status", new { isActive = false });
        Assert.Equal(HttpStatusCode.OK, deactivate.StatusCode);
        var deactivated = await deactivate.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.False(deactivated.GetProperty("isActive").GetBoolean());

        var reactivate = await admin.PatchAsJsonAsync($"/api/smart-tags/{tag.Id}/status", new { isActive = true });
        Assert.Equal(HttpStatusCode.OK, reactivate.StatusCode);
        var reactivated = await reactivate.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(reactivated.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Delete_RemovesTag_AndCascadesEvents()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Borrable");

        // Genera un evento real vía el Smart Link público antes de borrar, para
        // probar la cascada SmartTagEvent -> SmartTag.
        var publicClient = _factory.CreateClient();
        var linkResponse = await publicClient.GetAsync($"/api/smart/{tag.Token}");
        Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);

        var deleteResponse = await admin.DeleteAsync($"/api/smart-tags/{tag.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await admin.GetAsync($"/api/smart-tags/{tag.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task GetQrCode_ReturnsValidPng()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Con QR");

        var response = await admin.GetAsync($"/api/smart-tags/{tag.Id}/qr");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        // Firma estándar de PNG.
        Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, bytes.Take(8));
    }

    // Sin decodificador de QR en el proyecto de tests: se regenera el PNG con
    // los mismos parámetros del controller (generación determinística) y se
    // comparan los bytes — solo coinciden si la URL codificada es la esperada.
    [Fact]
    public async Task GetQrCode_EncodesSmartLinkUrlWithQrSource()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "QR con canal");

        var response = await admin.GetAsync($"/api/smart-tags/{tag.Id}/qr");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        var configuration = _factory.Services.GetRequiredService<IConfiguration>();
        var baseUrl = configuration["SmartTags:PublicBaseUrl"] ?? "https://www.turneobelleza.com";

        Assert.Equal(RenderQr($"{baseUrl}/s/{tag.Token}?src=qr"), bytes);
        Assert.NotEqual(RenderQr($"{baseUrl}/s/{tag.Token}"), bytes);
    }

    private static byte[] RenderQr(string url)
    {
        using var generator = new QRCodeGenerator();
        using var qrData = generator.CreateQrCode(url, QRCodeGenerator.ECCLevel.Q);
        return new PngByteQRCode(qrData).GetGraphic(20);
    }

    [Fact]
    public async Task GetTagAnalytics_CountsInteractionsAndCompletions()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Con Analytics");

        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction);
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction);
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction);
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.BookingCompleted);

        var response = await admin.GetAsync($"/api/smart-tags/{tag.Id}/analytics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(3, body.GetProperty("interactions").GetInt32());
        Assert.Equal(1, body.GetProperty("completions").GetInt32());
        Assert.Equal(33.3, body.GetProperty("conversionRate").GetDouble());
    }

    [Fact]
    public async Task GetTagAnalytics_BreaksDownInteractionsAndCompletionsBySource()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Con canales");

        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction, "nfc");
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction, "nfc");
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction, "qr");
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction);
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.BookingCompleted, "qr");
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.BookingCompleted);

        var response = await admin.GetAsync($"/api/smart-tags/{tag.Id}/analytics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        // Los totales existentes no cambian.
        Assert.Equal(4, body.GetProperty("interactions").GetInt32());
        Assert.Equal(2, body.GetProperty("completions").GetInt32());

        var interactions = body.GetProperty("interactionsBySource");
        Assert.Equal(2, interactions.GetProperty("nfc").GetInt32());
        Assert.Equal(1, interactions.GetProperty("qr").GetInt32());
        Assert.Equal(1, interactions.GetProperty("unknown").GetInt32());

        var completions = body.GetProperty("completionsBySource");
        Assert.Equal(0, completions.GetProperty("nfc").GetInt32());
        Assert.Equal(1, completions.GetProperty("qr").GetInt32());
        Assert.Equal(1, completions.GetProperty("unknown").GetInt32());
    }

    [Fact]
    public async Task GetTagAnalytics_ForNonexistentTag_ReturnsNotFound()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);

        var response = await admin.GetAsync("/api/smart-tags/999999/analytics");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetAnalyticsSummary_IncludesAllTagsOfTenant_WithTotals()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tagA = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Tag Sumario A");
        var tagB = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Tag Sumario B");

        await TestDataFactory.RecordSmartTagEventAsync(_factory, tagA.Id, tenantId, tagA.Action, SmartTagEventType.Interaction);
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tagB.Id, tenantId, tagB.Action, SmartTagEventType.Interaction);
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tagB.Id, tenantId, tagB.Action, SmartTagEventType.BookingCompleted);

        var response = await admin.GetAsync("/api/smart-tags/analytics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var tags = body.GetProperty("tags").EnumerateArray()
            .Select(t => t.GetProperty("smartTagId").GetInt32())
            .ToList();
        Assert.Contains(tagA.Id, tags);
        Assert.Contains(tagB.Id, tags);
        Assert.True(body.GetProperty("totalInteractions").GetInt32() >= 2);
        Assert.True(body.GetProperty("totalCompletions").GetInt32() >= 1);
    }

    [Fact]
    public async Task GetAnalyticsSummary_ExposesSourceBreakdown_PerTagAndInTotals()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await CreateAdminClientAsync(tenantId);
        var tag = await TestDataFactory.CreateSmartTagAsync(_factory, tenantId, "Tag Sumario Canales");

        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction, "nfc");
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.Interaction, "qr");
        await TestDataFactory.RecordSmartTagEventAsync(_factory, tag.Id, tenantId, tag.Action, SmartTagEventType.BookingCompleted, "nfc");

        var response = await admin.GetAsync("/api/smart-tags/analytics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var row = body.GetProperty("tags").EnumerateArray()
            .Single(t => t.GetProperty("smartTagId").GetInt32() == tag.Id);
        Assert.Equal(1, row.GetProperty("interactionsBySource").GetProperty("nfc").GetInt32());
        Assert.Equal(1, row.GetProperty("interactionsBySource").GetProperty("qr").GetInt32());
        Assert.Equal(0, row.GetProperty("interactionsBySource").GetProperty("unknown").GetInt32());
        Assert.Equal(1, row.GetProperty("completionsBySource").GetProperty("nfc").GetInt32());

        // El tenant legacy se comparte con el resto de la suite: los totales
        // solo pueden afirmarse como cota inferior y como suma consistente.
        var totals = body.GetProperty("totalInteractionsBySource");
        Assert.True(totals.GetProperty("nfc").GetInt32() >= 1);
        Assert.True(totals.GetProperty("qr").GetInt32() >= 1);
        Assert.Equal(
            body.GetProperty("totalInteractions").GetInt32(),
            totals.GetProperty("nfc").GetInt32() + totals.GetProperty("qr").GetInt32() + totals.GetProperty("unknown").GetInt32());
        Assert.True(body.GetProperty("totalCompletionsBySource").GetProperty("nfc").GetInt32() >= 1);
    }
}
