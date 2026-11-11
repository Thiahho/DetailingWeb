using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration.Catalog;

[Collection("Integration")]
public class CatalogAdminCrudTests
{
    private readonly CustomWebApplicationFactory _factory;

    public CatalogAdminCrudTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Attributes_CreateUpdateListAndDelete()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (attributeId, valueIds) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S", "M");

        var update = await client.PutAsJsonAsync($"/api/catalog/attributes/{attributeId}", new { name = "Talle ropa", sortOrder = 2 });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var valueUpdate = await client.PutAsJsonAsync($"/api/catalog/attribute-values/{valueIds[0]}", new { label = "XS", sortOrder = 0, colorHex = "#112233" });
        Assert.Equal(HttpStatusCode.OK, valueUpdate.StatusCode);

        var duplicateValue = await client.PostAsJsonAsync($"/api/catalog/attributes/{attributeId}/values", new { label = "M", sortOrder = 5 });
        Assert.Equal(HttpStatusCode.Conflict, duplicateValue.StatusCode);

        var badColor = await client.PostAsJsonAsync($"/api/catalog/attributes/{attributeId}/values", new { label = "L", sortOrder = 5, colorHex = "rojo" });
        Assert.Equal(HttpStatusCode.BadRequest, badColor.StatusCode);

        var list = await CatalogApi.ReadAsync(await client.GetAsync("/api/catalog/attributes"));
        var attribute = list.EnumerateArray().Single(a => a.GetProperty("id").GetInt32() == attributeId);
        Assert.Equal("Talle ropa", attribute.GetProperty("name").GetString());
        Assert.Equal("talle-ropa", attribute.GetProperty("slug").GetString());
        Assert.Equal(new[] { "XS", "M" }, attribute.GetProperty("values").EnumerateArray().Select(v => v.GetProperty("label").GetString()));
        Assert.Equal("#112233", attribute.GetProperty("values")[0].GetProperty("colorHex").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/attribute-values/{valueIds[1]}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/attributes/{attributeId}")).StatusCode);
        var after = await CatalogApi.ReadAsync(await client.GetAsync("/api/catalog/attributes"));
        Assert.DoesNotContain(after.EnumerateArray(), a => a.GetProperty("id").GetInt32() == attributeId);
    }

    [Fact]
    public async Task Categories_KeepAttributeOrder_AndRejectDeleteWhileInUse()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, _) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S");
        var (color, _) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo");

        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Remeras", color, talle);

        var category = await CatalogApi.ReadAsync(await client.GetAsync($"/api/catalog/categories/{categoryId}"));
        Assert.Equal("remeras", category.GetProperty("slug").GetString());
        Assert.Equal(new[] { color, talle }, category.GetProperty("attributeIds").EnumerateArray().Select(x => x.GetInt32()));

        var update = await client.PutAsJsonAsync($"/api/catalog/categories/{categoryId}",
            new { name = "Remeras lisas", description = "Algodón", sortOrder = 1, isActive = true, attributeIds = new[] { talle, color } });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await CatalogApi.ReadAsync(update);
        Assert.Equal(new[] { talle, color }, updated.GetProperty("attributeIds").EnumerateArray().Select(x => x.GetInt32()));
        Assert.Equal("remeras-lisas", updated.GetProperty("slug").GetString());

        // Attribute assigned to a category cannot be deleted.
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/catalog/attributes/{talle}")).StatusCode);

        await CatalogApi.CreateProductAsync(client, categoryId, "Remera", Array.Empty<int>());
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/catalog/categories/{categoryId}")).StatusCode);

        var unknownAttribute = await client.PostAsJsonAsync("/api/catalog/categories",
            new { name = "Otra", sortOrder = 0, isActive = true, attributeIds = new[] { int.MaxValue } });
        Assert.Equal(HttpStatusCode.BadRequest, unknownAttribute.StatusCode);
    }

    [Fact]
    public async Task Products_CreateWithPriceAndVariants_UpdateRegeneratesAndDelete()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S", "M", "L");
        var (color, colores) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo", "Azul");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Remeras", talle, color);

        var created = await CatalogApi.CreateProductAsync(client, categoryId, "Remera Básica",
            new[] { talles[0], talles[1], colores[0], colores[1] }, price: 1500.50m);

        var productId = created.GetProperty("id").GetInt32();
        Assert.Equal("remera-basica", created.GetProperty("slug").GetString());
        Assert.Equal(1500.50m, created.GetProperty("price").GetDecimal());
        Assert.Equal(4, created.GetProperty("variants").GetArrayLength());
        Assert.All(created.GetProperty("variants").EnumerateArray(), v => Assert.True(v.GetProperty("isActive").GetBoolean()));

        // Drop "M", add "L", remove price: M variants deactivated, L variants created.
        var update = await client.PutAsJsonAsync($"/api/catalog/products/{productId}", new
        {
            categoryId,
            name = "Remera Básica",
            price = (decimal?)null,
            sortOrder = 0,
            isActive = true,
            allowedValueIds = new[] { talles[0], talles[2], colores[0], colores[1] }
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await CatalogApi.ReadAsync(update);
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("price").ValueKind);
        var variants = updated.GetProperty("variants").EnumerateArray().ToList();
        Assert.Equal(6, variants.Count);
        Assert.Equal(4, variants.Count(v => v.GetProperty("isActive").GetBoolean()));
        Assert.All(variants.Where(v => v.GetProperty("valueIds").EnumerateArray().Any(x => x.GetInt32() == talles[1])),
            v => Assert.False(v.GetProperty("isActive").GetBoolean()));

        var list = await CatalogApi.ReadAsync(await client.GetAsync($"/api/catalog/products?categoryId={categoryId}"));
        var summary = list.EnumerateArray().Single();
        Assert.Equal(4, summary.GetProperty("activeVariants").GetInt32());

        // A value from an attribute that the category does not use is rejected.
        var (_, otherValues) = await CatalogApi.CreateAttributeAsync(client, "Material", "Lino");
        var invalid = await CatalogApi.PostProductAsync(client, categoryId, "Remera Lino", new[] { otherValues[0] });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/products/{productId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/catalog/products/{productId}")).StatusCode);
        // Values are free again once the product is gone.
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/attribute-values/{talles[1]}")).StatusCode);
    }

    [Fact]
    public async Task ValueInUse_CannotBeDeleted()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Pantalones", talle);
        await CatalogApi.CreateProductAsync(client, categoryId, "Jean", talles);

        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/catalog/attribute-values/{talles[0]}")).StatusCode);
    }

    [Fact]
    public async Task CategoryAttributeChange_RegeneratesVariantsOfItsProducts()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S", "M");
        var (color, colores) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo", "Azul");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Buzos", talle, color);
        var product = await CatalogApi.CreateProductAsync(client, categoryId, "Buzo",
            new[] { talles[0], talles[1], colores[0], colores[1] });
        Assert.Equal(4, product.GetProperty("variants").GetArrayLength());

        // Dropping Color: the Talle × Color variants become obsolete, Talle-only ones appear.
        var update = await client.PutAsJsonAsync($"/api/catalog/categories/{categoryId}",
            new { name = "Buzos", sortOrder = 0, isActive = true, attributeIds = new[] { talle } });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var detail = await CatalogApi.ReadAsync(await client.GetAsync($"/api/catalog/products/{product.GetProperty("id").GetInt32()}"));
        var variants = detail.GetProperty("variants").EnumerateArray().ToList();
        Assert.Equal(2, variants.Count(v => v.GetProperty("isActive").GetBoolean()));
        Assert.Equal(4, variants.Count(v => !v.GetProperty("isActive").GetBoolean()));
        Assert.All(variants.Where(v => v.GetProperty("isActive").GetBoolean()),
            v => Assert.Single(v.GetProperty("valueIds").EnumerateArray()));
    }

    [Fact]
    public async Task Variants_PatchSingleAndBulk()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S", "M");
        var (color, colores) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo", "Azul");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Camperas", talle, color);
        var product = await CatalogApi.CreateProductAsync(client, categoryId, "Campera",
            new[] { talles[0], talles[1], colores[0], colores[1] });
        var productId = product.GetProperty("id").GetInt32();
        var firstVariant = product.GetProperty("variants")[0].GetProperty("id").GetInt32();

        var patch = await client.PatchAsJsonAsync($"/api/catalog/variants/{firstVariant}", new { availability = 1, isActive = false });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        var patched = await CatalogApi.ReadAsync(patch);
        Assert.Equal(1, patched.GetProperty("availability").GetInt32());
        Assert.False(patched.GetProperty("isActive").GetBoolean());

        // Every active "Rojo" variant → on request.
        var bulk = await client.PatchAsJsonAsync("/api/catalog/variants/bulk", new { productId, valueIds = new[] { colores[0] }, availability = 1 });
        Assert.Equal(HttpStatusCode.OK, bulk.StatusCode);

        var detail = await CatalogApi.ReadAsync(await client.GetAsync($"/api/catalog/products/{productId}"));
        var onRequest = detail.GetProperty("variants").EnumerateArray()
            .Where(v => v.GetProperty("availability").GetInt32() == 1)
            .Select(v => v.GetProperty("id").GetInt32())
            .ToList();
        Assert.Contains(firstVariant, onRequest);
        Assert.All(detail.GetProperty("variants").EnumerateArray()
                .Where(v => v.GetProperty("isActive").GetBoolean() && v.GetProperty("valueIds").EnumerateArray().Any(x => x.GetInt32() == colores[0])),
            v => Assert.Equal(1, v.GetProperty("availability").GetInt32()));

        var invalid = await client.PatchAsJsonAsync($"/api/catalog/variants/{firstVariant}", new { availability = 9 });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }

    [Fact]
    public async Task Media_RegisterReorderAndDelete()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (color, colores) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Gorras", color);
        var productId = (await CatalogApi.CreateProductAsync(client, categoryId, "Gorra", colores)).GetProperty("id").GetInt32();

        async Task<int> AddMediaAsync(string url, int? attributeValueId = null)
        {
            var response = await client.PostAsJsonAsync($"/api/catalog/products/{productId}/media",
                new { url, publicId = "turneo/gorra", type = 0, attributeValueId });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await CatalogApi.ReadAsync(response)).GetProperty("id").GetInt32();
        }

        var first = await AddMediaAsync("https://res.cloudinary.com/demo/image/upload/a.jpg", colores[0]);
        var second = await AddMediaAsync("https://res.cloudinary.com/demo/image/upload/b.jpg");

        var badUrl = await client.PostAsJsonAsync($"/api/catalog/products/{productId}/media", new { url = "javascript:alert(1)", type = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, badUrl.StatusCode);

        var reorder = await client.PutAsJsonAsync($"/api/catalog/products/{productId}/media/order", new { mediaIds = new[] { second, first } });
        Assert.Equal(HttpStatusCode.OK, reorder.StatusCode);

        var detail = await CatalogApi.ReadAsync(await client.GetAsync($"/api/catalog/products/{productId}"));
        Assert.Equal(new[] { second, first }, detail.GetProperty("media").EnumerateArray().Select(m => m.GetProperty("id").GetInt32()));
        Assert.Equal(colores[0], detail.GetProperty("media")[1].GetProperty("attributeValueId").GetInt32());

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/media/{second}")).StatusCode);
        var afterDelete = await CatalogApi.ReadAsync(await client.GetAsync($"/api/catalog/products/{productId}"));
        Assert.Single(afterDelete.GetProperty("media").EnumerateArray());
    }
}
