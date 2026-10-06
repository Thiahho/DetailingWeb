using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Infrastructure.Security;

namespace Turneo.Api.Tests.Integration;

// Clave de partición del rate limiting (ver ClientIpResolver). No levanta el
// host: alcanza con un HttpContext armado a mano.
public class ClientIpResolverTests
{
    private const string Secret = "test-proxy-secret";
    private const string RemoteIp = "10.0.0.7";

    private static HttpContext CreateContext(string? configuredSecret, string? secretHeader, string? clientIpHeader, bool withRemoteIp = true)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Proxy:SharedSecret"] = configuredSecret })
            .Build();

        var context = new DefaultHttpContext
        {
            RequestServices = new ServiceCollection().AddSingleton<IConfiguration>(configuration).BuildServiceProvider()
        };
        if (withRemoteIp)
            context.Connection.RemoteIpAddress = IPAddress.Parse(RemoteIp);
        if (secretHeader != null)
            context.Request.Headers["X-Proxy-Secret"] = secretHeader;
        if (clientIpHeader != null)
            context.Request.Headers["X-Client-IP"] = clientIpHeader;
        return context;
    }

    [Fact]
    public void GetClientIp_ValidSecretAndValidIp_ReturnsClientIp()
    {
        var context = CreateContext(Secret, Secret, "203.0.113.9");

        Assert.Equal("203.0.113.9", ClientIpResolver.GetClientIp(context));
    }

    [Fact]
    public void GetClientIp_WithoutSecret_ReturnsRemoteIp()
    {
        var context = CreateContext(null, null, "203.0.113.9");

        Assert.Equal(RemoteIp, ClientIpResolver.GetClientIp(context));
    }

    [Fact]
    public void GetClientIp_WithoutAnyIp_ReturnsNull()
    {
        var context = CreateContext(null, null, null, withRemoteIp: false);

        Assert.Null(ClientIpResolver.GetClientIp(context));
    }

    [Fact]
    public void ValidSecretAndValidIp_ReturnsClientIp()
    {
        var context = CreateContext(Secret, Secret, " 203.0.113.9 ");

        Assert.Equal("203.0.113.9", ClientIpResolver.GetPartitionKey(context));
    }

    [Fact]
    public void ValidSecretAndIpv6_ReturnsNormalizedClientIp()
    {
        var context = CreateContext(Secret, Secret, "2001:DB8:0:0:0:0:0:1");

        Assert.Equal("2001:db8::1", ClientIpResolver.GetPartitionKey(context));
    }

    [Fact]
    public void WrongSecret_ReturnsRemoteIp()
    {
        var context = CreateContext(Secret, "otro-secreto", "203.0.113.9");

        Assert.Equal(RemoteIp, ClientIpResolver.GetPartitionKey(context));
    }

    [Fact]
    public void MissingSecretHeader_ReturnsRemoteIp()
    {
        var context = CreateContext(Secret, null, "203.0.113.9");

        Assert.Equal(RemoteIp, ClientIpResolver.GetPartitionKey(context));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void SecretNotConfigured_ReturnsRemoteIp(string? configuredSecret)
    {
        // Sin secreto del lado de la API, ni un header vacío "coincide".
        var context = CreateContext(configuredSecret, "", "203.0.113.9");

        Assert.Equal(RemoteIp, ClientIpResolver.GetPartitionKey(context));
    }

    [Theory]
    [InlineData("no-es-una-ip")]
    [InlineData("")]
    public void ValidSecretAndGarbageIp_ReturnsRemoteIp(string clientIp)
    {
        var context = CreateContext(Secret, Secret, clientIp);

        Assert.Equal(RemoteIp, ClientIpResolver.GetPartitionKey(context));
    }

    [Fact]
    public void NoRemoteIpAndNoTrustedHeader_ReturnsUnknown()
    {
        var context = CreateContext(null, null, null, withRemoteIp: false);

        Assert.Equal("unknown", ClientIpResolver.GetPartitionKey(context));
    }
}
