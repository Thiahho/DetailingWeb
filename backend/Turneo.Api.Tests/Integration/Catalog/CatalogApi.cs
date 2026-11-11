using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Turneo.Api.Tests.Integration.Catalog;

// Thin HTTP helpers shared by the catalog integration tests: an authenticated
// admin client per fresh tenant and one-call seeding of attributes, categories
// and products through the real admin endpoints.
public static class CatalogApi
{
    public static async Task<(HttpClient Client, int TenantId)> NewTenantAdminAsync(CustomWebApplicationFactory factory)
    {
        var slug = $"cat{Guid.NewGuid():N}"[..20];
        var tenant = await TestDataFactory.CreateTenantAsync(factory, slug, "Negocio Catálogo");
        return (await AdminClientAsync(factory, tenant.Id), tenant.Id);
    }

    public static async Task<HttpClient> AdminClientAsync(CustomWebApplicationFactory factory, int tenantId)
    {
        var admin = await TestDataFactory.CreateAdminUserAsync(factory, tenantId, $"admin-cat-{Guid.NewGuid():N}@test.com", "Password123");
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(factory, admin.Id, admin.Email, "Admin", tenantId));
        return client;
    }

    public static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    // Creates an attribute with the given value labels; returns the attribute id and value ids in order.
    public static async Task<(int AttributeId, int[] ValueIds)> CreateAttributeAsync(HttpClient client, string name, params string[] labels)
    {
        var response = await client.PostAsJsonAsync("/api/catalog/attributes", new { name, sortOrder = 0 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var attributeId = (await ReadAsync(response)).GetProperty("id").GetInt32();

        var valueIds = new List<int>();
        for (var i = 0; i < labels.Length; i++)
        {
            var valueResponse = await client.PostAsJsonAsync($"/api/catalog/attributes/{attributeId}/values",
                new { label = labels[i], sortOrder = i });
            Assert.Equal(HttpStatusCode.Created, valueResponse.StatusCode);
            valueIds.Add((await ReadAsync(valueResponse)).GetProperty("id").GetInt32());
        }
        return (attributeId, valueIds.ToArray());
    }

    public static async Task<int> CreateCategoryAsync(HttpClient client, string name, params int[] attributeIds)
    {
        var response = await client.PostAsJsonAsync("/api/catalog/categories",
            new { name, sortOrder = 0, isActive = true, attributeIds });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadAsync(response)).GetProperty("id").GetInt32();
    }

    public static Task<HttpResponseMessage> PostProductAsync(HttpClient client, int categoryId, string name, int[] allowedValueIds, decimal? price = null, string? slug = null) =>
        client.PostAsJsonAsync("/api/catalog/products", new
        {
            categoryId,
            name,
            slug,
            description = "Descripción",
            price,
            sortOrder = 0,
            isActive = true,
            allowedValueIds
        });

    public static async Task<JsonElement> CreateProductAsync(HttpClient client, int categoryId, string name, int[] allowedValueIds, decimal? price = null)
    {
        var response = await PostProductAsync(client, categoryId, name, allowedValueIds, price);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadAsync(response);
    }

    public static string[] Skus(JsonElement product) =>
        product.GetProperty("variants").EnumerateArray().Select(v => v.GetProperty("sku").GetString()!).ToArray();
}
