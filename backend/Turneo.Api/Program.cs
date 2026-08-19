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
builder.Services.AddScoped<IInsumosRepository, InsumosRepository>();
builder.Services.AddScoped<IServiceInsumosRepository, ServiceInsumosRepository>();
builder.Services.AddScoped<ICajaRepository, CajaRepository>();
builder.Services.AddScoped<ITimeSlotsRepository, TimeSlotsRepository>();
builder.Services.AddScoped<IBookingsRepository, BookingsRepository>();
builder.Services.AddScoped<IPaymentsRepository, PaymentsRepository>();
builder.Services.AddScoped<IAutomationRulesRepository, AutomationRulesRepository>();
builder.Services.AddScoped<IPermissionsRepository, PermissionsRepository>();
builder.Services.AddScoped<ISmartTagsRepository, SmartTagsRepository>();

builder.Services.AddScoped<TenantSessionInterceptor>();
builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
    // Propaga el tenant actual a la sesión de Postgres para Row Level Security
    // (ver migración EnableRowLevelSecurity) — resuelto vía sp porque el
    // interceptor necesita ICurrentTenant, scoped por request.
    options.AddInterceptors(sp.GetRequiredService<TenantSessionInterceptor>());
});

builder.Services.AddJwtAuthentication(builder.Configuration, builder.Environment);

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// Servicios
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddScoped<TimeSlotGeneratorService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<PlatformAuthService>();
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
    builder.Services.AddHttpClient<TelegramProvider>();
    // EmailProvider (API HTTP, Resend por default) en vez de GmailProvider (SMTP):
    // Google bloquea/throttlea SMTP saliente desde IPs de datacenter como las de
    // Render, así que GmailProvider timeoutea siempre en producción — ver EmailProvider.cs.
    builder.Services.AddHttpClient<EmailProvider>(client => client.Timeout = TimeSpan.FromSeconds(15));
    builder.Services.AddScoped<INotificationProvider, EmailProvider>();
    builder.Services.AddScoped<INotificationProvider, WhatsAppProvider>();
    builder.Services.AddScoped<INotificationProvider, TelegramProvider>();
}
builder.Services.AddHostedService<NotificationRetryBackgroundService>();
builder.Services.AddHostedService<ReminderBackgroundService>();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddScoped<CustomerProfileService>();
builder.Services.AddScoped<HangfireReminderJob>();
builder.Services.AddScoped<AutomationRuleEvaluationJob>();
builder.Services.AddScoped<BookingNotificationJob>();
builder.Services.AddScoped<RouletteService>();
builder.Services.AddScoped<LoyaltyRouletteService>();
builder.Services.AddHttpClient<CloudinaryAdminService>();
builder.Services.AddScoped<ContentTakedownService>();

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

    // Ruleta de captación de leads (docs/RULETA.pdf): endpoint público sin
    // login, blanco fácil de scripts que giren en loop para juntar códigos.
    options.AddPolicy("roulette", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
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

    // Smart Link (/api/smart/{token}): público, sin login. Más permisivo que
    // "roulette" porque taps NFC legítimos repetidos desde la misma
    // ubicación/NAT son esperables, pero acotado para frenar scraping/
    // generación masiva de eventos (docs/NFC.md sección 11).
    options.AddPolicy("smart-tag", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Lecturas públicas y anónimas sin dato sensible (horarios disponibles,
    // config del sitio, galería, catálogo de premios de la ruleta): sin
    // límite hoy, blanco de scraping/DoS barato. Más generoso que
    // "public-booking" porque un visitante real puede disparar varias de
    // estas por segundo solo navegando la página (cambiar de profesional,
    // scrollear la galería).
    options.AddPolicy("public-read", httpContext =>
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

// Headers de seguridad básicos — la API solo devuelve JSON (sin CSP acá, no
// hay HTML que restringir), pero estos evitan que un navegador la trate
// como algo distinta a lo que declara o la deje embeber en un iframe ajeno.
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    await next();
});

// ✅ PRODUCCIÓN: Aplicar migraciones automáticamente
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.Migrate();

    await SaaSCatalogSeeder.SeedAsync(context);
}

// ✅ PRODUCCIÓN: Configuración del pipeline
// Explícito (antes era implícito): TenantResolutionMiddleware ahora necesita
// context.GetEndpoint() resuelto para leer [TenantContextBypass] — sin
// UseRouting() acá no hay garantía de que el endpoint ya esté matcheado.
app.UseRouting();
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
