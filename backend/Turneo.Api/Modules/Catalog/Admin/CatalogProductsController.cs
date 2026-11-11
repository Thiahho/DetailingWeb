using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.Catalog.Admin;

[Route("api/catalog/products")]
public class CatalogProductsController : CatalogControllerBase
{
    private readonly ICatalogVariantGenerator _generator;

    public CatalogProductsController(ApplicationDbContext db, ICatalogVariantGenerator generator) : base(db)
    {
        _generator = generator;
    }

    // GET: api/catalog/products?categoryId=
    [HttpGet]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.View)]
    public async Task<IActionResult> GetAll([FromQuery] int? categoryId)
    {
        var products = await Db.CatalogProducts
            .AsNoTracking()
            .Where(p => categoryId == null || p.CategoryId == categoryId)
            .OrderBy(p => p.Category.SortOrder).ThenBy(p => p.SortOrder).ThenBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.Name,
                p.Slug,
                p.Price,
                p.IsActive,
                p.SortOrder,
                ActiveVariants = p.Variants.Count(v => v.IsActive),
                OnRequestVariants = p.Variants.Count(v => v.IsActive && v.Availability == CatalogAvailability.APedido),
                CoverUrl = p.Media.Where(m => m.Type == CatalogMediaType.Image).OrderBy(m => m.SortOrder).Select(m => m.Url).FirstOrDefault()
            })
            .ToListAsync();
        return Ok(products);
    }

    // GET: api/catalog/products/{id}
    [HttpGet("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.View)]
    public async Task<IActionResult> Get(int id)
    {
        var detail = await LoadDetailAsync(id);
        return detail is null ? ProductNotFound() : Ok(detail);
    }

    // POST: api/catalog/products
    // The product insert and its variant generation run in one transaction: the
    // SKU needs the product id, and a generation failure must not leave a
    // product without variants behind.
    [HttpPost]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Create)]
    public async Task<IActionResult> Create([FromBody] CatalogProductRequest request)
    {
        var slug = ResolveSlug(request.Name, request.Slug, CatalogLimits.ProductSlugMaxLength);
        var error = await ValidateAsync(request, slug, excludeId: null);
        if (error is not null) return error;

        var product = new CatalogProduct
        {
            AllowedValues = request.AllowedValueIds.Distinct()
                .Select(valueId => new CatalogProductAllowedValue { AttributeValueId = valueId })
                .ToList()
        };
        Apply(product, request, slug);
        Db.CatalogProducts.Add(product);

        await using var transaction = await Db.Database.BeginTransactionAsync();
        try
        {
            await Db.SaveChangesAsync();
            await _generator.SyncAsync(product.Id);
            await transaction.CommitAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return DuplicateSlug(slug);
        }

        return Created($"/api/catalog/products/{product.Id}", await LoadDetailAsync(product.Id));
    }

    // PUT: api/catalog/products/{id}
    [HttpPut("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CatalogProductRequest request)
    {
        var product = await Db.CatalogProducts.Include(p => p.AllowedValues).FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return ProductNotFound();

        var slug = ResolveSlug(request.Name, request.Slug, CatalogLimits.ProductSlugMaxLength);
        var error = await ValidateAsync(request, slug, excludeId: id);
        if (error is not null) return error;

        Apply(product, request, slug);
        var wanted = request.AllowedValueIds.ToHashSet();
        product.AllowedValues.RemoveAll(a => !wanted.Contains(a.AttributeValueId));
        foreach (var valueId in wanted.Where(v => product.AllowedValues.All(a => a.AttributeValueId != v)))
            product.AllowedValues.Add(new CatalogProductAllowedValue { ProductId = id, AttributeValueId = valueId });

        await using var transaction = await Db.Database.BeginTransactionAsync();
        try
        {
            await Db.SaveChangesAsync();
            await _generator.SyncAsync(id);
            await transaction.CommitAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return DuplicateSlug(slug);
        }

        return Ok(await LoadDetailAsync(id));
    }

    // DELETE: api/catalog/products/{id}
    // Variants, allowed values and media rows go with it (cascade). The
    // Cloudinary assets are not deleted here: the API never holds Cloudinary credentials.
    [HttpDelete("{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await Db.CatalogProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return ProductNotFound();

        Db.CatalogProducts.Remove(product);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    // POST: api/catalog/products/{id}/variants/generate
    [HttpPost("{id:int}/variants/generate")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> GenerateVariants(int id)
    {
        if (!await Db.CatalogProducts.AnyAsync(p => p.Id == id)) return ProductNotFound();

        await _generator.SyncAsync(id);
        return Ok(await LoadDetailAsync(id));
    }

    // POST: api/catalog/products/{id}/media
    // The file is already uploaded to Cloudinary by the admin frontend; only
    // its URL and public id are stored.
    [HttpPost("{id:int}/media")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Create)]
    public async Task<IActionResult> AddMedia(int id, [FromBody] CatalogMediaRequest request)
    {
        var product = await Db.CatalogProducts.Include(p => p.AllowedValues).FirstOrDefaultAsync(p => p.Id == id);
        if (product is null) return ProductNotFound();

        var url = request.Url.Trim();
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            return BadRequestMessage("La URL debe ser una dirección https válida");

        if (request.AttributeValueId is { } valueId && product.AllowedValues.All(a => a.AttributeValueId != valueId))
            return BadRequestMessage("El valor indicado no corresponde a este producto");

        var nextOrder = await Db.CatalogMedia.Where(m => m.ProductId == id).Select(m => (int?)m.SortOrder).MaxAsync() ?? -1;
        var media = new CatalogMedia
        {
            ProductId = id,
            AttributeValueId = request.AttributeValueId,
            Type = request.Type,
            Url = url,
            PublicId = NullIfEmpty(request.PublicId),
            SortOrder = nextOrder + 1
        };
        Db.CatalogMedia.Add(media);
        await Db.SaveChangesAsync();

        return Created($"/api/catalog/media/{media.Id}", ToResponse(media));
    }

    // PUT: api/catalog/products/{id}/media/order
    // Body lists every media id of the product in the new order.
    [HttpPut("{id:int}/media/order")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Edit)]
    public async Task<IActionResult> ReorderMedia(int id, [FromBody] CatalogMediaOrderRequest request)
    {
        if (!await Db.CatalogProducts.AnyAsync(p => p.Id == id)) return ProductNotFound();

        var media = await Db.CatalogMedia.Where(m => m.ProductId == id).ToListAsync();
        var ids = request.MediaIds;
        if (ids.Count != media.Count || ids.Distinct().Count() != ids.Count || !media.All(m => ids.Contains(m.Id)))
            return BadRequestMessage("El orden debe incluir todos los archivos del producto, una sola vez");

        foreach (var item in media)
            item.SortOrder = ids.IndexOf(item.Id);
        await Db.SaveChangesAsync();

        return Ok(media.OrderBy(m => m.SortOrder).Select(ToResponse));
    }

    // DELETE: api/catalog/media/{id}
    [HttpDelete("~/api/catalog/media/{id:int}")]
    [RequirePermission(PermissionModules.Catalogo, PermissionActions.Delete)]
    public async Task<IActionResult> DeleteMedia(int id)
    {
        var media = await Db.CatalogMedia.FirstOrDefaultAsync(m => m.Id == id);
        if (media is null) return NotFoundMessage("Archivo no encontrado");

        Db.CatalogMedia.Remove(media);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    // The category and every allowed value are looked up through the tenant
    // filter, so ids from another tenant are rejected as nonexistent. Values
    // must belong to the attributes of the chosen category.
    private async Task<IActionResult?> ValidateAsync(CatalogProductRequest request, string slug, int? excludeId)
    {
        if (slug.Length == 0)
            return BadRequestMessage("El nombre debe contener letras o números");

        if (!await Db.CatalogCategories.AnyAsync(c => c.Id == request.CategoryId))
            return BadRequestMessage("La categoría no existe");

        if (await Db.CatalogProducts.AnyAsync(p => p.Slug == slug && (excludeId == null || p.Id != excludeId)))
            return DuplicateSlug(slug);

        var attributeIds = await Db.CatalogCategoryAttributes
            .Where(ca => ca.CategoryId == request.CategoryId)
            .Select(ca => ca.AttributeId)
            .ToListAsync();
        var valueIds = request.AllowedValueIds.Distinct().ToList();
        var valid = await Db.CatalogAttributeValues.CountAsync(v => valueIds.Contains(v.Id) && attributeIds.Contains(v.AttributeId));
        if (valid != valueIds.Count)
            return BadRequestMessage("Hay valores que no corresponden a los atributos de la categoría");

        return null;
    }

    private static void Apply(CatalogProduct product, CatalogProductRequest request, string slug)
    {
        product.CategoryId = request.CategoryId;
        product.Name = request.Name.Trim();
        product.Slug = slug;
        product.Description = NullIfEmpty(request.Description);
        product.Price = request.Price;
        product.SortOrder = request.SortOrder;
        product.IsActive = request.IsActive;
        product.UpdatedAt = DateTime.UtcNow;
    }

    private async Task<object?> LoadDetailAsync(int id)
    {
        var p = await Db.CatalogProducts
            .AsNoTracking()
            .Include(x => x.AllowedValues)
            .Include(x => x.Variants).ThenInclude(v => v.Values)
            .Include(x => x.Media)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return null;

        return new
        {
            p.Id,
            p.CategoryId,
            p.Name,
            p.Slug,
            p.Description,
            p.Price,
            p.SortOrder,
            p.IsActive,
            AllowedValueIds = p.AllowedValues.Select(a => a.AttributeValueId).Order().ToList(),
            Variants = p.Variants.OrderBy(v => v.Id).Select(v => new
            {
                v.Id,
                v.Sku,
                v.CombinationKey,
                ValueIds = v.Values.Select(x => x.AttributeValueId).Order().ToList(),
                v.Availability,
                v.IsActive
            }).ToList(),
            Media = p.Media.OrderBy(m => m.SortOrder).Select(ToResponse).ToList()
        };
    }

    private NotFoundObjectResult ProductNotFound() => NotFoundMessage("Producto no encontrado");

    private ConflictObjectResult DuplicateSlug(string slug) =>
        ConflictMessage($"Ya existe un producto con el slug '{slug}'");

    private static object ToResponse(CatalogMedia m) => new
    {
        m.Id,
        m.Type,
        m.Url,
        m.PublicId,
        m.AttributeValueId,
        m.SortOrder
    };
}
