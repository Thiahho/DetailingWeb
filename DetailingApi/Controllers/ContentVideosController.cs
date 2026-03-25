using DetailingApi.Data;
using DetailingApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/content-videos")]
public class ContentVideosController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ContentVideosController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetActive()
    {
        var videos = await _context.ContentVideos
            .Where(v => v.IsActive)
            .OrderBy(v => v.Order)
            .ThenBy(v => v.CreatedAt)
            .Select(v => new
            {
                v.Id,
                v.Title,
                v.VideoUrl,
                v.ThumbnailUrl,
                v.IsActive,
                v.Order,
                v.CreatedAt
            })
            .ToListAsync();

        return Ok(videos);
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var videos = await _context.ContentVideos
            .OrderBy(v => v.Order)
            .ThenBy(v => v.CreatedAt)
            .Select(v => new
            {
                v.Id,
                v.Title,
                v.VideoUrl,
                v.ThumbnailUrl,
                v.IsActive,
                v.Order,
                v.CreatedAt
            })
            .ToListAsync();

        return Ok(videos);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
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

        _context.ContentVideos.Add(video);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Video creado correctamente", id = video.Id });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] ContentVideoRequest request)
    {
        var video = await _context.ContentVideos.FindAsync(id);
        if (video == null)
            return NotFound(new { message = "Video no encontrado" });

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(new { message = "Título y URL del video son requeridos" });

        video.Title = request.Title;
        video.VideoUrl = request.VideoUrl;
        video.ThumbnailUrl = request.ThumbnailUrl;
        video.IsActive = request.IsActive;
        video.Order = request.Order;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Video actualizado correctamente" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var video = await _context.ContentVideos.FindAsync(id);
        if (video == null)
            return NotFound(new { message = "Video no encontrado" });

        _context.ContentVideos.Remove(video);
        await _context.SaveChangesAsync();

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
