using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Turneo.Api.Tests.Integration;

// Auto-registro de profesionales invitados (código + contraseña, o Google).
// Se ejercita AuthService directo en vez de pasar por HTTP: los endpoints están
// detrás de la política de rate limiting "auth" (5 req/min compartidos por toda
// la suite, ver AuthEndpointsTests) y estos flujos necesitan varias llamadas.
[Collection("Integration")]
public class ProfessionalSelfRegistrationTests
{
    private readonly CustomWebApplicationFactory _factory;

    public ProfessionalSelfRegistrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<T> WithAuthServiceAsync<T>(int tenantId, Func<AuthService, ApplicationDbContext, Task<T>> action)
    {
        using var scope = _factory.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<CurrentTenantService>().SetTenant(tenantId);
        var authService = scope.ServiceProvider.GetRequiredService<AuthService>();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await action(authService, db);
    }

    private async Task<(int TenantId, Professional Professional, string Email)> CreateInvitedProfessionalAsync()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var professional = await TestDataFactory.CreateProfessionalAsync(_factory, tenantId);
        var email = $"invitado-{Guid.NewGuid():N}@test.com";

        using var scope = _factory.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<CurrentTenantService>().SetTenant(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var tracked = await db.Professionals.FirstAsync(p => p.Id == professional.Id);
        tracked.Email = email;
        await db.SaveChangesAsync();

        return (tenantId, professional, email);
    }

    private static ProfessionalRegistrationCompleteRequest CompleteRequest(string token, string password = "Password123") => new()
    {
        RegistrationToken = token,
        Password = password,
        ConfirmPassword = password
    };

    [Fact]
    public async Task RequestRegistration_EmailNotInvited_ReturnsNoCode()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

        var code = await WithAuthServiceAsync(tenantId, (auth, _) =>
            auth.RequestProfessionalRegistrationAsync($"ajeno-{Guid.NewGuid():N}@test.com"));

        Assert.Null(code);
    }

    [Fact]
    public async Task RequestRegistration_ProfessionalAlreadyHasAccount_ReturnsNoCode()
    {
        var (tenantId, professional, email) = await CreateInvitedProfessionalAsync();
        await TestDataFactory.CreateProfessionalUserAsync(_factory, tenantId, professional.Id, email, "Password123");

        var code = await WithAuthServiceAsync(tenantId, (auth, _) => auth.RequestProfessionalRegistrationAsync(email));

        Assert.Null(code);
    }

    [Fact]
    public async Task FullCodeFlow_CreatesAccountLinkedToProfessional_AndPasswordLoginWorks()
    {
        var (tenantId, professional, email) = await CreateInvitedProfessionalAsync();

        // El email se normaliza: el profesional puede tipearlo con mayúsculas.
        var code = await WithAuthServiceAsync(tenantId, (auth, _) => auth.RequestProfessionalRegistrationAsync(email.ToUpperInvariant()));
        Assert.NotNull(code);

        var token = await WithAuthServiceAsync(tenantId, (auth, _) => auth.VerifyProfessionalRegistrationCodeAsync(email, code!));
        var response = await WithAuthServiceAsync(tenantId, (auth, _) => auth.CompleteProfessionalRegistrationAsync(CompleteRequest(token)));

        Assert.Equal("Professional", response.Role);
        Assert.Equal(professional.Id, response.ProfessionalId);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));

        var login = await WithAuthServiceAsync(tenantId, (auth, _) =>
            auth.LoginAsync(new LoginRequest { Email = email, Password = "Password123" }));
        Assert.NotNull(login);
        Assert.Equal(professional.Id, login!.ProfessionalId);
    }

    // El token de registro va firmado con la misma clave que los de sesión, pero
    // solo sirve en el body de register/complete: como bearer no autentica nada.
    [Fact]
    public async Task RegistrationToken_UsedAsBearer_IsRejected_ButStillCompletesRegistration()
    {
        var (tenantId, professional, email) = await CreateInvitedProfessionalAsync();
        var code = await WithAuthServiceAsync(tenantId, (auth, _) => auth.RequestProfessionalRegistrationAsync(email));
        var token = await WithAuthServiceAsync(tenantId, (auth, _) => auth.VerifyProfessionalRegistrationCodeAsync(email, code!));

        // /me no tiene rate limiting, así que no consume el balde "auth" de la suite.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var me = await client.GetAsync("/api/auth/me");

        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, me.StatusCode);

        var response = await WithAuthServiceAsync(tenantId, (auth, _) => auth.CompleteProfessionalRegistrationAsync(CompleteRequest(token)));
        Assert.Equal(professional.Id, response.ProfessionalId);
    }

    [Fact]
    public async Task VerifyCode_WrongCode_Fails_AndLocksAfterMaxAttempts()
    {
        var (tenantId, _, email) = await CreateInvitedProfessionalAsync();
        var code = await WithAuthServiceAsync(tenantId, (auth, _) => auth.RequestProfessionalRegistrationAsync(email));
        var wrongCode = code == "000000" ? "111111" : "000000";

        for (var attempt = 0; attempt < 5; attempt++)
        {
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                WithAuthServiceAsync(tenantId, (auth, _) => auth.VerifyProfessionalRegistrationCodeAsync(email, wrongCode)));
        }

        // Tras 5 fallos, ni el código correcto sirve.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.VerifyProfessionalRegistrationCodeAsync(email, code!)));
    }

    [Fact]
    public async Task VerifyCode_CodeCannotBeReused()
    {
        var (tenantId, _, email) = await CreateInvitedProfessionalAsync();
        var code = await WithAuthServiceAsync(tenantId, (auth, _) => auth.RequestProfessionalRegistrationAsync(email));

        await WithAuthServiceAsync(tenantId, (auth, _) => auth.VerifyProfessionalRegistrationCodeAsync(email, code!));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.VerifyProfessionalRegistrationCodeAsync(email, code!)));
    }

    [Fact]
    public async Task ProfessionalRegistrationCode_IsNotAcceptedAsClientOtp()
    {
        var (tenantId, _, email) = await CreateInvitedProfessionalAsync();
        var code = await WithAuthServiceAsync(tenantId, (auth, _) => auth.RequestProfessionalRegistrationAsync(email));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) =>
                auth.VerifyClientOtpAsync(new ClientOtpVerifyRequest { Email = email, OtpCode = code! })));
    }

    [Fact]
    public async Task CompleteRegistration_ShortPassword_IsRejected()
    {
        var (tenantId, _, email) = await CreateInvitedProfessionalAsync();
        var code = await WithAuthServiceAsync(tenantId, (auth, _) => auth.RequestProfessionalRegistrationAsync(email));
        var token = await WithAuthServiceAsync(tenantId, (auth, _) => auth.VerifyProfessionalRegistrationCodeAsync(email, code!));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.CompleteProfessionalRegistrationAsync(CompleteRequest(token, "corta1"))));
    }

    [Fact]
    public async Task CompleteRegistration_InvalidToken_IsRejected()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.CompleteProfessionalRegistrationAsync(CompleteRequest("no-es-un-jwt"))));
    }

    [Fact]
    public async Task CompleteRegistration_SessionTokenOfAnotherType_IsRejected()
    {
        // Un JWT válido pero de sesión (no de registro) no debe servir para crear una cuenta.
        var (tenantId, _, email) = await CreateInvitedProfessionalAsync();
        var sessionToken = TestJwtFactory.CreateToken(_factory, 0, email, "Admin", tenantId);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.CompleteProfessionalRegistrationAsync(CompleteRequest(sessionToken))));
    }

    [Fact]
    public async Task GoogleLogin_InvitedEmail_CreatesAccountLinkedToProfessional()
    {
        var (tenantId, professional, email) = await CreateInvitedProfessionalAsync();

        var response = await WithAuthServiceAsync(tenantId, (auth, _) => auth.LoginProfessionalWithGoogleAsync($"verified:{email}"));

        Assert.Equal("Professional", response.Role);
        Assert.Equal(professional.Id, response.ProfessionalId);

        var accounts = await WithAuthServiceAsync(tenantId, (_, db) => db.Users.CountAsync(u => u.Email == email));
        Assert.Equal(1, accounts);
    }

    [Fact]
    public async Task GoogleLogin_ExistingAccount_LogsInWithoutCreatingAnother()
    {
        var (tenantId, professional, email) = await CreateInvitedProfessionalAsync();
        await TestDataFactory.CreateProfessionalUserAsync(_factory, tenantId, professional.Id, email, "Password123");

        var response = await WithAuthServiceAsync(tenantId, (auth, _) => auth.LoginProfessionalWithGoogleAsync($"verified:{email}"));

        Assert.Equal(professional.Id, response.ProfessionalId);
        var accounts = await WithAuthServiceAsync(tenantId, (_, db) => db.Users.CountAsync(u => u.Email == email));
        Assert.Equal(1, accounts);
    }

    [Fact]
    public async Task GoogleLogin_EmailNotInvited_IsRejected()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.LoginProfessionalWithGoogleAsync($"verified:ajeno-{Guid.NewGuid():N}@test.com")));
    }

    [Fact]
    public async Task GoogleLogin_UnverifiedEmail_IsRejected()
    {
        var (tenantId, _, email) = await CreateInvitedProfessionalAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.LoginProfessionalWithGoogleAsync($"unverified:{email}")));
    }

    [Fact]
    public async Task GoogleLogin_InvalidToken_IsRejected()
    {
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.LoginProfessionalWithGoogleAsync("token-invalido")));
    }

    [Fact]
    public async Task GoogleLogin_AdminAccountWithSameEmail_IsNotLoggedInAsProfessional()
    {
        // Google solo abre cuentas de profesional: un admin con ese correo no entra por acá.
        var tenantId = await TestDataFactory.GetOrCreateLegacyTenantIdAsync(_factory);
        var email = $"admin-{Guid.NewGuid():N}@test.com";
        await TestDataFactory.CreateAdminUserAsync(_factory, tenantId, email, "Password123");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            WithAuthServiceAsync(tenantId, (auth, _) => auth.LoginProfessionalWithGoogleAsync($"verified:{email}")));
    }
}
