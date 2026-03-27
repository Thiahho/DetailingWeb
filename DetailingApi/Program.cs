using DetailingApi.Services;
using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
});

var jwtKey = builder.Configuration["Jwt:Key"];
var key = Encoding.ASCII.GetBytes(jwtKey!);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    // ✅ PRODUCCIÓN: Requiere HTTPS automáticamente
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
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
                    ?? context.Request.Cookies["token"];
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
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();    
builder.Services.AddControllers();

// Servicios
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddScoped<TimeSlotGeneratorService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddHttpClient<NotificationTemplateService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddHttpClient<WhatsAppProvider>();
builder.Services.AddScoped<INotificationProvider, GmailProvider>();
builder.Services.AddScoped<INotificationProvider, WhatsAppProvider>();
builder.Services.AddHostedService<NotificationRetryBackgroundService>();
builder.Services.AddHostedService<ReminderBackgroundService>();

// CORS: leer origenes de configuración
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("ProductionPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// ✅ PRODUCCIÓN: Aplicar migraciones automáticamente
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.Migrate();
    
    await DatabaseSeeder.SeedAsync(context);
}

// ✅ PRODUCCIÓN: Configuración del pipeline
app.UseCors("ProductionPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
