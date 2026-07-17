using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

// Multi-tenancy: una instancia por scope/request, la completa TenantResolutionMiddleware.
builder.Services.AddScoped<CurrentTenantService>();
builder.Services.AddScoped<ICurrentTenant>(sp => sp.GetRequiredService<CurrentTenantService>());
// Core depende solo de IPlanLimitsService (Shared) — nunca de SaaS directamente.
builder.Services.AddScoped<IPlanLimitsService, PlanLimitsService>();
// Capa de repositorio (auditoría, "reducir acoplamiento de ApplicationDbContext") — piloteada en Professionals,
// extendida al resto de los controllers que antes inyectaban ApplicationDbContext directo.
builder.Services.AddScoped<IProfessionalsRepository, ProfessionalsRepository>();
builder.Services.AddScoped<ISiteConfigRepository, SiteConfigRepository>();
builder.Services.AddScoped<IBusinessSettingsRepository, BusinessSettingsRepository>();
builder.Services.AddScoped<IBlockedDatesRepository, BlockedDatesRepository>();
builder.Services.AddScoped<IContentVideosRepository, ContentVideosRepository>();
builder.Services.AddScoped<IGalleryRepository, GalleryRepository>();
builder.Services.AddScoped<IAnalyticsRepository, AnalyticsRepository>();
builder.Services.AddScoped<IServicesRepository, ServicesRepository>();
builder.Services.AddScoped<IProductsRepository, ProductsRepository>();
builder.Services.AddScoped<ICajaRepository, CajaRepository>();
builder.Services.AddScoped<ITimeSlotsRepository, TimeSlotsRepository>();
builder.Services.AddScoped<IBookingsRepository, BookingsRepository>();
builder.Services.AddScoped<IPaymentsRepository, PaymentsRepository>();
builder.Services.AddScoped<IAutomationRulesRepository, AutomationRulesRepository>();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
});

builder.Services.AddJwtAuthentication(builder.Configuration, builder.Environment);

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// Servicios
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddScoped<TimeSlotGeneratorService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddHttpClient<NotificationTemplateService>();
builder.Services.AddScoped<NotificationService>();
// Testing (e2e de Playwright) no debe mandar WhatsApp/emails reales — appsettings.json
// tiene credenciales reales cargadas. Ver NoopNotificationProvider.
if (builder.Environment.IsEnvironment("Testing"))
{
    builder.Services.AddScoped<INotificationProvider, NoopNotificationProvider>();
}
else
{
    builder.Services.AddHttpClient<WhatsAppProvider>();
    builder.Services.AddScoped<INotificationProvider, GmailProvider>();
    builder.Services.AddScoped<INotificationProvider, WhatsAppProvider>();
}
builder.Services.AddHostedService<NotificationRetryBackgroundService>();
builder.Services.AddHostedService<ReminderBackgroundService>();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddScoped<CustomerProfileService>();
builder.Services.AddScoped<HangfireReminderJob>();
builder.Services.AddScoped<AutomationRuleEvaluationJob>();

builder.Services.AddBackgroundJobs(builder.Configuration);

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

// Render (y la mayoría de los PaaS) terminan la conexión en un proxy propio,
// así que sin esto Connection.RemoteIpAddress es siempre la IP interna del
// proxy y el rate limiter por IP no distingue clientes reales.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Rate limiting: solo en los endpoints públicos/anónimos identificados en la
// auditoría (login, OTP, alta de reservas) — no aplica un límite global para
// no afectar al panel admin autenticado.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.OnRejected = (context, token) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        return new ValueTask(context.HttpContext.Response.WriteAsync(
            "Demasiadas solicitudes. Intenta de nuevo en unos minutos.", token));
    };

    // Login, registro y flujo de acceso/OTP del cliente: objetivo de fuerza bruta.
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Creación/cancelación/reprogramación de turnos y búsqueda por email: público, anónimo.
    options.AddPolicy("public-booking", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Webhook de MercadoPago: tráfico servidor-a-servidor desde la propia
    // infraestructura de MercadoPago (no un usuario final), así que se separa
    // de "public-booking" con un límite más generoso — el objetivo es cortar
    // abuso si la URL se filtra, no interferir con ráfagas legítimas de
    // notificaciones de pago.
    options.AddPolicy("payments-webhook", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var app = builder.Build();

app.UseForwardedHeaders();

// ✅ PRODUCCIÓN: Aplicar migraciones automáticamente
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.Migrate();

    await SaaSCatalogSeeder.SeedAsync(context);
}

// ✅ PRODUCCIÓN: Configuración del pipeline
app.UseCors("ProductionPolicy");
app.UseAuthentication();
// Después de Authentication (necesita leer el claim tenant_id del JWT) y antes
// de Authorization/MapControllers (todo lo que sigue ya necesita el tenant resuelto).
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();

app.UseBackgroundJobs();

app.Run();

// Necesario para que WebApplicationFactory<Program> (tests de integración) pueda
// referenciar este entry point de top-level statements desde otro assembly.
public partial class Program { }
