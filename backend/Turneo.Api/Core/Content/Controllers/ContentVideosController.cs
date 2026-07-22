using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Content;

[ApiController]
[Route("api/content-videos")]
public class ContentVideosController : ControllerBase
{
    private readonly IContentVideosRepository _repository;

    public ContentVideosController(IContentVideosRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<IActionResult> GetActive()
    {
        var videos = await _repository.GetActiveAsync();

        return Ok(videos.Select(v => new
        {
            v.Id,
            v.Title,
            v.VideoUrl,
            v.ThumbnailUrl,
            v.IsActive,
            v.Order,
            v.CreatedAt
        }));
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.View)]
    public async Task<IActionResult> GetAll()
    {
        var videos = await _repository.GetAllAsync();

        return Ok(videos.Select(v => new
        {
            v.Id,
            v.Title,
            v.VideoUrl,
            v.ThumbnailUrl,
            v.IsActive,
            v.Order,
            v.CreatedAt
        }));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.Create)]
    public async Task<IActionResult> Create([FromBody] ContentVideoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(new { message = "Título y URL del video son requeridos" });

        var video = new ContentVideo
        {
            Title = request.Title,
            VideoUrl = request.VideoUrl,
            ThumbnailUrl = request.ThumbnailUrl,
            IsActive = request.IsActive,
            Order = request.Order,
        };

        _repository.Add(video);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Video creado correctamente", id = video.Id });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] ContentVideoRequest request)
    {
        var video = await _repository.FindAsync(id);
        if (video == null)
            return NotFound(new { message = "Video no encontrado" });

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(new { message = "Título y URL del video son requeridos" });

        video.Title = request.Title;
        video.VideoUrl = request.VideoUrl;
        video.ThumbnailUrl = request.ThumbnailUrl;
        video.IsActive = request.IsActive;
        video.Order = request.Order;

        await _repository.SaveChangesAsync();

        return Ok(new { message = "Video actualizado correctamente" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Contenido, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var video = await _repository.FindAsync(id);
        if (video == null)
            return NotFound(new { message = "Video no encontrado" });

        _repository.Remove(video);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Video eliminado correctamente" });
    }
}

public class ContentVideoRequest
{
    public string Title { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
}
