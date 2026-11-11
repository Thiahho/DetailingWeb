using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration.Catalog;

// A variant turned off by hand (single or bulk patch) stays off across product
// saves, category saves and explicit regeneration until an admin turns it on
// again. Variants turned off by the generator still come back on their own.
[Collection("Integration")]
public class CatalogManualDeactivationTests
{
    private readonly CustomWebApplicationFactory _factory;

    public CatalogManualDeactivationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PatchedOff_StaysOffAcrossProductSaveAndRegenerate()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S", "M");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Remeras", talle);
        var product = await CatalogApi.CreateProductAsync(client, categoryId, "Remera", talles);
        var productId = product.GetProperty("id").GetInt32();
        var variantId = VariantWith(product, talles[0]).GetProperty("id").GetInt32();
        Assert.False(VariantWith(product, talles[0]).GetProperty("disabledManually").GetBoolean());

        var patch = await client.PatchAsJsonAsync($"/api/catalog/variants/{variantId}", new { isActive = false });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        Assert.True((await CatalogApi.ReadAsync(patch)).GetProperty("disabledManually").GetBoolean());

        var saved = await CatalogApi.ReadAsync(await UpdateProductAsync(client, productId, categoryId, talles));
        AssertInactive(VariantWith(saved, talles[0]), manually: true);
        Assert.True(VariantWith(saved, talles[1]).GetProperty("isActive").GetBoolean());

        var regenerate = await client.PostAsync($"/api/catalog/products/{productId}/variants/generate", null);
        Assert.Equal(HttpStatusCode.OK, regenerate.StatusCode);
        AssertInactive(VariantWith(await CatalogApi.ReadAsync(regenerate), talles[0]), manually: true);
    }

    [Fact]
    public async Task BulkOff_StaysOffWhenTheCombinationBecomesObsoleteAndValidAgain()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S");
        var (color, colores) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo", "Azul");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Buzos", talle, color);
        var product = await CatalogApi.CreateProductAsync(client, categoryId, "Buzo", new[] { talles[0], colores[0], colores[1] });
        var productId = product.GetProperty("id").GetInt32();

        // Every "Rojo" variant off by hand.
        var bulk = await client.PatchAsJsonAsync("/api/catalog/variants/bulk", new { productId, valueIds = new[] { colores[0] }, isActive = false });
        Assert.Equal(HttpStatusCode.OK, bulk.StatusCode);
        Assert.Equal(1, (await CatalogApi.ReadAsync(bulk)).GetProperty("updated").GetInt32());

        // Dropping Color makes both combinations obsolete (the generator turns "Azul" off) ...
        Assert.Equal(HttpStatusCode.OK, (await UpdateCategoryAsync(client, categoryId, talle)).StatusCode);
        // ... and adding it back makes them valid again: "Azul" comes back, "Rojo" stays off.
        Assert.Equal(HttpStatusCode.OK, (await UpdateCategoryAsync(client, categoryId, talle, color)).StatusCode);

        var detail = await CatalogApi.ReadAsync(await client.GetAsync($"/api/catalog/products/{productId}"));
        AssertInactive(VariantWith(detail, colores[0]), manually: true);
        var azul = VariantWith(detail, colores[1]);
        Assert.True(azul.GetProperty("isActive").GetBoolean());
        Assert.False(azul.GetProperty("disabledManually").GetBoolean());
    }

    [Fact]
    public async Task PatchedOnAgain_IsActiveAndStaysOnAcrossSaves()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S", "M");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Camisas", talle);
        var product = await CatalogApi.CreateProductAsync(client, categoryId, "Camisa", talles);
        var productId = product.GetProperty("id").GetInt32();
        var variantId = VariantWith(product, talles[0]).GetProperty("id").GetInt32();

        await client.PatchAsJsonAsync($"/api/catalog/variants/{variantId}", new { isActive = false });
        var on = await CatalogApi.ReadAsync(await client.PatchAsJsonAsync($"/api/catalog/variants/{variantId}", new { isActive = true }));
        Assert.True(on.GetProperty("isActive").GetBoolean());
        Assert.False(on.GetProperty("disabledManually").GetBoolean());

        // Bulk can turn hand-disabled variants back on as well.
        await client.PatchAsJsonAsync($"/api/catalog/variants/{variantId}", new { isActive = false });
        var bulkOn = await client.PatchAsJsonAsync("/api/catalog/variants/bulk", new { productId, valueIds = new[] { talles[0] }, isActive = true });
        Assert.Equal(HttpStatusCode.OK, bulkOn.StatusCode);

        // Removing the value deactivates it as obsolete; allowing it again brings it back automatically.
        await UpdateProductAsync(client, productId, categoryId, new[] { talles[1] });
        var saved = await CatalogApi.ReadAsync(await UpdateProductAsync(client, productId, categoryId, talles));
        var variant = VariantWith(saved, talles[0]);
        Assert.True(variant.GetProperty("isActive").GetBoolean());
        Assert.False(variant.GetProperty("disabledManually").GetBoolean());
    }

    [Fact]
    public async Task Bulk_WithoutAvailabilityOrState_IsRejected()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Gorras", talle);
        var product = await CatalogApi.CreateProductAsync(client, categoryId, "Gorra", talles);

        var bulk = await client.PatchAsJsonAsync("/api/catalog/variants/bulk",
            new { productId = product.GetProperty("id").GetInt32(), valueIds = Array.Empty<int>() });

        Assert.Equal(HttpStatusCode.BadRequest, bulk.StatusCode);
    }

    // The single variant containing the value (each test only looks up values
    // that belong to exactly one combination).
    private static JsonElement VariantWith(JsonElement product, int valueId) =>
        product.GetProperty("variants").EnumerateArray()
            .Single(v => v.GetProperty("valueIds").EnumerateArray().Any(x => x.GetInt32() == valueId));

    private static void AssertInactive(JsonElement variant, bool manually)
    {
        Assert.False(variant.GetProperty("isActive").GetBoolean());
        Assert.Equal(manually, variant.GetProperty("disabledManually").GetBoolean());
    }

    private static Task<HttpResponseMessage> UpdateProductAsync(HttpClient client, int productId, int categoryId, int[] allowedValueIds) =>
        client.PutAsJsonAsync($"/api/catalog/products/{productId}", new
        {
            categoryId,
            name = "Producto",
            price = (decimal?)null,
            sortOrder = 0,
            isActive = true,
            allowedValueIds
        });

    private static Task<HttpResponseMessage> UpdateCategoryAsync(HttpClient client, int categoryId, params int[] attributeIds) =>
        client.PutAsJsonAsync($"/api/catalog/categories/{categoryId}",
            new { name = "Categoría", sortOrder = 0, isActive = true, attributeIds });
}
