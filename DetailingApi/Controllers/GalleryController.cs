using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DetailingApi.Data;
using DetailingApi.Models;

namespace DetailingApi.Controllers;

[ApiController]
[Route("api/gallery")]
public class GalleryController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public GalleryController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetActive()
    {
        var items = await _context.GalleryItems
            .Where(g => g.IsActive)
            .OrderBy(g => g.Order)
            .ThenBy(g => g.CreatedAt)
            .Select(g => new { g.Id, g.Title, g.Tag, g.ImageUrl, g.Order })
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _context.GalleryItems
            .OrderBy(g => g.Order)
            .ThenBy(g => g.CreatedAt)
            .ToListAsync();
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
        _context.GalleryItems.Add(item);
        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] GalleryItemRequest request)
    {
        var item = await _context.GalleryItems.FindAsync(id);
        if (item == null) return NotFound();

        item.Title = request.Title;
        item.Tag = request.Tag;
        item.ImageUrl = request.ImageUrl;
        item.IsActive = request.IsActive;
        item.Order = request.Order;

        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.GalleryItems.FindAsync(id);
        if (item == null) return NotFound();
        _context.GalleryItems.Remove(item);
        await _context.SaveChangesAsync();
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
