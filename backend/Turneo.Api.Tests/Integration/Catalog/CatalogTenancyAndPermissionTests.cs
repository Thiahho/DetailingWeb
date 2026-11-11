using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Core.Roles;

namespace Turneo.Api.Tests.Integration.Catalog;

[Collection("Integration")]
public class CatalogTenancyAndPermissionTests
{
    private static readonly string[] CatalogTables =
    {
        "CatalogCategories", "CatalogAttributes", "CatalogAttributeValues", "CatalogCategoryAttributes",
        "CatalogProducts", "CatalogProductAllowedValues", "CatalogVariants", "CatalogVariantValues", "CatalogMedia"
    };

    private readonly CustomWebApplicationFactory _factory;

    public CatalogTenancyAndPermissionTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AnotherTenant_CannotReadOrModifyTheCatalog()
    {
        var (owner, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (talle, talles) = await CatalogApi.CreateAttributeAsync(owner, "Talle", "S");
        var categoryId = await CatalogApi.CreateCategoryAsync(owner, "Remeras", talle);
        var product = await CatalogApi.CreateProductAsync(owner, categoryId, "Remera", talles);
        var productId = product.GetProperty("id").GetInt32();
        var variantId = product.GetProperty("variants")[0].GetProperty("id").GetInt32();

        var (intruder, _) = await CatalogApi.NewTenantAdminAsync(_factory);

        Assert.Empty((await CatalogApi.ReadAsync(await intruder.GetAsync("/api/catalog/categories"))).EnumerateArray());
        Assert.Empty((await CatalogApi.ReadAsync(await intruder.GetAsync("/api/catalog/attributes"))).EnumerateArray());
        Assert.Empty((await CatalogApi.ReadAsync(await intruder.GetAsync("/api/catalog/products"))).EnumerateArray());

        Assert.Equal(HttpStatusCode.NotFound, (await intruder.GetAsync($"/api/catalog/products/{productId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.GetAsync($"/api/catalog/categories/{categoryId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync($"/api/catalog/products/{productId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync($"/api/catalog/categories/{categoryId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync($"/api/catalog/attribute-values/{talles[0]}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await intruder.PatchAsJsonAsync($"/api/catalog/variants/{variantId}", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await intruder.PutAsJsonAsync($"/api/catalog/attributes/{talle}", new { name = "Hackeado", sortOrder = 0 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await intruder.PostAsJsonAsync($"/api/catalog/products/{productId}/media",
                new { url = "https://res.cloudinary.com/demo/image/upload/x.jpg", type = 0 })).StatusCode);

        // Bulk patch with a foreign product id touches nothing.
        var bulk = await intruder.PatchAsJsonAsync("/api/catalog/variants/bulk", new { productId, valueIds = Array.Empty<int>(), availability = 1 });
        Assert.Equal(0, (await CatalogApi.ReadAsync(bulk)).GetProperty("updated").GetInt32());

        // Foreign ids cannot be referenced from the intruder's own catalog.
        var (ownAttr, _) = await CatalogApi.CreateAttributeAsync(intruder, "Color", "Azul");
        var ownCategory = await CatalogApi.CreateCategoryAsync(intruder, "Propia", ownAttr);
        Assert.Equal(HttpStatusCode.BadRequest, (await CatalogApi.PostProductAsync(intruder, categoryId, "Ajena", Array.Empty<int>())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await CatalogApi.PostProductAsync(intruder, ownCategory, "Ajena", talles)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await intruder.PostAsJsonAsync("/api/catalog/categories",
            new { name = "Ajena", sortOrder = 0, isActive = true, attributeIds = new[] { talle } })).StatusCode);

        var ownerView = await CatalogApi.ReadAsync(await owner.GetAsync($"/api/catalog/products/{productId}"));
        Assert.Equal("Remera", ownerView.GetProperty("name").GetString());
        Assert.True(ownerView.GetProperty("variants")[0].GetProperty("isActive").GetBoolean());
        Assert.Equal(0, ownerView.GetProperty("variants")[0].GetProperty("availability").GetInt32());
    }

    [Fact]
    public async Task Slugs_AreUniquePerTenant_NotGlobally()
    {
        var (first, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var (second, _) = await CatalogApi.NewTenantAdminAsync(_factory);

        var firstCategory = await CatalogApi.CreateCategoryAsync(first, "Accesorios");
        var secondCategory = await CatalogApi.CreateCategoryAsync(second, "Accesorios");
        await CatalogApi.CreateAttributeAsync(first, "Color");
        await CatalogApi.CreateAttributeAsync(second, "Color");
        await CatalogApi.CreateProductAsync(first, firstCategory, "Collar", Array.Empty<int>());
        await CatalogApi.CreateProductAsync(second, secondCategory, "Collar", Array.Empty<int>());

        var duplicateCategory = await first.PostAsJsonAsync("/api/catalog/categories",
            new { name = "Otra", slug = "accesorios", sortOrder = 0, isActive = true, attributeIds = Array.Empty<int>() });
        Assert.Equal(HttpStatusCode.Conflict, duplicateCategory.StatusCode);
        var duplicateAttribute = await first.PostAsJsonAsync("/api/catalog/attributes", new { name = "color", sortOrder = 0 });
        Assert.Equal(HttpStatusCode.Conflict, duplicateAttribute.StatusCode);
        var duplicateProduct = await CatalogApi.PostProductAsync(first, firstCategory, "Collar", Array.Empty<int>());
        Assert.Equal(HttpStatusCode.Conflict, duplicateProduct.StatusCode);
        var message = (await CatalogApi.ReadAsync(duplicateProduct)).GetProperty("message").GetString();
        Assert.Contains("collar", message);
    }

    [Fact]
    public async Task Staff_NeedsCatalogPermission()
    {
        var tenant = await TestDataFactory.CreateTenantAsync(_factory, $"catp{Guid.NewGuid():N}"[..20], "Negocio Staff");
        var staff = await TestDataFactory.CreateStaffUserAsync(_factory, tenant.Id, $"staff-cat-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, staff.Id, staff.Email, "Staff", tenant.Id));

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/catalog/categories")).StatusCode);

        await TestDataFactory.GrantModulePermissionAsync(_factory, tenant.Id, staff.Id, PermissionModules.Catalogo, canView: true);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/catalog/categories")).StatusCode);
        var denied = await client.PostAsJsonAsync("/api/catalog/categories",
            new { name = "Sin permiso", sortOrder = 0, isActive = true, attributeIds = Array.Empty<int>() });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        // Another module's permission never grants the catalog.
        var other = await TestDataFactory.CreateStaffUserAsync(_factory, tenant.Id, $"staff-cat2-{Guid.NewGuid():N}@test.com", "Password123");
        await TestDataFactory.GrantModulePermissionAsync(_factory, tenant.Id, other.Id, PermissionModules.Productos,
            canView: true, canCreate: true, canEdit: true, canDelete: true);
        var otherClient = _factory.CreateClient();
        otherClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, other.Id, other.Email, "Staff", tenant.Id));
        Assert.Equal(HttpStatusCode.Forbidden, (await otherClient.GetAsync("/api/catalog/products")).StatusCode);

        var creator = await TestDataFactory.CreateStaffUserAsync(_factory, tenant.Id, $"staff-cat3-{Guid.NewGuid():N}@test.com", "Password123");
        await TestDataFactory.GrantModulePermissionAsync(_factory, tenant.Id, creator.Id, PermissionModules.Catalogo, canView: true, canCreate: true);
        var creatorClient = _factory.CreateClient();
        creatorClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, creator.Id, creator.Email, "Staff", tenant.Id));
        var created = await creatorClient.PostAsJsonAsync("/api/catalog/categories",
            new { name = "Con permiso", sortOrder = 0, isActive = true, attributeIds = Array.Empty<int>() });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
    }

    [Fact]
    public void PermissionMatrix_IncludesCatalogModule()
    {
        Assert.Contains(PermissionModules.Catalogo, PermissionModules.All);
        Assert.True(PermissionModules.IsValid("Catalogo"));
    }

    [Fact]
    public async Task CatalogTables_HaveForcedRowLevelSecurityPolicies()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var policies = await db.Database
            .SqlQueryRaw<string>("SELECT tablename::text AS \"Value\" FROM pg_policies WHERE policyname = 'tenant_isolation'")
            .ToListAsync();
        var forced = await db.Database
            .SqlQueryRaw<string>("SELECT relname::text AS \"Value\" FROM pg_class WHERE relrowsecurity AND relforcerowsecurity")
            .ToListAsync();

        Assert.All(CatalogTables, table =>
        {
            Assert.Contains(table, policies);
            Assert.Contains(table, forced);
        });
    }
}
