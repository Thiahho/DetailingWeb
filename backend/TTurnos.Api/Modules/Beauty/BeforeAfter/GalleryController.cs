using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TTurnos.Api.Modules.Beauty.BeforeAfter;

[ApiController]
[Route("api/gallery")]
public class GalleryController : ControllerBase
{
    private readonly IGalleryRepository _repository;

    public GalleryController(IGalleryRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetActive()
    {
        var items = await _repository.GetActiveAsync();
        return Ok(items.Select(g => new { g.Id, g.Title, g.Tag, g.ImageUrl, g.Order }));
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _repository.GetAllAsync();
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _repository.FindAsync(id);
        if (item == null) return NotFound();
        _repository.Remove(item);
        await _repository.SaveChangesAsync();
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
