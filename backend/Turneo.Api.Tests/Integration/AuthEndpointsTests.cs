using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Nota: todos los endpoints acá están detrás de la política de rate limiting
// "auth" (5 req/min por IP, y el TestServer reporta una IP nula → todos los
// tests de esta clase comparten el mismo balde). Esta clase hace como máximo
// 5 llamadas HTTP reales a endpoints "auth" a propósito — cualquier setup que
// necesite un token usa TestJwtFactory en vez de pasar por /login.
[Collection("Integration")]
public class AuthEndpointsTests
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_WithValidAdminCredentials_ReturnsOkAndSetsCookie()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var email = $"admin-{Guid.NewGuid():N}@test.com";
        await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, email, "Password123");

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { Email = email, Password = "Password123" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out var cookies));
        Assert.Contains(cookies!, c => c.StartsWith("admin_token="));
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var email = $"admin-{Guid.NewGuid():N}@test.com";
        await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, email, "Password123");

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { Email = email, Password = "WrongPassword" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Register_NewAdmin_ReturnsOkWithToken()
    {
        var email = $"new-admin-{Guid.NewGuid():N}@test.com";
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Email = email,
            Password = "Password123",
            ConfirmPassword = "Password123"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.False(string.IsNullOrWhiteSpace(body!.Token));
        Assert.Equal("Admin", body.Role);
    }

    [Fact]
    public async Task Register_WithMismatchedPasswords_ReturnsBadRequest()
    {
        var email = $"mismatch-{Guid.NewGuid():N}@test.com";
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Email = email,
            Password = "Password123",
            ConfirmPassword = "Different123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RequestClientAccess_WithoutExistingBooking_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/client/access/request",
            new ClientAccessRequest { Email = $"no-bookings-{Guid.NewGuid():N}@test.com" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetCurrentUser_WithoutToken_ReturnsUnauthorized()
    {
        // No cuenta contra la política "auth": /me no tiene [EnableRateLimiting].
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetCurrentUser_WithValidToken_ReturnsUserInfo()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var email = $"me-{Guid.NewGuid():N}@test.com";
        var user = await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, email, "Password123");

        var client = _factory.CreateClient();
        var token = TestJwtFactory.CreateToken(_factory, user.Id, email, "Admin", tenantId);
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // El token del link "Mis turnos" (booking_access, 7 días, viaja en una URL) solo
    // existe para canjearse en client/session/exchange: como bearer se rechaza.
    [Fact]
    public async Task GetCurrentUser_WithClientPortalLinkToken_ReturnsUnauthorized_ButTokenStillExchanges()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var email = $"portal-{Guid.NewGuid():N}@test.com";
        // Con un usuario real detrás del email: sin el rechazo, /me devolvería 200.
        await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, email, "Password123");

        using var scope = _factory.Services.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<AuthService>();
        var linkToken = authService.CreateClientPortalAccessToken(email, tenantId);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", linkToken);
        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        // El canje (AuthService directo, para no gastar el balde "auth") sigue andando
        // y la sesión de cliente que emite sí autentica.
        var session = authService.ExchangeClientPortalToken(linkToken);
        Assert.Equal("Client", session.Role);

        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", session.Token);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }
}
