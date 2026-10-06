using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;

namespace Turneo.Api.Tests.Integration;

// Un Postgres real en Docker (Testcontainers) por corrida de test suite —
// deliberado en vez de EF InMemory: acá se valida contra el motor real de
// columnas jsonb, migraciones EF reales y los query filters globales de
// multi-tenancy, que es exactamente lo que InMemory no reproduce fielmente.
public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("Turneo_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, configBuilder) =>
        {
            configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _dbContainer.GetConnectionString(),
                // Apagado por defecto en appsettings.json (piloto sin señas online,
                // ver PaymentsController) — prendido acá para poder seguir probando
                // el comportamiento real del controller.
                ["Payments:Enabled"] = "true",
                // POST /api/auth/register solo admite anónimos con este flag (apagado
                // por defecto, nunca en producción). Prendido acá igual que en
                // appsettings.Testing.json; RegisterLockTests lo apaga en un host aparte.
                ["Auth:AllowOpenRegistration"] = "true",
            });
        });

        builder.ConfigureTestServices(services =>
        {
            // Nunca pegarle a Gmail/WhatsApp reales desde un test.
            services.RemoveAll<INotificationProvider>();
            services.AddSingleton<INotificationProvider, FakeNotificationProvider>();

            // Ni a Google para validar ID tokens.
            services.RemoveAll<IGoogleTokenValidator>();
            services.AddSingleton<IGoogleTokenValidator, FakeGoogleTokenValidator>();

            // Sin hosted services en tests (recordatorios, reintentos, Hangfire
            // server): los controllers se ejercitan directo vía HTTP, y un
            // background job corriendo en paralelo solo agrega flakiness.
            services.RemoveAll<IHostedService>();
        });
    }

    // Host aparte contra la misma base del contenedor, con claves de config
    // pisadas (null = "no configurada"): para probar comportamiento que depende
    // de configuración sin tocar el host compartido por el resto de la suite.
    // No disponer el host devuelto desde el test: Hangfire guarda su storage en un
    // estático global (JobStorage.Current) que pasa a ser el del último host
    // levantado, y disponerlo deja sin storage a BackgroundJob.Enqueue en el resto
    // de la suite (los POST de reservas responden 500). Esta factory los dispone
    // todos juntos al final.
    public WebApplicationFactory<Program> WithConfigOverrides(Dictionary<string, string?> overrides) =>
        WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configBuilder) =>
            configBuilder.AddInMemoryCollection(overrides)));

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
    }

    public new async Task DisposeAsync()
    {
        await _dbContainer.StopAsync();
        await base.DisposeAsync();
    }
}
