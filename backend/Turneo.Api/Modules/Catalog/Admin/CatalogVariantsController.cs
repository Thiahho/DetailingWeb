using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.Catalog.Admin;

[Route("api/catalog/variants")]
public class CatalogVariantsController : CatalogControllerBase
{
    public CatalogVariantsController(ApplicationDbContext db) : base(db)
    {
    }

    // PATCH: api/catalog/variants/{id}
    [HttpPatch("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> Patch(int id, [FromBody] CatalogVariantPatchRequest request)
    {
        var variant = await Db.CatalogVariants.Include(v => v.Values).FirstOrDefaultAsync(v => v.Id == id);
        if (variant is null) return NotFoundMessage("Variante no encontrada");

        if (request.Availability is { } availability) variant.Availability = availability;
        if (request.IsActive is { } isActive) variant.IsActive = isActive;
        await Db.SaveChangesAsync();

        return Ok(new
        {
            variant.Id,
            variant.Sku,
            variant.CombinationKey,
            ValueIds = variant.Values.Select(v => v.AttributeValueId).Order().ToList(),
            variant.Availability,
            variant.IsActive
        });
    }

    // PATCH: api/catalog/variants/bulk
    // Sets the availability of every active variant of the product that contains
    // all the given values (empty list = all), e.g. every "Rojo" → on request.
    // A product of another tenant matches nothing through the tenant filter.
    [HttpPatch("bulk")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> Bulk([FromBody] CatalogVariantBulkRequest request)
    {
        var availability = request.Availability!.Value;
        var query = Db.CatalogVariants.Where(v => v.ProductId == request.ProductId && v.IsActive);
        foreach (var valueId in request.ValueIds.Distinct())
            query = query.Where(v => v.Values.Any(x => x.AttributeValueId == valueId));

        var updated = await query.ExecuteUpdateAsync(s => s.SetProperty(v => v.Availability, availability));
        return Ok(new { updated });
    }
}
