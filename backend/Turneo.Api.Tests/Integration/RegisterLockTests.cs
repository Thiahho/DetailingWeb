using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// POST /api/auth/register crea un Admin: sin Auth:AllowOpenRegistration (el
// default, y lo que corre en producción) solo puede llamarlo un Admin ya
// autenticado. El host compartido de la suite tiene el flag prendido, así que
// acá se levanta uno aparte con la clave sin configurar — de paso, con su
// propio balde de la política "auth" (no consume el de AuthEndpointsTests).
[Collection("Integration")]
public class RegisterLockTests
{
    private readonly CustomWebApplicationFactory _factory;

    public RegisterLockTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private WebApplicationFactory<Program> CreateLockedHost() =>
        _factory.WithConfigOverrides(new Dictionary<string, string?> { ["Auth:AllowOpenRegistration"] = null });

    private static RegisterRequest NewAdminRequest(string email) => new()
    {
        Email = email,
        Password = "Password123",
        ConfirmPassword = "Password123"
    };

    private async Task<bool> UserExistsAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email);
    }

    [Fact]
    public async Task Register_Anonymous_WithOpenRegistrationOff_ReturnsUnauthorizedAndCreatesNothing()
    {
        var email = $"anon-admin-{Guid.NewGuid():N}@test.com";
        var host = CreateLockedHost();

        var response = await host.CreateClient().PostAsJsonAsync("/api/auth/register", NewAdminRequest(email));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.False(await UserExistsAsync(email));
    }

    [Fact]
    public async Task Register_AsAdmin_WithOpenRegistrationOff_ReturnsOk()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var admin = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, $"admin-{Guid.NewGuid():N}@test.com", "Password123");
        var email = $"second-admin-{Guid.NewGuid():N}@test.com";
        var host = CreateLockedHost();
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, admin.Id, admin.Email, "Admin", tenantId));

        var response = await client.PostAsJsonAsync("/api/auth/register", NewAdminRequest(email));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await UserExistsAsync(email));
    }

    [Fact]
    public async Task Register_AsStaff_WithOpenRegistrationOff_ReturnsForbiddenAndCreatesNothing()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var staff = await TestDataFactory.CreateStaffUserAsync(_factory, tenantId, $"staff-{Guid.NewGuid():N}@test.com", "Password123");
        var email = $"staff-made-admin-{Guid.NewGuid():N}@test.com";
        var host = CreateLockedHost();
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwtFactory.CreateToken(_factory, staff.Id, staff.Email, "Staff", tenantId));

        var response = await client.PostAsJsonAsync("/api/auth/register", NewAdminRequest(email));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.False(await UserExistsAsync(email));
    }
}
