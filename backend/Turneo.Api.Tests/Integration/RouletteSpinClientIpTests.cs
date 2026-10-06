using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Marketing.Roulette;

namespace Turneo.Api.Tests.Integration;

// POST /api/marketing/roulette/spin guarda en el lead la IP del visitante. El
// navegador llega por el proxy de Next.js, así que la IP real viaja en
// X-Client-IP y solo se le cree si X-Proxy-Secret coincide con
// Proxy:SharedSecret (ver ClientIpResolver). En TestServer no hay
// RemoteIpAddress: cuando el header no es de confianza, el lead queda sin IP.
[Collection("Integration")]
public class RouletteSpinClientIpTests
{
    private const string Secret = "test-proxy-secret";

    private readonly CustomWebApplicationFactory _factory;

    public RouletteSpinClientIpTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private WebApplicationFactory<Program> CreateHostWithProxySecret() =>
        _factory.WithConfigOverrides(new Dictionary<string, string?> { ["Proxy:SharedSecret"] = Secret });

    private async Task EnsureActivePrizeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (await db.RoulettePrizes.AnyAsync(p => p.IsActive)) return;

        db.RoulettePrizes.Add(new RoulettePrize
        {
            Name = "Premio de test",
            CodeSlug = "TEST",
            Probability = 1m
        });
        await db.SaveChangesAsync();
    }

    private async Task<string?> SpinAndGetStoredIpAsync(HttpClient client, string? clientIp, string? proxySecret)
    {
        await EnsureActivePrizeAsync();

        // Un WhatsApp = una participación: uno distinto por test para que siempre cree el lead.
        var whatsApp = "54911" + Random.Shared.NextInt64(10_000_000, 99_999_999);
        using var message = new HttpRequestMessage(HttpMethod.Post, "/api/marketing/roulette/spin")
        {
            Content = JsonContent.Create(new { nombreNegocio = "Negocio de test", whatsApp })
        };
        if (clientIp != null) message.Headers.Add("X-Client-IP", clientIp);
        if (proxySecret != null) message.Headers.Add("X-Proxy-Secret", proxySecret);

        var response = await client.SendAsync(message);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var lead = await db.RouletteLeads.SingleAsync(l => l.WhatsApp == whatsApp);
        return lead.IpAddress;
    }

    [Fact]
    public async Task Spin_WithValidProxySecret_StoresVisitorIp()
    {
        var client = CreateHostWithProxySecret().CreateClient();

        var storedIp = await SpinAndGetStoredIpAsync(client, "203.0.113.50", Secret);

        Assert.Equal("203.0.113.50", storedIp);
    }

    [Fact]
    public async Task Spin_WithWrongProxySecret_DoesNotStoreSpoofedIp()
    {
        var client = CreateHostWithProxySecret().CreateClient();

        var storedIp = await SpinAndGetStoredIpAsync(client, "203.0.113.51", "otro-secreto");

        Assert.Null(storedIp);
    }

    [Fact]
    public async Task Spin_WithoutConfiguredSecret_IgnoresClientIpHeader()
    {
        var client = _factory.CreateClient();

        var storedIp = await SpinAndGetStoredIpAsync(client, "203.0.113.52", Secret);

        Assert.Null(storedIp);
    }
}
