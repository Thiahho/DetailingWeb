using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Turneo.Api.Infrastructure.Authentication;

public static class JwtAuthenticationSetup
{
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
