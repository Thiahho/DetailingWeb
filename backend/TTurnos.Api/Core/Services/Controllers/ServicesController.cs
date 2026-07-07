using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Core.Services;

[ApiController]
[Route("api/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ServicesController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/services  (público)
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var services = await _context.Services
            .Where(s => s.IsActive)
            .OrderBy(s => s.Order)
            .ThenBy(s => s.CreatedAt)
            .Select(s => new
            {
                s.Id,
                s.Title,
                s.Slug,
                s.Price,
                s.Duration,
                s.ImageUrl,
                s.Details,
                s.Description,
                s.CustomFieldsSchema,
                s.IsActive,
                s.Order
            })
            .ToListAsync();

        return Ok(services);
    }

    // GET: api/services/all  (admin, incluye inactivos)
    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllAdmin()
    {
        var services = await _context.Services
            .OrderBy(s => s.Order)
            .ThenBy(s => s.CreatedAt)
            .Select(s => new
            {
                s.Id,
                s.Title,
                s.Slug,
                s.Price,
                s.Duration,
                s.ImageUrl,
                s.Details,
                s.Description,
                s.CustomFieldsSchema,
                s.IsActive,
                s.Order,
                s.CreatedAt,
                s.UpdatedAt
            })
            .ToListAsync();

        return Ok(services);
    }

    // GET: api/services/{slug}  (público)
    [HttpGet("{slug}")]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var service = await _context.Services
            .Where(s => s.Slug == slug && s.IsActive)
            .FirstOrDefaultAsync();

        if (service == null)
            return NotFound(new { message = "Servicio no encontrado" });

        return Ok(new
        {
            service.Id,
            service.Title,
            service.Slug,
            service.Price,
            service.Duration,
            service.ImageUrl,
            service.Details,
            service.Description,
            service.CustomFieldsSchema,
            service.IsActive,
            service.Order
        });
    }

    // POST: api/services  (admin)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] ServiceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Slug))
            return BadRequest(new { message = "Título y slug son requeridos" });

        var slugExists = await _context.Services.AnyAsync(s => s.Slug == request.Slug);
        if (slugExists)
            return BadRequest(new { message = "Ya existe un servicio con ese slug" });

        var service = new Service
        {
            Title = request.Title,
            Slug = request.Slug,
            Price = request.Price,
            Duration = request.Duration,
            ImageUrl = request.ImageUrl,
            Details = request.Details,
            Description = request.Description,
            CustomFieldsSchema = request.CustomFieldsSchema,
            IsActive = request.IsActive,
            Order = request.Order
        };

        _context.Services.Add(service);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBySlug), new { slug = service.Slug }, new
        {
            service.Id,
            service.Title,
            service.Slug,
            service.Price,
            service.Duration,
            service.ImageUrl,
            service.Details,
            service.Description,
            service.CustomFieldsSchema,
            service.IsActive,
            service.Order
        });
    }

    // PUT: api/services/{id}  (admin)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] ServiceRequest request)
    {
        var service = await _context.Services.FindAsync(id);
        if (service == null)
            return NotFound(new { message = "Servicio no encontrado" });

        var slugExists = await _context.Services.AnyAsync(s => s.Slug == request.Slug && s.Id != id);
        if (slugExists)
            return BadRequest(new { message = "Ya existe otro servicio con ese slug" });

        service.Title = request.Title;
        service.Slug = request.Slug;
        service.Price = request.Price;
        service.Duration = request.Duration;
        service.ImageUrl = request.ImageUrl;
        service.Details = request.Details;
        service.Description = request.Description;
        service.CustomFieldsSchema = request.CustomFieldsSchema;
        service.IsActive = request.IsActive;
        service.Order = request.Order;
        service.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Servicio actualizado correctamente" });
    }

    // DELETE: api/services/{id}  (admin)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var service = await _context.Services.FindAsync(id);
        if (service == null)
            return NotFound(new { message = "Servicio no encontrado" });

        _context.Services.Remove(service);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Servicio eliminado correctamente" });
    }
}

public class ServiceRequest
{
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Price { get; set; } = string.Empty;
    public string? Duration { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Details { get; set; } = new();
    public string? CustomFieldsSchema { get; set; }
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
}
