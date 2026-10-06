using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Turneo.Api.Core.Roles;

namespace Turneo.Api.Tests.Integration;

// Enforcement de permisos por módulo para el rol Staff (RequirePermissionAttribute
// + filas de ModulePermission): sin la fila del módulo/acción → 403, con ella →
// 2xx, y el Admin no depende de ninguna fila.
[Collection("Integration")]
public class StaffPermissionsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public StaffPermissionsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient Client, int UserId, int TenantId)> CreateStaffClientAsync()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var staff = await TestDataFactory.CreateStaffUserAsync(_factory, tenantId, $"staff-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, staff.Id, staff.Email, "Staff", tenantId));
        return (client, staff.Id, tenantId);
    }

    private static object InsumoPayload() => new
    {
        name = $"Insumo {Guid.NewGuid():N}",
        stock = 10,
        lowStockThreshold = 2,
        unitCost = 5,
        isActive = true,
        order = 0
    };

    [Theory]
    [InlineData("/api/insumos")]
    [InlineData("/api/products")]
    public async Task Staff_WithoutModulePermission_GetsForbidden(string url)
    {
        var (client, _, _) = await CreateStaffClientAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData(PermissionModules.Insumos, "/api/insumos")]
    [InlineData(PermissionModules.Productos, "/api/products")]
    public async Task Staff_WithViewPermission_GetsOk(string module, string url)
    {
        var (client, userId, tenantId) = await CreateStaffClientAsync();
        await TestDataFactory.GrantModulePermissionAsync(_factory, tenantId, userId, module, canView: true);

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Staff_PermissionOnOneModule_DoesNotGrantAnother()
    {
        var (client, userId, tenantId) = await CreateStaffClientAsync();
        await TestDataFactory.GrantModulePermissionAsync(_factory, tenantId, userId, PermissionModules.Insumos, canView: true);

        var response = await client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Staff_WithViewOnly_CannotCreate()
    {
        var (client, userId, tenantId) = await CreateStaffClientAsync();
        await TestDataFactory.GrantModulePermissionAsync(_factory, tenantId, userId, PermissionModules.Insumos, canView: true);

        var response = await client.PostAsJsonAsync("/api/insumos", InsumoPayload());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Staff_WithCreatePermission_CanCreate()
    {
        var (client, userId, tenantId) = await CreateStaffClientAsync();
        await TestDataFactory.GrantModulePermissionAsync(_factory, tenantId, userId, PermissionModules.Insumos, canView: true, canCreate: true);

        var response = await client.PostAsJsonAsync("/api/insumos", InsumoPayload());

        Assert.True(response.IsSuccessStatusCode, $"Esperaba 2xx, llegó {(int)response.StatusCode}");
    }

    [Theory]
    [InlineData("/api/insumos")]
    [InlineData("/api/products")]
    public async Task Admin_WithoutAnyPermissionRow_IsNotRestricted(string url)
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-perm-{Guid.NewGuid():N}@test.com", "Password123");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
