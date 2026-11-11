using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.Catalog.Admin;

[Route("api/catalog/categories")]
public class CatalogCategoriesController : CatalogControllerBase
{
    private readonly ICatalogVariantGenerator _generator;

    public CatalogCategoriesController(ApplicationDbContext db, ICatalogVariantGenerator generator) : base(db)
    {
        _generator = generator;
    }

    // GET: api/catalog/categories
    [HttpGet]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.View)]
    public async Task<IActionResult> GetAll()
    {
        var categories = await Db.CatalogCategories
            .AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Slug,
                c.Description,
                c.SortOrder,
                c.IsActive,
                AttributeIds = c.Attributes.OrderBy(a => a.SortOrder).Select(a => a.AttributeId).ToList(),
                ProductCount = c.Products.Count
            })
            .ToListAsync();
        return Ok(categories);
    }

    // GET: api/catalog/categories/{id}
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.View)]
    public async Task<IActionResult> Get(int id)
    {
        var category = await LoadAsync(id, tracking: false);
        return category is null ? CategoryNotFound() : Ok(ToResponse(category));
    }

    // POST: api/catalog/categories
    [HttpPost]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Create)]
    public async Task<IActionResult> Create([FromBody] CatalogCategoryRequest request)
    {
        var slug = ResolveSlug(request.Name, request.Slug, CatalogLimits.CategorySlugMaxLength);
        var error = await ValidateAsync(request, slug, excludeId: null);
        if (error is not null) return error;

        var category = new CatalogCategory();
        Apply(category, request, slug);
        category.Attributes = request.AttributeIds.Distinct()
            .Select((attributeId, i) => new CatalogCategoryAttribute { AttributeId = attributeId, SortOrder = i })
            .ToList();
        Db.CatalogCategories.Add(category);

        try
        {
            await Db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return DuplicateSlug(slug);
        }

        return Created($"/api/catalog/categories/{category.Id}", ToResponse(category));
    }

    // PUT: api/catalog/categories/{id}
    // Changing the attribute list (or its order) regenerates the variants of
    // every product in the category, in the same transaction as the category write.
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CatalogCategoryRequest request)
    {
        var category = await LoadAsync(id, tracking: true);
        if (category is null) return CategoryNotFound();

        var slug = ResolveSlug(request.Name, request.Slug, CatalogLimits.CategorySlugMaxLength);
        var error = await ValidateAsync(request, slug, excludeId: id);
        if (error is not null) return error;

        var attributeIds = request.AttributeIds.Distinct().ToList();
        var attributesChanged = !category.Attributes.OrderBy(a => a.SortOrder).Select(a => a.AttributeId).SequenceEqual(attributeIds);
        Apply(category, request, slug);
        SyncAttributes(category, attributeIds);

        await using var transaction = await Db.Database.BeginTransactionAsync();
        try
        {
            await Db.SaveChangesAsync();
            if (attributesChanged)
            {
                var productIds = await Db.CatalogProducts.Where(p => p.CategoryId == id).Select(p => p.Id).ToListAsync();
                foreach (var productId in productIds)
                    await _generator.SyncAsync(productId);
            }
            await transaction.CommitAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return DuplicateSlug(slug);
        }

        return Ok(ToResponse(category));
    }

    // DELETE: api/catalog/categories/{id}
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await Db.CatalogCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (category is null) return CategoryNotFound();

        if (await Db.CatalogProducts.AnyAsync(p => p.CategoryId == id))
            return ConflictMessage("La categoría tiene productos. Muévalos o elimínelos antes, o desactive la categoría.");

        Db.CatalogCategories.Remove(category);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    private Task<CatalogCategory?> LoadAsync(int id, bool tracking)
    {
        var query = Db.CatalogCategories.Include(c => c.Attributes).AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync(c => c.Id == id);
    }

    private async Task<IActionResult?> ValidateAsync(CatalogCategoryRequest request, string slug, int? excludeId)
    {
        if (slug.Length == 0)
            return BadRequestMessage("El nombre debe contener letras o números");

        if (await Db.CatalogCategories.AnyAsync(c => c.Slug == slug && (excludeId == null || c.Id != excludeId)))
            return DuplicateSlug(slug);

        // Counted through the tenant filter: another tenant's attribute is "unknown".
        var attributeIds = request.AttributeIds.Distinct().ToList();
        var known = await Db.CatalogAttributes.CountAsync(a => attributeIds.Contains(a.Id));
        if (known != attributeIds.Count)
            return BadRequestMessage("Hay atributos que no existen");

        return null;
    }

    private static void Apply(CatalogCategory category, CatalogCategoryRequest request, string slug)
    {
        category.Name = request.Name.Trim();
        category.Slug = slug;
        category.Description = NullIfEmpty(request.Description);
        category.SortOrder = request.SortOrder;
        category.IsActive = request.IsActive;
        category.UpdatedAt = DateTime.UtcNow;
    }

    // Updates links in place: removing and re-adding the same composite key in
    // one SaveChanges would conflict in the change tracker.
    private static void SyncAttributes(CatalogCategory category, List<int> attributeIds)
    {
        category.Attributes.RemoveAll(ca => !attributeIds.Contains(ca.AttributeId));
        for (var i = 0; i < attributeIds.Count; i++)
        {
            var existing = category.Attributes.FirstOrDefault(ca => ca.AttributeId == attributeIds[i]);
            if (existing is null)
                category.Attributes.Add(new CatalogCategoryAttribute { CategoryId = category.Id, AttributeId = attributeIds[i], SortOrder = i });
            else
                existing.SortOrder = i;
        }
    }

    private NotFoundObjectResult CategoryNotFound() => NotFoundMessage("Categoría no encontrada");

    private ConflictObjectResult DuplicateSlug(string slug) =>
        ConflictMessage($"Ya existe una categoría con el slug '{slug}'");

    private static object ToResponse(CatalogCategory c) => new
    {
        c.Id,
        c.Name,
        c.Slug,
        c.Description,
        c.SortOrder,
        c.IsActive,
        AttributeIds = c.Attributes.OrderBy(a => a.SortOrder).Select(a => a.AttributeId).ToList()
    };
}
