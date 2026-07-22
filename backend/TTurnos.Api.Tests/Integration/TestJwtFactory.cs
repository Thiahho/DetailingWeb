using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Turneo.Api.Tests.Integration;

// Emite JWTs con la misma forma que AuthService.GenerateJwtToken, pero sin
// pasar por POST /api/auth/login: ese endpoint tiene rate limiting (5/min por
// IP) y en la suite de tests varias clases necesitan tokens para distintos
// tenants/roles — pasar todas por HTTP agotaría el límite y volvería la
// suite flaky. Login en sí se prueba puntualmente en AuthEndpointsTests.
public static class TestJwtFactory
{
    public static string CreateToken(CustomWebApplicationFactory factory, int userId, string email, string role, int tenantId, int? professionalId = null)
    {
        var configuration = factory.Services.GetRequiredService<IConfiguration>();
        var key = Encoding.ASCII.GetBytes(configuration["Jwt:Key"]!);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("token_type", "admin_access"),
            new("tenant_id", tenantId.ToString())
        };
        if (professionalId.HasValue)
            claims.Add(new Claim("professional_id", professionalId.Value.ToString()));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(1),
            Issuer = configuration["Jwt:Issuer"],
            Audience = configuration["Jwt:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(tokenDescriptor));
    }
}
