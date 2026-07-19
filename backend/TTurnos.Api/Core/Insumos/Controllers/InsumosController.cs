using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TTurnos.Api.Core.Insumos;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Staff")]
public class InsumosController : ControllerBase
{
    private readonly IInsumosRepository _repository;

    public InsumosController(IInsumosRepository repository)
    {
        _repository = repository;
    }

    // GET: api/insumos  (admin - inventario + catálogo usado al armar el detalle de un turno)
    [HttpGet]
    [RequirePermission(PermissionModules.Insumos, PermissionActions.View)]
    public async Task<IActionResult> GetAll()
    {
        var insumos = await _repository.GetAllAsync();

        return Ok(insumos.Select(i => new
        {
            i.Id,
            i.Name,
            i.Stock,
            i.LowStockThreshold,
            i.UnitCost,
            i.IsActive,
            i.Order,
            i.CreatedAt,
            i.UpdatedAt
        }));
    }

    // POST: api/insumos  (admin)
    [HttpPost]
    [RequirePermission(PermissionModules.Insumos, PermissionActions.Create)]
    public async Task<IActionResult> Create([FromBody] InsumoRequest request)
    {
        var insumo = new Insumo
        {
            Name = request.Name,
            Stock = request.Stock,
            LowStockThreshold = request.LowStockThreshold,
            UnitCost = request.UnitCost,
            IsActive = request.IsActive,
            Order = request.Order
        };

        _repository.Add(insumo);
        await _repository.SaveChangesAsync();

        return Ok(new
        {
            insumo.Id,
            insumo.Name,
            insumo.Stock,
            insumo.LowStockThreshold,
            insumo.UnitCost,
            insumo.IsActive,
            insumo.Order
        });
    }

    // PUT: api/insumos/{id}  (admin - también se usa para ajustar stock manualmente)
    [HttpPut("{id}")]
    [RequirePermission(PermissionModules.Insumos, PermissionActions.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] InsumoRequest request)
    {
        var insumo = await _repository.FindAsync(id);
        if (insumo == null)
            return NotFound(new { message = "Insumo no encontrado" });

        insumo.Name = request.Name;
        insumo.Stock = request.Stock;
        insumo.LowStockThreshold = request.LowStockThreshold;
        insumo.UnitCost = request.UnitCost;
        insumo.IsActive = request.IsActive;
        insumo.Order = request.Order;
        insumo.UpdatedAt = DateTime.UtcNow;

        await _repository.SaveChangesAsync();

        return Ok(new { message = "Insumo actualizado correctamente" });
    }

    // DELETE: api/insumos/{id}  (admin)
    [HttpDelete("{id}")]
    [RequirePermission(PermissionModules.Insumos, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var insumo = await _repository.FindAsync(id);
        if (insumo == null)
            return NotFound(new { message = "Insumo no encontrado" });

        _repository.Remove(insumo);
        await _repository.SaveChangesAsync();

        return Ok(new { message = "Insumo eliminado correctamente" });
    }
}

public class InsumoRequest
{
    [Required, StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [Range(0, 999_999)]
    public int Stock { get; set; }

    [Range(0, 999_999)]
    public int LowStockThreshold { get; set; }

    [Range(0, 9_999_999)]
    public decimal UnitCost { get; set; }

    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
}
