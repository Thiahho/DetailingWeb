using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Turneo.Api.Modules.Catalog;

namespace Turneo.Api.Tests.Integration.Catalog;

// Regression coverage for the AccFenix bugs fixed in the port:
// M1 long names overflowing the SKU column, M3 SKUs colliding between products,
// M2 product writes and variant generation not being atomic.
[Collection("Integration")]
public class CatalogVariantIntegrityTests
{
    private readonly CustomWebApplicationFactory _factory;

    public CatalogVariantIntegrityTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task LongProductNameAndLabels_DoNotFail()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var longLabel = new string('x', 80);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", longLabel, longLabel[..79] + "y");
        var (color, colores) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo " + new string('z', 70));
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Categoría", talle, color);
        var name = string.Join(' ', Enumerable.Repeat("Ñandú", 30))[..160];

        var response = await CatalogApi.PostProductAsync(client, categoryId, name, talles.Concat(colores).ToArray());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var product = await CatalogApi.ReadAsync(response);
        Assert.True(product.GetProperty("slug").GetString()!.Length <= CatalogLimits.ProductSlugMaxLength);
        Assert.All(CatalogApi.Skus(product), sku => Assert.True(sku.Length <= CatalogLimits.SkuMaxLength));

        var tooLong = await CatalogApi.PostProductAsync(client, categoryId, new string('a', 161), talles);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }

    [Fact]
    public async Task ProductsWithCollidingSlugAndLabelText_GetDistinctSkus()
    {
        var (client, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (medida, medidas) = await CatalogApi.CreateAttributeAsync(client, "Medida", "40", "2 40");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Soportes", medida);

        // AccFenix: "soporte-2" + "40" and "soporte" + "2-40" both produced "soporte-2-40".
        var first = await CatalogApi.CreateProductAsync(client, categoryId, "Soporte 2", new[] { medidas[0] });
        var second = await CatalogApi.CreateProductAsync(client, categoryId, "Soporte", new[] { medidas[1] });
        // Same values on a third product.
        var third = await CatalogApi.CreateProductAsync(client, categoryId, "Soporte 3", new[] { medidas[0] });

        var skus = CatalogApi.Skus(first).Concat(CatalogApi.Skus(second)).Concat(CatalogApi.Skus(third)).ToList();
        Assert.Equal(3, skus.Count);
        Assert.Equal(skus.Count, skus.Distinct().Count());

        // Renaming keeps SKUs stable (derived from the product id, not its name).
        var productId = first.GetProperty("id").GetInt32();
        var rename = await client.PutAsJsonAsync($"/api/catalog/products/{productId}", new
        {
            categoryId,
            name = "Soporte reforzado",
            sortOrder = 0,
            isActive = true,
            allowedValueIds = new[] { medidas[0] }
        });
        Assert.Equal(HttpStatusCode.OK, rename.StatusCode);
        Assert.Equal(CatalogApi.Skus(first), CatalogApi.Skus(await CatalogApi.ReadAsync(rename)));
    }

    [Fact]
    public async Task GeneratorFailure_LeavesNothingHalfWritten()
    {
        var (client, tenantId) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(client, "Talle", "S", "M");
        var (color, _) = await CatalogApi.CreateAttributeAsync(client, "Color", "Rojo");
        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Remeras", talle);
        var existing = await CatalogApi.CreateProductAsync(client, categoryId, "Remera", talles);
        var existingId = existing.GetProperty("id").GetInt32();

        var failing = _factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<ICatalogVariantGenerator>();
            services.AddScoped<ICatalogVariantGenerator, ThrowingVariantGenerator>();
        }));
        var failingClient = failing.CreateClient();
        failingClient.DefaultRequestHeaders.Authorization = client.DefaultRequestHeaders.Authorization;

        // Create: the product row is inserted before generation, then rolled back.
        await SendIgnoringServerErrorAsync(() => CatalogApi.PostProductAsync(failingClient, categoryId, "Remera Fallida", talles));
        // Update: rename + allowed values change must not survive.
        await SendIgnoringServerErrorAsync(() => failingClient.PutAsJsonAsync($"/api/catalog/products/{existingId}", new
        {
            categoryId,
            name = "Remera Renombrada",
            sortOrder = 0,
            isActive = true,
            allowedValueIds = new[] { talles[0] }
        }));
        // Category update that changes attributes regenerates its products: must roll back too.
        await SendIgnoringServerErrorAsync(() => failingClient.PutAsJsonAsync($"/api/catalog/categories/{categoryId}",
            new { name = "Remeras Renombradas", sortOrder = 0, isActive = true, attributeIds = new[] { talle, color } }));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await db.CatalogProducts.IgnoreQueryFilters().AnyAsync(p => p.TenantId == tenantId && p.Name == "Remera Fallida"));

        var product = await db.CatalogProducts.IgnoreQueryFilters()
            .Include(p => p.AllowedValues)
            .Include(p => p.Variants)
            .SingleAsync(p => p.Id == existingId);
        Assert.Equal("Remera", product.Name);
        Assert.Equal(2, product.AllowedValues.Count);
        Assert.Equal(2, product.Variants.Count(v => v.IsActive));

        var category = await db.CatalogCategories.IgnoreQueryFilters()
            .Include(c => c.Attributes)
            .SingleAsync(c => c.Id == categoryId);
        Assert.Equal("Remeras", category.Name);
        Assert.Equal(new[] { talle }, category.Attributes.Select(a => a.AttributeId));
    }

    // TestServer may surface an unhandled exception either as a 500 or by
    // rethrowing it on the client; both mean the request failed.
    private static async Task SendIgnoringServerErrorAsync(Func<Task<HttpResponseMessage>> send)
    {
        try
        {
            var response = await send();
            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        }
        catch (InvalidOperationException ex) when (ex.Message == ThrowingVariantGenerator.Message)
        {
        }
    }

    private sealed class ThrowingVariantGenerator : ICatalogVariantGenerator
    {
        public const string Message = "Simulated variant generation failure";

        public Task<VariantSyncResult> SyncAsync(int productId, CancellationToken ct = default) =>
            throw new InvalidOperationException(Message);
    }
}
