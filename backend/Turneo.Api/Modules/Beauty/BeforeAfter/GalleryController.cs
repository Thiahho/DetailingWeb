using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Modules.Beauty.BeforeAfter;

[ApiController]
[Route("api/gallery")]
public class GalleryController : ControllerBase
{
    private readonly IGalleryRepository _repository;
    private readonly CloudinaryAdminService _cloudinary;
    private readonly ILogger<GalleryController> _logger;

    public GalleryController(IGalleryRepository repository, CloudinaryAdminService cloudinary, ILogger<GalleryController> logger)
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
        var items = await _repository.GetActiveAsync();
        return Ok(items.Select(g => new { g.Id, g.Title, g.Tag, g.ImageUrl, g.Order }));
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Galeria, PermissionActions.View)]
    public async Task<IActionResult> GetAll()
    {
        var items = await _repository.GetAllAsync();
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Galeria, PermissionActions.Create)]
    public async Task<IActionResult> Create([FromBody] GalleryItemRequest request)
    {
        var item = new GalleryItem
        {
            Title = request.Title,
            Tag = request.Tag,
            ImageUrl = request.ImageUrl,
            IsActive = request.IsActive,
            Order = request.Order,
            CreatedAt = DateTime.UtcNow
        };
        _repository.Add(item);
        await _repository.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Galeria, PermissionActions.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] GalleryItemRequest request)
    {
        var item = await _repository.FindAsync(id);
        if (item == null) return NotFound();

        item.Title = request.Title;
        item.Tag = request.Tag;
        item.ImageUrl = request.ImageUrl;
        item.IsActive = request.IsActive;
        item.Order = request.Order;

        await _repository.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Galeria, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _repository.FindAsync(id);
        if (item == null) return NotFound();
        _repository.Remove(item);
        await _repository.SaveChangesAsync();

        // Best-effort: si Cloudinary falla no revertimos el borrado del
        // registro, pero lo logueamos para poder intervenir a mano (ver
        // también /platform/takedown, que reintenta por URL).
        var (deleted, error) = await _cloudinary.TryDestroyAsync(item.ImageUrl);
        if (!deleted)
            _logger.LogWarning("[Gallery] No se pudo borrar {ImageUrl} de Cloudinary tras eliminar item {Id}: {Error}", item.ImageUrl, id, error);

        return NoContent();
    }
}

public record GalleryItemRequest(
    string Title,
    string Tag,
    string ImageUrl,
    bool IsActive,
    int Order
);
