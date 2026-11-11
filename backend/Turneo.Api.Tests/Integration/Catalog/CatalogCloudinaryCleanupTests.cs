using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Turneo.Api.Infrastructure.Integrations;

namespace Turneo.Api.Tests.Integration.Catalog;

// Deleting a product or one of its files also asks Cloudinary to destroy the
// stored files. Cloudinary is never reached: a separate host (same database)
// gets Cloudinary credentials and a recording handler under CloudinaryAdminService.
[Collection("Integration")]
public class CatalogCloudinaryCleanupTests
{
    private const string ImageUrl = "https://res.cloudinary.com/demo/image/upload/v1712/Turneo/catalogo/remera.jpg";
    private const string VideoUrl = "https://res.cloudinary.com/demo/video/upload/v1712/Turneo/catalogo/clip.mp4";

    private readonly CustomWebApplicationFactory _factory;

    public CatalogCloudinaryCleanupTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task DeleteMedia_DestroysItsCloudinaryFile()
    {
        var cloudinary = new RecordingCloudinaryHandler();
        var (client, productId) = await NewProductAsync(cloudinary);
        var imageId = await AddMediaAsync(client, productId, ImageUrl, type: 0);
        await AddMediaAsync(client, productId, VideoUrl, type: 1);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/media/{imageId}")).StatusCode);

        var call = Assert.Single(cloudinary.Calls);
        Assert.Equal("https://api.cloudinary.com/v1_1/demo/image/destroy", call.Endpoint);
        Assert.Equal("Turneo/catalogo/remera", call.PublicId);
    }

    [Fact]
    public async Task DeleteProduct_DestroysEveryFileOfTheProduct()
    {
        var cloudinary = new RecordingCloudinaryHandler();
        var (client, productId) = await NewProductAsync(cloudinary);
        await AddMediaAsync(client, productId, ImageUrl, type: 0);
        await AddMediaAsync(client, productId, VideoUrl, type: 1);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/products/{productId}")).StatusCode);

        Assert.Equal(
            new[]
            {
                ("https://api.cloudinary.com/v1_1/demo/image/destroy", "Turneo/catalogo/remera"),
                ("https://api.cloudinary.com/v1_1/demo/video/destroy", "Turneo/catalogo/clip"),
            },
            cloudinary.Calls.OrderBy(c => c.Endpoint).Select(c => (c.Endpoint, c.PublicId)));
    }

    [Fact]
    public async Task CloudinaryFailure_DoesNotFailTheDelete()
    {
        var cloudinary = new RecordingCloudinaryHandler { Status = HttpStatusCode.InternalServerError };
        var (client, productId) = await NewProductAsync(cloudinary);
        var imageId = await AddMediaAsync(client, productId, ImageUrl, type: 0);
        await AddMediaAsync(client, productId, VideoUrl, type: 1);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/media/{imageId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/catalog/products/{productId}")).StatusCode);

        Assert.Equal(2, cloudinary.Calls.Count);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/catalog/products/{productId}")).StatusCode);
        Assert.Equal(0, await CountMediaAsync(productId));
    }

    [Fact]
    public async Task AnotherTenant_CannotDeleteNorDestroyTheFiles()
    {
        var cloudinary = new RecordingCloudinaryHandler();
        var (client, productId) = await NewProductAsync(cloudinary);
        var imageId = await AddMediaAsync(client, productId, ImageUrl, type: 0);

        var (otherAdmin, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var intruder = HostWith(cloudinary).CreateClient();
        intruder.DefaultRequestHeaders.Authorization = otherAdmin.DefaultRequestHeaders.Authorization;

        Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync($"/api/catalog/media/{imageId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync($"/api/catalog/products/{productId}")).StatusCode);

        Assert.Empty(cloudinary.Calls);
        Assert.Equal(1, await CountMediaAsync(productId));
    }

    // The derived host is left for the factory to dispose (see CustomWebApplicationFactory.WithConfigOverrides).
    private WebApplicationFactory<Program> HostWith(RecordingCloudinaryHandler cloudinary) =>
        _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cloudinary:CloudName"] = "demo",
                ["Cloudinary:ApiKey"] = "test-key",
                ["Cloudinary:ApiSecret"] = "test-secret",
            }));
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<CloudinaryAdminService>().ConfigurePrimaryHttpMessageHandler(() => cloudinary));
        });

    private async Task<(HttpClient Client, int ProductId)> NewProductAsync(RecordingCloudinaryHandler cloudinary)
    {
        var (admin, _) = await CatalogApi.NewTenantAdminAsync(_factory);
        var client = HostWith(cloudinary).CreateClient();
        client.DefaultRequestHeaders.Authorization = admin.DefaultRequestHeaders.Authorization;

        var categoryId = await CatalogApi.CreateCategoryAsync(client, "Remeras");
        var product = await CatalogApi.CreateProductAsync(client, categoryId, "Remera", Array.Empty<int>());
        return (client, product.GetProperty("id").GetInt32());
    }

    private static async Task<int> AddMediaAsync(HttpClient client, int productId, string url, int type)
    {
        var response = await client.PostAsJsonAsync($"/api/catalog/products/{productId}/media", new { url, type });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await CatalogApi.ReadAsync(response)).GetProperty("id").GetInt32();
    }

    private async Task<int> CountMediaAsync(int productId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.CatalogMedia.IgnoreQueryFilters().CountAsync(m => m.ProductId == productId);
    }

    private sealed class RecordingCloudinaryHandler : HttpMessageHandler
    {
        public ConcurrentQueue<(string Endpoint, string PublicId)> Calls { get; } = new();
        public HttpStatusCode Status { get; init; } = HttpStatusCode.OK;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var form = await request.Content!.ReadAsStringAsync(cancellationToken);
            var publicId = form.Split('&')
                .Select(pair => pair.Split('=', 2))
                .Where(pair => pair[0] == "public_id")
                .Select(pair => Uri.UnescapeDataString(pair[1]))
                .Single();
            Calls.Enqueue((request.RequestUri!.ToString(), publicId));

            return new HttpResponseMessage(Status) { Content = new StringContent("{\"result\":\"ok\"}") };
        }
    }
}
