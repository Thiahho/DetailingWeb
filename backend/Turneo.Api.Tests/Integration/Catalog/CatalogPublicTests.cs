using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration.Catalog;

// Anonymous public catalog, resolved to the tenant by its host (X-Tenant-Host),
// exactly like the public booking endpoints.
[Collection("Integration")]
public class CatalogPublicTests : IDisposable
{
    private readonly CustomWebApplicationFactory _factory;
    // The public endpoints share the "public-read" limiter (60/min per IP) with
    // every other public read of the suite. Anonymous calls go through a host of
    // their own with a high limit, so this class never starves the others.
    private readonly WebApplicationFactory<Program> _publicHost;

    public CatalogPublicTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _publicHost = factory.WithConfigOverrides(new Dictionary<string, string?>
        {
            ["RateLimiting:PublicReadPermitLimit"] = "10000"
        });
    }

    public void Dispose() => _publicHost.Dispose();

    private sealed record Shop(HttpClient Admin, string Host);

    private async Task<Shop> NewShopAsync()
    {
        var slug = $"pub{Guid.NewGuid():N}"[..20];
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, slug, "Tienda Pública");
        var baseDomain = _factory.Services.GetRequiredService<IConfiguration>()["Tenancy:BaseDomain"]!;
        return new Shop(await CatalogApi.AdminClientAsync(_factory, tenant.Id), $"{slug}.{baseDomain}");
    }

    // Anonymous request (no Authorization header) for the shop's host.
    private Task<HttpResponseMessage> GetPublicAsync(string host, string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("X-Tenant-Host", host);
        return _publicHost.CreateClient().SendAsync(request);
    }

    private async Task<JsonElement> GetPublicOkAsync(string host, string url)
    {
        var response = await GetPublicAsync(host, url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await CatalogApi.ReadAsync(response);
    }

    private static async Task PutProductAsync(HttpClient admin, int productId, int categoryId, string name, int[] allowedValueIds, bool isActive, decimal? price = null)
    {
        var response = await admin.PutAsJsonAsync($"/api/catalog/products/{productId}", new
        {
            categoryId, name, description = "Descripción", price, sortOrder = 0, isActive, allowedValueIds
        });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
    }

    private static async Task<int> AddMediaAsync(HttpClient admin, int productId, string url, int? attributeValueId = null)
    {
        var response = await admin.PostAsJsonAsync($"/api/catalog/products/{productId}/media",
            new { url, type = 0, attributeValueId });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await CatalogApi.ReadAsync(response)).GetProperty("id").GetInt32();
    }

    private static int Id(JsonElement element) => element.GetProperty("id").GetInt32();

    private static int[] VariantIds(JsonElement product) =>
        product.GetProperty("variants").EnumerateArray().Select(Id).ToArray();

    [Fact]
    public async Task Categories_ListOnlyActiveCategoriesWithActiveProducts_InOrder()
    {
        var shop = await NewShopAsync();
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(shop.Admin, "Talle", "S", "M");
        var remeras = await CatalogApi.CreateCategoryAsync(shop.Admin, "Remeras", talle);
        var buzos = await CatalogApi.CreateCategoryAsync(shop.Admin, "Buzos", talle);
        var empty = await CatalogApi.CreateCategoryAsync(shop.Admin, "Vacía", talle);
        var hidden = await CatalogApi.CreateCategoryAsync(shop.Admin, "Oculta", talle);
        await CatalogApi.CreateProductAsync(shop.Admin, remeras, "Remera Lisa", talles);
        await CatalogApi.CreateProductAsync(shop.Admin, remeras, "Remera Rayada", talles);
        var buzo = Id(await CatalogApi.CreateProductAsync(shop.Admin, buzos, "Buzo", talles));
        await CatalogApi.CreateProductAsync(shop.Admin, hidden, "Oculto", talles);
        // Inactive product does not count; a category with only inactive products disappears.
        var inactiveBuzo = Id(await CatalogApi.CreateProductAsync(shop.Admin, buzos, "Buzo Viejo", talles));
        await PutProductAsync(shop.Admin, inactiveBuzo, buzos, "Buzo Viejo", talles, isActive: false);
        var hide = await shop.Admin.PutAsJsonAsync($"/api/catalog/categories/{hidden}",
            new { name = "Oculta", sortOrder = 0, isActive = false, attributeIds = new[] { talle } });
        Assert.True(hide.IsSuccessStatusCode);
        _ = empty;
        _ = buzo;

        var categories = (await GetPublicOkAsync(shop.Host, "/api/catalog/public/categories")).EnumerateArray().ToList();

        Assert.Equal(new[] { "Buzos", "Remeras" }, categories.Select(c => c.GetProperty("name").GetString()));
        Assert.Equal(1, categories[0].GetProperty("productCount").GetInt32());
        Assert.Equal(2, categories[1].GetProperty("productCount").GetInt32());
        Assert.Equal("remeras", categories[1].GetProperty("slug").GetString());
    }

    [Fact]
    public async Task Products_ListActiveOnly_FilterByCategory_WithPriceAndCover()
    {
        var shop = await NewShopAsync();
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(shop.Admin, "Talle", "S");
        var remeras = await CatalogApi.CreateCategoryAsync(shop.Admin, "Remeras", talle);
        var buzos = await CatalogApi.CreateCategoryAsync(shop.Admin, "Buzos", talle);
        var priced = Id(await CatalogApi.CreateProductAsync(shop.Admin, remeras, "Remera", talles, price: 1500.50m));
        await CatalogApi.CreateProductAsync(shop.Admin, buzos, "Buzo", talles);
        var inactive = Id(await CatalogApi.CreateProductAsync(shop.Admin, remeras, "Remera Baja", talles));
        await PutProductAsync(shop.Admin, inactive, remeras, "Remera Baja", talles, isActive: false);
        await AddMediaAsync(shop.Admin, priced, "https://res.cloudinary.com/demo/first.jpg");
        await AddMediaAsync(shop.Admin, priced, "https://res.cloudinary.com/demo/second.jpg");

        var all = (await GetPublicOkAsync(shop.Host, "/api/catalog/public/products")).EnumerateArray().ToList();
        Assert.Equal(new[] { "Remera", "Buzo" }.Order(), all.Select(p => p.GetProperty("name").GetString()!).Order());

        var filtered = (await GetPublicOkAsync(shop.Host, "/api/catalog/public/products?category=remeras")).EnumerateArray().ToList();
        var remera = Assert.Single(filtered);
        Assert.Equal("remera", remera.GetProperty("slug").GetString());
        Assert.Equal(1500.50m, remera.GetProperty("price").GetDecimal());
        Assert.Equal("https://res.cloudinary.com/demo/first.jpg", remera.GetProperty("imageUrl").GetString());
        Assert.Equal("remeras", remera.GetProperty("categorySlug").GetString());
        Assert.Equal("Remeras", remera.GetProperty("categoryName").GetString());

        var buzo = Assert.Single((await GetPublicOkAsync(shop.Host, "/api/catalog/public/products?category=buzos")).EnumerateArray());
        Assert.Equal(JsonValueKind.Null, buzo.GetProperty("price").ValueKind);
        Assert.Equal(JsonValueKind.Null, buzo.GetProperty("imageUrl").ValueKind);

        Assert.Empty((await GetPublicOkAsync(shop.Host, "/api/catalog/public/products?category=no-existe")).EnumerateArray());
    }

    [Fact]
    public async Task ProductDetail_HasAllowedValuesOnly_ActiveVariants_AndOrderedMedia()
    {
        var shop = await NewShopAsync();
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(shop.Admin, "Talle", "S", "M", "L");
        var (color, colores) = await CatalogApi.CreateAttributeAsync(shop.Admin, "Color", "Rojo", "Azul");
        var category = await CatalogApi.CreateCategoryAsync(shop.Admin, "Remeras", color, talle);
        // Allowed: S, M (not L) × Rojo, Azul.
        var allowed = new[] { talles[0], talles[1], colores[0], colores[1] };
        var product = await CatalogApi.CreateProductAsync(shop.Admin, category, "Remera", allowed, price: 900m);
        var productId = Id(product);
        var variantIds = VariantIds(product);
        Assert.Equal(4, variantIds.Length);
        var deactivate = await shop.Admin.PatchAsJsonAsync($"/api/catalog/variants/{variantIds[0]}", new { isActive = false });
        Assert.True(deactivate.IsSuccessStatusCode);
        var onRequest = await shop.Admin.PatchAsJsonAsync($"/api/catalog/variants/{variantIds[1]}", new { availability = 1 });
        Assert.True(onRequest.IsSuccessStatusCode);
        var first = await AddMediaAsync(shop.Admin, productId, "https://res.cloudinary.com/demo/a.jpg");
        var second = await AddMediaAsync(shop.Admin, productId, "https://res.cloudinary.com/demo/b.jpg", colores[0]);
        var reorder = await shop.Admin.PutAsJsonAsync($"/api/catalog/products/{productId}/media/order",
            new { mediaIds = new[] { second, first } });
        Assert.True(reorder.IsSuccessStatusCode);

        var detail = await GetPublicOkAsync(shop.Host, "/api/catalog/public/products/remera");

        Assert.Equal("Remera", detail.GetProperty("name").GetString());
        Assert.Equal("Descripción", detail.GetProperty("description").GetString());
        Assert.Equal(900m, detail.GetProperty("price").GetDecimal());
        Assert.Equal("remeras", detail.GetProperty("categorySlug").GetString());

        var attributes = detail.GetProperty("attributes").EnumerateArray().ToList();
        Assert.Equal(new[] { "Color", "Talle" }, attributes.Select(a => a.GetProperty("name").GetString()));
        Assert.Equal(new[] { "Rojo", "Azul" }, attributes[0].GetProperty("values").EnumerateArray().Select(v => v.GetProperty("label").GetString()));
        Assert.Equal(new[] { "S", "M" }, attributes[1].GetProperty("values").EnumerateArray().Select(v => v.GetProperty("label").GetString()));

        var variants = detail.GetProperty("variants").EnumerateArray().ToList();
        Assert.Equal(variantIds.Skip(1).Order(), variants.Select(Id).Order());
        var pending = variants.Single(v => Id(v) == variantIds[1]);
        Assert.Equal(1, pending.GetProperty("availability").GetInt32());
        Assert.Equal(2, pending.GetProperty("valueIds").GetArrayLength());
        Assert.False(string.IsNullOrEmpty(pending.GetProperty("sku").GetString()));

        var media = detail.GetProperty("media").EnumerateArray().ToList();
        Assert.Equal(new[] { second, first }, media.Select(Id));
        Assert.Equal(colores[0], media[0].GetProperty("attributeValueId").GetInt32());
        Assert.Equal(0, media[0].GetProperty("type").GetInt32());
    }

    [Fact]
    public async Task ProductDetail_InactiveOrUnknownOrInactiveCategory_Is404()
    {
        var shop = await NewShopAsync();
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(shop.Admin, "Talle", "S");
        var category = await CatalogApi.CreateCategoryAsync(shop.Admin, "Remeras", talle);
        var inactive = Id(await CatalogApi.CreateProductAsync(shop.Admin, category, "Remera", talles));
        await PutProductAsync(shop.Admin, inactive, category, "Remera", talles, isActive: false);

        foreach (var slug in new[] { "remera", "no-existe" })
        {
            var response = await GetPublicAsync(shop.Host, $"/api/catalog/public/products/{slug}");
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            var body = await CatalogApi.ReadAsync(response);
            Assert.False(body.GetProperty("success").GetBoolean());
            Assert.False(string.IsNullOrEmpty(body.GetProperty("message").GetString()));
        }

        var hiddenCategory = await CatalogApi.CreateCategoryAsync(shop.Admin, "Buzos", talle);
        await CatalogApi.CreateProductAsync(shop.Admin, hiddenCategory, "Buzo", talles);
        var hide = await shop.Admin.PutAsJsonAsync($"/api/catalog/categories/{hiddenCategory}",
            new { name = "Buzos", sortOrder = 0, isActive = false, attributeIds = new[] { talle } });
        Assert.True(hide.IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await GetPublicAsync(shop.Host, "/api/catalog/public/products/buzo")).StatusCode);
        Assert.Empty((await GetPublicOkAsync(shop.Host, "/api/catalog/public/products")).EnumerateArray());
    }

    [Fact]
    public async Task AnotherTenantsHost_NeverSeesTheCatalog()
    {
        var owner = await NewShopAsync();
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(owner.Admin, "Talle", "S");
        var category = await CatalogApi.CreateCategoryAsync(owner.Admin, "Remeras", talle);
        var product = await CatalogApi.CreateProductAsync(owner.Admin, category, "Remera Única", talles);
        var variantId = VariantIds(product)[0];

        var other = await NewShopAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await GetPublicAsync(other.Host, "/api/catalog/public/products/remera-unica")).StatusCode);
        Assert.Empty((await GetPublicOkAsync(other.Host, "/api/catalog/public/categories")).EnumerateArray());
        Assert.Empty((await GetPublicOkAsync(other.Host, "/api/catalog/public/products")).EnumerateArray());
        Assert.Empty((await GetPublicOkAsync(other.Host, $"/api/catalog/public/variants?ids={variantId}")).EnumerateArray());
        // The owner's own host sees it, anonymously.
        Assert.Equal(HttpStatusCode.OK, (await GetPublicAsync(owner.Host, "/api/catalog/public/products/remera-unica")).StatusCode);
    }

    [Fact]
    public async Task UnknownTenantSubdomain_IsRejected()
    {
        var baseDomain = _factory.Services.GetRequiredService<IConfiguration>()["Tenancy:BaseDomain"]!;
        var response = await GetPublicAsync($"nadie{Guid.NewGuid():N}"[..20] + "." + baseDomain, "/api/catalog/public/categories");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task VariantsByIds_ReturnOnlyActiveOwnVariants_WithOrderedValueLabels()
    {
        var shop = await NewShopAsync();
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(shop.Admin, "Talle", "S", "M");
        var (color, colores) = await CatalogApi.CreateAttributeAsync(shop.Admin, "Color", "Rojo");
        var category = await CatalogApi.CreateCategoryAsync(shop.Admin, "Remeras", color, talle);
        var product = await CatalogApi.CreateProductAsync(shop.Admin, category, "Remera", new[] { talles[0], talles[1], colores[0] }, price: 1000m);
        var ids = VariantIds(product);
        var deactivate = await shop.Admin.PatchAsJsonAsync($"/api/catalog/variants/{ids[0]}", new { isActive = false });
        Assert.True(deactivate.IsSuccessStatusCode);

        var hidden = await CatalogApi.CreateProductAsync(shop.Admin, category, "Remera Baja", new[] { talles[0], colores[0] });
        var hiddenVariant = VariantIds(hidden)[0];
        await PutProductAsync(shop.Admin, Id(hidden), category, "Remera Baja", new[] { talles[0], colores[0] }, isActive: false);

        var other = await NewShopAsync();
        var (otherTalle, otherTalles) = await CatalogApi.CreateAttributeAsync(other.Admin, "Talle", "XL");
        var otherCategory = await CatalogApi.CreateCategoryAsync(other.Admin, "Otros", otherTalle);
        var foreignVariant = VariantIds(await CatalogApi.CreateProductAsync(other.Admin, otherCategory, "Ajeno", otherTalles))[0];

        var query = string.Join(",", ids.Append(hiddenVariant).Append(foreignVariant).Append(999_999_999));
        var variants = (await GetPublicOkAsync(shop.Host, $"/api/catalog/public/variants?ids={query}")).EnumerateArray().ToList();

        Assert.Equal(ids.Skip(1).Order(), variants.Select(Id).Order());
        var variant = variants[0];
        Assert.Equal("remera", variant.GetProperty("productSlug").GetString());
        Assert.Equal("Remera", variant.GetProperty("productName").GetString());
        Assert.Equal(1000m, variant.GetProperty("price").GetDecimal());
        Assert.Equal("Remeras", variant.GetProperty("categoryName").GetString());
        Assert.Equal(0, variant.GetProperty("availability").GetInt32());
        // Labels follow the category's attribute order: Color before Talle.
        var labels = variant.GetProperty("values").EnumerateArray().Select(v => v.GetString()).ToList();
        Assert.Equal(2, labels.Count);
        Assert.Equal("Rojo", labels[0]);
    }

    [Fact]
    public async Task VariantsByIds_ValidatesTheIdList()
    {
        var shop = await NewShopAsync();

        var tooMany = string.Join(",", Enumerable.Range(1, 201));
        Assert.Equal(HttpStatusCode.BadRequest, (await GetPublicAsync(shop.Host, $"/api/catalog/public/variants?ids={tooMany}")).StatusCode);

        var exactlyMax = string.Join(",", Enumerable.Range(1, 200));
        Assert.Equal(HttpStatusCode.OK, (await GetPublicAsync(shop.Host, $"/api/catalog/public/variants?ids={exactlyMax}")).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await GetPublicAsync(shop.Host, "/api/catalog/public/variants?ids=1,abc")).StatusCode);
        Assert.Empty((await GetPublicOkAsync(shop.Host, "/api/catalog/public/variants")).EnumerateArray());
    }
}
