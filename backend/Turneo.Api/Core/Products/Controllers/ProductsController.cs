using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Turneo.Api.Core.Products;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Staff,Professional")]
public class ProductsController : ControllerBase
{
    private readonly IProductsRepository _repository;

    public ProductsController(IProductsRepository repository)
    {
        _repository = repository;
    }

    // GET: api/products  (admin - catálogo usado al armar el detalle de un turno)
    [HttpGet]
    [RequirePermission(PermissionModules.Productos, PermissionActions.View, alsoCheckProfessional: true)]
    public async Task<IActionResult> GetAll()
    {
        var products = await _repository.GetAllAsync();

        return Ok(products.Select(p => new
        {
            p.Id,
            p.Name,
            p.Price,
            p.IsActive,
            p.Order,
            p.CreatedAt,
            p.UpdatedAt
        }));
    }

    // POST: api/products  (admin)
    [HttpPost]
    [RequirePermission(PermissionModules.Productos, PermissionActions.Create, alsoCheckProfessional: true)]
    public async Task<IActionResult> Create([FromBody] ProductRequest request)
    {
        var product = new Product
        {
            Name = request.Name,
            Price = request.Price,
            IsActive = request.IsActive,
            Order = request.Order
        };

        _repository.Add(product);
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            product.Id,
            product.Name,
            product.Price,
            product.IsActive,
            product.Order
        });
    }

    // PUT: api/products/{id}  (admin)
    [HttpPut("{id}")]
    [RequirePermission(PermissionModules.Productos, PermissionActions.Edit, alsoCheckProfessional: true)]
    public async Task<IActionResult> Update(int id, [FromBody] ProductRequest request)
    {
        var product = await _repository.FindAsync(id);
        if (product == null)
            return NotFound(new { message = "Producto no encontrado" });

        product.Name = request.Name;
        product.Price = request.Price;
        product.IsActive = request.IsActive;
        product.Order = request.Order;
        product.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();

        return Ok(new { message = "Producto actualizado correctamente" });
    }

    // DELETE: api/products/{id}  (admin)
    [HttpDelete("{id}")]
    [RequirePermission(PermissionModules.Productos, PermissionActions.Delete, alsoCheckProfessional: true)]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _repository.FindAsync(id);
        if (product == null)
            return NotFound(new { message = "Producto no encontrado" });

        _repository.Remove(product);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Producto eliminado correctamente" });
    }
}

public class ProductRequest
{
    [Required, StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [Range(0, 9_999_999)]
    public decimal Price { get; set; }

    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
}
