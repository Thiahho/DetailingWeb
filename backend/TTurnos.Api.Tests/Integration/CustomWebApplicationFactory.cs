using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;

namespace TTurnos.Api.Tests.Integration;

// Un Postgres real en Docker (Testcontainers) por corrida de test suite —
// deliberado en vez de EF InMemory: acá se valida contra el motor real de
// columnas jsonb, migraciones EF reales y los query filters globales de
// multi-tenancy, que es exactamente lo que InMemory no reproduce fielmente.
public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("tturnos_test")
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
            });
        });

        builder.ConfigureTestServices(services =>
        {
            // Nunca pegarle a Gmail/WhatsApp reales desde un test.
            services.RemoveAll<INotificationProvider>();
            services.AddSingleton<INotificationProvider, FakeNotificationProvider>();

            // Sin hosted services en tests (recordatorios, reintentos, Hangfire
            // server): los controllers se ejercitan directo vía HTTP, y un
            // background job corriendo en paralelo solo agrega flakiness.
            services.RemoveAll<IHostedService>();
        });
    }

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
