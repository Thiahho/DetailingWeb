using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Turneo.Api.Core.Services;

[ApiController]
[Route("api/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly IServicesRepository _repository;
    private readonly IServiceInsumosRepository _recipeRepository;
    private readonly IPlanLimitsService _planLimits;

    public ServicesController(IServicesRepository repository, IServiceInsumosRepository recipeRepository, IPlanLimitsService planLimits)
    {
        _repository = repository;
        _recipeRepository = recipeRepository;
        _planLimits = planLimits;
    }

    // GET: api/services  (público)
    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> GetAll()
    {
        var services = await _repository.GetActiveAsync();

        return Ok(services.Select(s => new
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
            s.Category,
            s.BufferMinutes,
            s.Color,
            s.IsActive,
            s.Order
        }));
    }

    // GET: api/services/all  (admin, incluye inactivos)
    [HttpGet("all")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Servicios, PermissionActions.View)]
    public async Task<IActionResult> GetAllAdmin()
    {
        var services = await _repository.GetAllAsync();

        return Ok(services.Select(s => new
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
            s.Category,
            s.BufferMinutes,
            s.Color,
            s.IsActive,
            s.Order,
            s.CreatedAt,
            s.UpdatedAt
        }));
    }

    // GET: api/services/{slug}  (público)
    [HttpGet("{slug}")]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var service = await _repository.GetBySlugAsync(slug, activeOnly: true);

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
            service.Category,
            service.BufferMinutes,
            service.Color,
            service.IsActive,
            service.Order
        });
    }

    // POST: api/services  (admin)
    [HttpPost]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Servicios, PermissionActions.Create)]
    public async Task<IActionResult> Create([FromBody] ServiceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Slug))
            return BadRequest(new { message = "Título y slug son requeridos" });

        var activeCount = await _repository.CountActiveAsync();
        if (!await _planLimits.IsWithinLimitAsync("MaxServices", activeCount))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new
            {
                message = "Alcanzaste el límite de servicios de tu plan. Actualizá tu plan para agregar más."
            });
        }

        var slugExists = await _repository.SlugExistsAsync(request.Slug);
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
            Category = request.Category,
            BufferMinutes = request.BufferMinutes,
            Color = request.Color,
            IsActive = request.IsActive,
            Order = request.Order
        };

        _repository.Add(service);
        await _repository.SaveChangesAsync();

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
            service.Category,
            service.BufferMinutes,
            service.Color,
            service.IsActive,
            service.Order
        });
    }

    // PUT: api/services/{id}  (admin)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Servicios, PermissionActions.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] ServiceRequest request)
    {
        var service = await _repository.FindAsync(id);
        if (service == null)
            return NotFound(new { message = "Servicio no encontrado" });

        var slugExists = await _repository.SlugExistsAsync(request.Slug, id);
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
        service.Category = request.Category;
        service.BufferMinutes = request.BufferMinutes;
        service.Color = request.Color;
        service.IsActive = request.IsActive;
        service.Order = request.Order;
        service.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();

        return Ok(new { message = "Servicio actualizado correctamente" });
    }

    // DELETE: api/services/{id}  (admin)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Servicios, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var service = await _repository.FindAsync(id);
        if (service == null)
            return NotFound(new { message = "Servicio no encontrado" });

        _repository.Remove(service);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Servicio eliminado correctamente" });
    }

    // GET: api/services/{id}/recipe  (admin - insumos que consume este servicio, con cantidad)
    [HttpGet("{id}/recipe")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Servicios, PermissionActions.View)]
    public async Task<IActionResult> GetRecipe(int id)
    {
        var items = await _recipeRepository.GetByServiceIdAsync(id);

        return Ok(items.Select(i => new
        {
            i.InsumoId,
            InsumoName = i.Insumo.Name,
            i.Quantity
        }));
    }

    // PUT: api/services/{id}/recipe  (admin - reemplaza la receta completa, mismo patrón
    // que el detalle de un turno: más simple que CRUD granular por ítem)
    [HttpPut("{id}/recipe")]
    [Authorize(Roles = "Admin,Staff")]
    [RequirePermission(PermissionModules.Servicios, PermissionActions.Edit)]
    public async Task<IActionResult> UpdateRecipe(int id, [FromBody] UpdateServiceRecipeRequest request)
    {
        var service = await _repository.FindAsync(id);
        if (service == null)
            return NotFound(new { message = "Servicio no encontrado" });

        var existing = await _recipeRepository.GetByServiceIdAsync(id);
        _recipeRepository.RemoveRange(existing);

        var newItems = request.Items.Select(i => new ServiceInsumo
        {
            ServiceId = id,
            InsumoId = i.InsumoId,
            Quantity = i.Quantity
        }).ToList();
        _recipeRepository.AddRange(newItems);

        await _recipeRepository.SaveChangesAsync();

        return Ok(new { message = "Receta actualizada correctamente" });
    }
}

public class ServiceRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 1)]
    public string Slug { get; set; } = string.Empty;

    [Required, StringLength(50, MinimumLength = 1)]
    public string Price { get; set; } = string.Empty;

    [StringLength(50)]
    public string? Duration { get; set; } = string.Empty;

    [StringLength(1000)]
    public string ImageUrl { get; set; } = string.Empty;

    [StringLength(2000)]
    public string Description { get; set; } = string.Empty;

    public List<string> Details { get; set; } = new();

    [StringLength(4000)]
    public string? CustomFieldsSchema { get; set; }

    [StringLength(100)]
    public string? Category { get; set; }

    [Range(0, 480)]
    public int BufferMinutes { get; set; } = 0;

    [Required, RegularExpression("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
        ErrorMessage = "Color debe ser un color hexadecimal (#RRGGBB)")]
    public string Color { get; set; } = "#7c3aed";

    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
}

public class UpdateServiceRecipeRequest
{
    public List<ServiceRecipeItemRequest> Items { get; set; } = new();
}

public class ServiceRecipeItemRequest
{
    [Range(1, int.MaxValue)]
    public int InsumoId { get; set; }

    [Range(1, 999)]
    public int Quantity { get; set; } = 1;
}
