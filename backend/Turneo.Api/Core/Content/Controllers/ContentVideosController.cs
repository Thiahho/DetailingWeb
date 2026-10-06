using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Core.Content;

[ApiController]
[Route("api/content-videos")]
public class ContentVideosController : ControllerBase
{
    private readonly IContentVideosRepository _repository;
    private readonly CloudinaryAdminService _cloudinary;
    private readonly ILogger<ContentVideosController> _logger;

    public ContentVideosController(IContentVideosRepository repository, CloudinaryAdminService cloudinary, ILogger<ContentVideosController> logger)
    {
        _repository = repository;
        _cloudinary = cloudinary;
        _logger = logger;
    }

    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetActive()
    {
        var videos = await _repository.GetActiveAsync();

        return Ok(videos.Select(v => new
        {
            v.Id,
            v.Title,
            v.VideoUrl,
            v.ThumbnailUrl,
            v.LinkUrl,
            v.IsActive,
            v.Order,
            v.CreatedAt
        }));
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetAll()
    {
        var videos = await _repository.GetAllAsync();

        return Ok(videos.Select(v => new
        {
            v.Id,
            v.Title,
            v.VideoUrl,
            v.ThumbnailUrl,
            v.LinkUrl,
            v.IsActive,
            v.Order,
            v.CreatedAt
        }));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> Create([FromBody] ContentVideoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(new { message = "Título y URL del video son requeridos" });

        if (!TryNormalizeLinkUrl(request.LinkUrl, out var linkUrl))
            return BadRequest(new { message = InvalidLinkMessage });

        var video = new ContentVideo
        {
            Title = request.Title,
            VideoUrl = request.VideoUrl,
            ThumbnailUrl = request.ThumbnailUrl,
            LinkUrl = linkUrl,
            IsActive = request.IsActive,
            Order = request.Order,
        };

        _repository.Add(video);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Video creado correctamente", id = video.Id });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> Update(int id, [FromBody] ContentVideoRequest request)
    {
        var video = await _repository.FindAsync(id);
        if (video == null)
            return NotFound(new { message = "Video no encontrado" });

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(new { message = "Título y URL del video son requeridos" });

        if (!TryNormalizeLinkUrl(request.LinkUrl, out var linkUrl))
            return BadRequest(new { message = InvalidLinkMessage });

        video.Title = request.Title;
        video.VideoUrl = request.VideoUrl;
        video.ThumbnailUrl = request.ThumbnailUrl;
        video.LinkUrl = linkUrl;
        video.IsActive = request.IsActive;
        video.Order = request.Order;

        await _repository.SaveChangesAsync();

        return Ok(new { message = "Video actualizado correctamente" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Staff,Professional")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> Delete(int id)
    {
        var video = await _repository.FindAsync(id);
        if (video == null)
            return NotFound(new { message = "Video no encontrado" });

        _repository.Remove(video);
        await _repository.SaveChangesAsync();

        var (videoDeleted, videoError) = await _cloudinary.TryDestroyAsync(video.VideoUrl);
        if (!videoDeleted)
            _logger.LogWarning("[ContentVideos] No se pudo borrar {VideoUrl} de Cloudinary tras eliminar video {Id}: {Error}", video.VideoUrl, id, videoError);

        if (!string.IsNullOrWhiteSpace(video.ThumbnailUrl))
        {
            var (thumbDeleted, thumbError) = await _cloudinary.TryDestroyAsync(video.ThumbnailUrl);
            if (!thumbDeleted)
                _logger.LogWarning("[ContentVideos] No se pudo borrar la miniatura {ThumbnailUrl} de Cloudinary tras eliminar video {Id}: {Error}", video.ThumbnailUrl, id, thumbError);
        }

        return Ok(new { message = "Video eliminado correctamente" });
    }

    private const string InvalidLinkMessage = "El link debe ser de un posteo de Instagram o TikTok (https)";

    private static readonly HashSet<string> AllowedLinkHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "instagram.com", "www.instagram.com",
        "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"
    };

    // El link termina en un <a href> del sitio público: solo https y solo las
    // redes soportadas. Vacío es válido (contenido sin link) y se guarda como null.
    private static bool TryNormalizeLinkUrl(string? raw, out string? linkUrl)
    {
        linkUrl = null;
        var trimmed = raw?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return true;

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || !AllowedLinkHosts.Contains(uri.Host))
            return false;

        linkUrl = trimmed;
        return true;
    }
}

public class ContentVideoRequest
{
    public string Title { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string? LinkUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
}
