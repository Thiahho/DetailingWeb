using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Turneo.Api.Core.Platform;

// Login del dueño de la plataforma (Thiago) — no es un User tenant-scoped, la
// credencial vive en config (PlatformOwner:Email/PasswordHash), no en la base.
// A propósito no reusa AuthService: ese depende de ICurrentTenant y siempre
// agrega un claim tenant_id al token, lo que no corresponde para un actor que
// opera fuera de cualquier tenant.
public class PlatformAuthService
{
    private const string Role = "PlatformOwner";

    private readonly IConfiguration _configuration;

    public PlatformAuthService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public PlatformLoginResponse? Login(PlatformLoginRequest request)
    {
        var ownerEmail = _configuration["PlatformOwner:Email"];
        var ownerHash = _configuration["PlatformOwner:PasswordHash"];

        if (string.IsNullOrEmpty(ownerEmail) || string.IsNullOrEmpty(ownerHash))
            return null;

        if (!string.Equals(request.Email.Trim(), ownerEmail, StringComparison.OrdinalIgnoreCase))
            return null;

        if (!BCrypt.Net.BCrypt.Verify(request.Password, ownerHash))
            return null;

        var expiryMinutes = int.Parse(_configuration["Jwt:ExpiryMinutes"]!);
        var token = GenerateJwtToken(ownerEmail, TimeSpan.FromMinutes(expiryMinutes));

        return new PlatformLoginResponse(token, ownerEmail);
    }

    private string GenerateJwtToken(string email, TimeSpan expiresIn)
    {
        var jwtKey = _configuration["Jwt:Key"];
        var key = Encoding.ASCII.GetBytes(jwtKey!);

        // Sin claim tenant_id a propósito: este actor no pertenece a ningún
        // tenant. TenantResolutionMiddleware cae a resolución por host, lo cual
        // es inofensivo porque los endpoints de PlatformOwner no leen ICurrentTenant.
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, "0"),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, Role),
            new Claim("token_type", "platform_access")
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.Add(expiresIn),
            Issuer = _configuration["Jwt:Issuer"],
            Audience = _configuration["Jwt:Audience"],
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
