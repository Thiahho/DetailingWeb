using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Turneo.Api.Infrastructure.Integrations;

namespace Turneo.Api.Core.Platform;

public class ContentTakedownResult
{
    public List<string> ReferencesRemoved { get; set; } = new();
    public bool CloudinaryDeleted { get; set; }
    public string? CloudinaryError { get; set; }
}

// Herramienta del panel de plataforma para responder a un reclamo de
// copyright: recibe la URL de Cloudinary reportada, saca cualquier
// referencia a ella en CUALQUIER tenant (por eso IgnoreQueryFilters en todo
// este archivo — Thiago no opera dentro del contexto de un tenant) y borra
// el archivo real en Cloudinary. Ver /derechos-de-autor para el proceso
// público de denuncia que alimenta este endpoint.
public class ContentTakedownService
{
    private readonly ApplicationDbContext _context;
    private readonly CloudinaryAdminService _cloudinary;

    public ContentTakedownService(ApplicationDbContext context, CloudinaryAdminService cloudinary)
    {
        _context = context;
        _cloudinary = cloudinary;
    }

    public async Task<ContentTakedownResult> TakeDownAsync(string url)
    {
        var result = new ContentTakedownResult();

        var galleryItems = await _context.GalleryItems.IgnoreQueryFilters()
            .Where(g => g.ImageUrl == url).ToListAsync();
        if (galleryItems.Count > 0)
        {
            _context.GalleryItems.RemoveRange(galleryItems);
            result.ReferencesRemoved.Add($"Galería: {galleryItems.Count} publicación(es) eliminada(s)");
        }

        var videos = await _context.ContentVideos.IgnoreQueryFilters()
            .Where(v => v.VideoUrl == url || v.ThumbnailUrl == url).ToListAsync();
        var videosRemoved = 0;
        var thumbnailsCleared = 0;
        foreach (var video in videos)
        {
            if (video.VideoUrl == url)
            {
                _context.ContentVideos.Remove(video);
                videosRemoved++;
            }
            else
            {
                video.ThumbnailUrl = string.Empty;
                thumbnailsCleared++;
            }
        }
        if (videosRemoved > 0) result.ReferencesRemoved.Add($"Contenido: {videosRemoved} video(s) eliminado(s)");
        if (thumbnailsCleared > 0) result.ReferencesRemoved.Add($"Contenido: {thumbnailsCleared} miniatura(s) removida(s)");

        var services = await _context.Services.IgnoreQueryFilters()
            .Where(s => s.ImageUrl == url).ToListAsync();
        foreach (var service in services) service.ImageUrl = string.Empty;
        if (services.Count > 0) result.ReferencesRemoved.Add($"Servicios: imagen removida de {services.Count}");

        var professionals = await _context.Professionals.IgnoreQueryFilters()
            .Where(p => p.PhotoUrl == url).ToListAsync();
        foreach (var professional in professionals) professional.PhotoUrl = string.Empty;
        if (professionals.Count > 0) result.ReferencesRemoved.Add($"Profesionales: foto removida de {professionals.Count}");

        var siteConfigs = await _context.SiteConfigs.IgnoreQueryFilters()
            .Where(s => s.LogoUrl == url).ToListAsync();
        foreach (var config in siteConfigs) config.LogoUrl = string.Empty;
        if (siteConfigs.Count > 0) result.ReferencesRemoved.Add($"Logo removido de {siteConfigs.Count} negocio(s)");

        var customers = await _context.CustomerProfiles.IgnoreQueryFilters()
            .Where(c => c.PhotoUrls != null && c.PhotoUrls.Contains(url)).ToListAsync();
        var customersUpdated = 0;
        foreach (var customer in customers)
        {
            var urls = ParsePhotoUrls(customer.PhotoUrls).Where(u => u != url).ToList();
            var newValue = urls.Count > 0 ? JsonSerializer.Serialize(urls) : null;
            if (newValue == customer.PhotoUrls) continue;
            customer.PhotoUrls = newValue;
            customersUpdated++;
        }
        if (customersUpdated > 0) result.ReferencesRemoved.Add($"Fichas de clientes: foto removida de {customersUpdated}");

        var bookings = await _context.Bookings.IgnoreQueryFilters()
            .Where(b => (b.PhotoUrlsBefore != null && b.PhotoUrlsBefore.Contains(url))
                     || (b.PhotoUrlsAfter != null && b.PhotoUrlsAfter.Contains(url)))
            .ToListAsync();
        var bookingsUpdated = 0;
        foreach (var booking in bookings)
        {
            var before = ParsePhotoUrls(booking.PhotoUrlsBefore).Where(u => u != url).ToList();
            var after = ParsePhotoUrls(booking.PhotoUrlsAfter).Where(u => u != url).ToList();
            var newBefore = before.Count > 0 ? JsonSerializer.Serialize(before) : null;
            var newAfter = after.Count > 0 ? JsonSerializer.Serialize(after) : null;
            if (newBefore == booking.PhotoUrlsBefore && newAfter == booking.PhotoUrlsAfter) continue;
            booking.PhotoUrlsBefore = newBefore;
            booking.PhotoUrlsAfter = newAfter;
            bookingsUpdated++;
        }
        if (bookingsUpdated > 0) result.ReferencesRemoved.Add($"Historial de turnos: foto removida de {bookingsUpdated}");

        await _context.SaveChangesAsync();

        var (deleted, error) = await _cloudinary.TryDestroyAsync(url);
        result.CloudinaryDeleted = deleted;
        result.CloudinaryError = error;

        return result;
    }

    private static List<string> ParsePhotoUrls(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<string>();
        try { return JsonSerializer.Deserialize<List<string>>(raw) ?? new(); }
        catch { return new(); }
    }
}
