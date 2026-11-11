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
        if (request.IsActive is { } isActive) SetActiveByHand(variant, isActive);
        await Db.SaveChangesAsync();

        return Ok(new
        {
            variant.Id,
            variant.Sku,
            variant.CombinationKey,
            ValueIds = variant.Values.Select(v => v.AttributeValueId).Order().ToList(),
            variant.Availability,
            variant.IsActive,
            variant.DisabledManually
        });
    }

    // PATCH: api/catalog/variants/bulk
    // Updates every variant of the product that contains all the given values
    // (empty list = all), e.g. every "Rojo" → on request, or every "Rojo" off.
    // Availability alone and isActive=false touch the active variants;
    // isActive=true turns back on only the variants disabled by hand (never the
    // ones the generator deactivated because their combination is obsolete).
    // A product of another tenant matches nothing through the tenant filter.
    [HttpPatch("bulk")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> Bulk([FromBody] CatalogVariantBulkRequest request)
    {
        var query = Db.CatalogVariants.Where(v => v.ProductId == request.ProductId);
        query = request.IsActive == true ? query.Where(v => v.DisabledManually) : query.Where(v => v.IsActive);
        foreach (var valueId in request.ValueIds.Distinct())
            query = query.Where(v => v.Values.Any(x => x.AttributeValueId == valueId));

        var variants = await query.ToListAsync();
        foreach (var variant in variants)
        {
            if (request.Availability is { } availability) variant.Availability = availability;
            if (request.IsActive is { } isActive) SetActiveByHand(variant, isActive);
        }
        await Db.SaveChangesAsync();
        return Ok(new { updated = variants.Count });
    }

    // A manual deactivation is remembered so that generation (product save,
    // category save, regenerate) never turns the variant back on; a manual
    // activation clears it.
    private static void SetActiveByHand(CatalogVariant variant, bool isActive)
    {
        variant.IsActive = isActive;
        variant.DisabledManually = !isActive;
    }
}
