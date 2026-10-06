using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Turneo.Api.Infrastructure.Authentication;

public static class JwtAuthenticationSetup
{
    // Tokens firmados con la misma clave que los de sesión pero que no son una
    // sesión: se validan a mano desde el body del único endpoint que los consume
    // (AuthService.ValidateToken) y nunca deben autenticar una llamada a la API.
    //   - professional_registration: 10 minutos, solo para register/complete.
    //   - booking_access: link "Mis turnos" del email (7 días, viaja en una URL),
    //     solo para canjearse en client/session/exchange.
    // Lista de rechazo y no de permitidos a propósito: los de sesión (admin_access,
    // client_access, platform_access) y cualquier token sin token_type siguen pasando.
    private static readonly HashSet<string> NonSessionTokenTypes = new(StringComparer.Ordinal)
    {
        "professional_registration",
        "booking_access"
    };

    public static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        var jwtKey = configuration["Jwt:Key"];
        var key = Encoding.ASCII.GetBytes(jwtKey!);

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            // ✅ PRODUCCIÓN: Requiere HTTPS automáticamente
            options.RequireHttpsMetadata = !environment.IsDevelopment();
            options.SaveToken = true;

            // ✅ PRODUCCIÓN: Acepta token desde Cookie o Authorization header
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    // Primero buscar en Authorization header
                    var token = context.Request.Headers["Authorization"]
                        .FirstOrDefault()?.Split(" ").Last();

                    // Si no hay, buscar en cookie
                    if (string.IsNullOrEmpty(token))
                    {
                        token = context.Request.Cookies["admin_token"]
                            ?? context.Request.Cookies["client_token"]
                            ?? context.Request.Cookies["token"]
                            ?? context.Request.Cookies["platform_token"];
                    }

                    context.Token = token;
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    var tokenType = context.Principal?.FindFirst("token_type")?.Value;
                    if (tokenType != null && NonSessionTokenTypes.Contains(tokenType))
                        context.Fail("Este tipo de token no autentica llamadas a la API");

                    return Task.CompletedTask;
                }
            };

            // ✅ PRODUCCIÓN: Validación completa del token
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = configuration["Jwt:Issuer"],
                ValidateAudience = true,
                ValidAudience = configuration["Jwt:Audience"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };
        });

        return services;
    }
}
