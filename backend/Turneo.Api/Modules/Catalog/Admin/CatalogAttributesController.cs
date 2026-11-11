using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.Catalog.Admin;

[Route("api/catalog/attributes")]
public class CatalogAttributesController : CatalogControllerBase
{
    public CatalogAttributesController(ApplicationDbContext db) : base(db)
    {
    }

    // GET: api/catalog/attributes
    [HttpGet]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.View)]
    public async Task<IActionResult> GetAll()
    {
        var attributes = await Db.CatalogAttributes
            .AsNoTracking()
            .Include(a => a.Values)
            .OrderBy(a => a.SortOrder).ThenBy(a => a.Name)
            .ToListAsync();
        return Ok(attributes.Select(ToResponse));
    }

    // POST: api/catalog/attributes
    [HttpPost]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Create)]
    public async Task<IActionResult> Create([FromBody] CatalogAttributeRequest request)
    {
        var slug = ResolveSlug(request.Name, request.Slug, CatalogLimits.AttributeSlugMaxLength);
        var error = await ValidateSlugAsync(slug, excludeId: null);
        if (error is not null) return error;

        var attribute = new CatalogAttribute { Name = request.Name.Trim(), Slug = slug, SortOrder = request.SortOrder };
        Db.CatalogAttributes.Add(attribute);
        if (!await TrySaveAsync()) return DuplicateSlug(slug);

        return Created($"/api/catalog/attributes/{attribute.Id}", ToResponse(attribute));
    }

    // PUT: api/catalog/attributes/{id}
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CatalogAttributeRequest request)
    {
        var attribute = await Db.CatalogAttributes.Include(a => a.Values).FirstOrDefaultAsync(a => a.Id == id);
        if (attribute is null) return AttributeNotFound();

        var slug = ResolveSlug(request.Name, request.Slug, CatalogLimits.AttributeSlugMaxLength);
        var error = await ValidateSlugAsync(slug, excludeId: id);
        if (error is not null) return error;

        attribute.Name = request.Name.Trim();
        attribute.Slug = slug;
        attribute.SortOrder = request.SortOrder;
        if (!await TrySaveAsync()) return DuplicateSlug(slug);

        return Ok(ToResponse(attribute));
    }

    // DELETE: api/catalog/attributes/{id}
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var attribute = await Db.CatalogAttributes.Include(a => a.Values).FirstOrDefaultAsync(a => a.Id == id);
        if (attribute is null) return AttributeNotFound();

        if (await Db.CatalogCategoryAttributes.AnyAsync(ca => ca.AttributeId == id))
            return ConflictMessage("El atributo está asignado a una categoría. Quítelo de la categoría primero.");
        if (await ValuesInUseAsync(attribute.Values.Select(v => v.Id).ToList()))
            return ConflictMessage("Hay productos que usan valores de este atributo.");

        Db.CatalogAttributes.Remove(attribute);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    // POST: api/catalog/attributes/{id}/values
    [HttpPost("{id:int}/values")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Create)]
    public async Task<IActionResult> CreateValue(int id, [FromBody] CatalogAttributeValueRequest request)
    {
        if (!await Db.CatalogAttributes.AnyAsync(a => a.Id == id)) return AttributeNotFound();

        var label = request.Label.Trim();
        if (label.Length == 0) return BadRequestMessage("La etiqueta es requerida");
        if (await Db.CatalogAttributeValues.AnyAsync(v => v.AttributeId == id && v.Label == label))
            return DuplicateValue(label);

        var value = new CatalogAttributeValue
        {
            AttributeId = id,
            Label = label,
            SortOrder = request.SortOrder,
            ColorHex = NullIfEmpty(request.ColorHex)
        };
        Db.CatalogAttributeValues.Add(value);
        if (!await TrySaveAsync()) return DuplicateValue(label);

        return Created($"/api/catalog/attribute-values/{value.Id}", ToResponse(value));
    }

    // PUT: api/catalog/attribute-values/{id}
    [HttpPut("~/api/catalog/attribute-values/{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> UpdateValue(int id, [FromBody] CatalogAttributeValueRequest request)
    {
        var value = await Db.CatalogAttributeValues.FirstOrDefaultAsync(v => v.Id == id);
        if (value is null) return ValueNotFound();

        var label = request.Label.Trim();
        if (label.Length == 0) return BadRequestMessage("La etiqueta es requerida");
        if (await Db.CatalogAttributeValues.AnyAsync(v => v.AttributeId == value.AttributeId && v.Label == label && v.Id != id))
            return DuplicateValue(label);

        value.Label = label;
        value.SortOrder = request.SortOrder;
        value.ColorHex = NullIfEmpty(request.ColorHex);
        if (!await TrySaveAsync()) return DuplicateValue(label);

        return Ok(ToResponse(value));
    }

    // DELETE: api/catalog/attribute-values/{id}
    [HttpDelete("~/api/catalog/attribute-values/{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteValue(int id)
    {
        var value = await Db.CatalogAttributeValues.FirstOrDefaultAsync(v => v.Id == id);
        if (value is null) return ValueNotFound();

        if (await ValuesInUseAsync(new[] { id }))
            return ConflictMessage("Hay productos que usan este valor. Quítelo de los productos primero.");

        Db.CatalogAttributeValues.Remove(value);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<IActionResult?> ValidateSlugAsync(string slug, int? excludeId)
    {
        if (slug.Length == 0)
            return BadRequestMessage("El nombre debe contener letras o números");
        if (await Db.CatalogAttributes.AnyAsync(a => a.Slug == slug && (excludeId == null || a.Id != excludeId)))
            return DuplicateSlug(slug);
        return null;
    }

    private async Task<bool> TrySaveAsync()
    {
        try
        {
            await Db.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return false;
        }
    }

    private NotFoundObjectResult AttributeNotFound() => NotFoundMessage("Atributo no encontrado");

    private NotFoundObjectResult ValueNotFound() => NotFoundMessage("Valor no encontrado");

    private ConflictObjectResult DuplicateSlug(string slug) =>
        ConflictMessage($"Ya existe un atributo con el slug '{slug}'");

    private ConflictObjectResult DuplicateValue(string label) =>
        ConflictMessage($"El valor '{label}' ya existe en este atributo");

    private static object ToResponse(CatalogAttribute a) => new
    {
        a.Id,
        a.Name,
        a.Slug,
        a.SortOrder,
        Values = a.Values.OrderBy(v => v.SortOrder).ThenBy(v => v.Id).Select(ToResponse).ToList()
    };

    private static object ToResponse(CatalogAttributeValue v) => new
    {
        v.Id,
        v.AttributeId,
        v.Label,
        v.SortOrder,
        v.ColorHex
    };
}
