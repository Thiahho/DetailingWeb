using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Modules.Catalog.Public;

// Anonymous, read-only catalog of the business's public site. The tenant comes
// from the host (TenantResolutionMiddleware: X-Tenant-Host or Host), and every
// query goes through the tenant query filters (plus RLS), so another tenant's
// rows are simply absent. Only active categories, products and variants are
// visible: an inactive one behaves exactly like a nonexistent one.
// The WhatsApp number for the order is already public in GET api/siteconfig.
[ApiController]
[AllowAnonymous]
[EnableRateLimiting("public-read")]
[Route("api/catalog/public")]
public class CatalogPublicController : ControllerBase
{
    public const int MaxVariantIds = 200;

    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _tenant;

    public CatalogPublicController(ApplicationDbContext db, ICurrentTenant tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    // Without a resolved tenant there is no catalog to show (never another tenant's).
    private bool HasTenant => _tenant.IsResolved && !_tenant.IsBypassed && _tenant.TenantId > 0;

    private IQueryable<CatalogProduct> VisibleProducts =>
        _db.CatalogProducts.AsNoTracking().Where(p => p.IsActive && p.Category.IsActive);

    private NotFoundObjectResult ProductNotFound() =>
        NotFound(new { success = false, message = "Producto no encontrado" });

    // GET: api/catalog/public/categories
    // Active categories with at least one visible product.
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        if (!HasTenant) return Ok(Array.Empty<object>());

        var categories = await _db.CatalogCategories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .Select(c => new
            {
                c.Slug,
                c.Name,
                c.Description,
                c.SortOrder,
                ProductCount = c.Products.Count(p => p.IsActive)
            })
            .Where(c => c.ProductCount > 0)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .ToListAsync();

        return Ok(categories.Select(c => new { c.Slug, c.Name, c.Description, c.ProductCount }));
    }

    // GET: api/catalog/public/products?category={slug}
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts([FromQuery] string? category)
    {
        if (!HasTenant) return Ok(Array.Empty<object>());

        var query = VisibleProducts;
        if (!string.IsNullOrWhiteSpace(category))
        {
            var slug = category.Trim().ToLowerInvariant();
            query = query.Where(p => p.Category.Slug == slug);
        }

        var products = await query
            .OrderBy(p => p.Category.SortOrder).ThenBy(p => p.Category.Name)
            .ThenBy(p => p.SortOrder).ThenBy(p => p.Name)
            .Select(p => new
            {
                p.Slug,
                p.Name,
                p.Price,
                ImageUrl = p.Media
                    .Where(m => m.Type == CatalogMediaType.Image)
                    .OrderBy(m => m.SortOrder).ThenBy(m => m.Id)
                    .Select(m => m.Url)
                    .FirstOrDefault(),
                CategorySlug = p.Category.Slug,
                CategoryName = p.Category.Name
            })
            .ToListAsync();

        return Ok(products);
    }

    // GET: api/catalog/public/products/{slug}
    // The category's attributes in their combination order, each with only the
    // values allowed for this product; active variants; media in display order.
    [HttpGet("products/{slug}")]
    public async Task<IActionResult> GetProduct(string slug)
    {
        if (!HasTenant) return ProductNotFound();

        var normalized = slug.Trim().ToLowerInvariant();
        var product = await VisibleProducts
            .Include(p => p.Category).ThenInclude(c => c.Attributes).ThenInclude(a => a.Attribute)
            .Include(p => p.AllowedValues).ThenInclude(a => a.AttributeValue)
            .Include(p => p.Variants.Where(v => v.IsActive)).ThenInclude(v => v.Values)
            .Include(p => p.Media)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Slug == normalized);
        if (product is null) return ProductNotFound();

        var allowedValues = product.AllowedValues.Select(a => a.AttributeValue).ToList();

        return Ok(new
        {
            product.Slug,
            product.Name,
            product.Description,
            product.Price,
            CategorySlug = product.Category.Slug,
            CategoryName = product.Category.Name,
            Attributes = product.Category.Attributes
                .OrderBy(a => a.SortOrder).ThenBy(a => a.AttributeId)
                .Select(a => new
                {
                    a.Attribute.Id,
                    a.Attribute.Name,
                    a.Attribute.Slug,
                    Values = allowedValues
                        .Where(v => v.AttributeId == a.AttributeId)
                        .OrderBy(v => v.SortOrder).ThenBy(v => v.Id)
                        .Select(v => new { v.Id, v.Label, v.ColorHex, v.SortOrder })
                }),
            Variants = product.Variants
                .OrderBy(v => v.Id)
                .Select(v => new
                {
                    v.Id,
                    v.Sku,
                    ValueIds = v.Values.Select(x => x.AttributeValueId).Order(),
                    v.Availability
                }),
            Media = product.Media
                .OrderBy(m => m.SortOrder).ThenBy(m => m.Id)
                .Select(m => new { m.Id, m.Url, m.Type, m.AttributeValueId })
        });
    }

    // GET: api/catalog/public/variants?ids=1,2,3
    // Cart sync: unknown, inactive or foreign ids are silently dropped so the
    // browser can prune its cart. Value labels follow the category's attribute order.
    [HttpGet("variants")]
    public async Task<IActionResult> GetVariants([FromQuery] string? ids)
    {
        var idList = new HashSet<int>();
        foreach (var token in (ids ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!int.TryParse(token, out var id) || id <= 0)
                return BadRequest(new { success = false, message = "La lista de variantes no es válida" });
            idList.Add(id);
        }
        if (idList.Count > MaxVariantIds)
            return BadRequest(new { success = false, message = $"Se admiten hasta {MaxVariantIds} variantes por consulta" });
        if (idList.Count == 0 || !HasTenant) return Ok(Array.Empty<object>());

        var variants = await _db.CatalogVariants
            .AsNoTracking()
            .Where(v => idList.Contains(v.Id) && v.IsActive && v.Product.IsActive && v.Product.Category.IsActive)
            .Include(v => v.Product).ThenInclude(p => p.Category).ThenInclude(c => c.Attributes)
            .Include(v => v.Values).ThenInclude(x => x.AttributeValue)
            .AsSplitQuery()
            .ToListAsync();

        return Ok(variants.OrderBy(v => v.Id).Select(v =>
        {
            var attributeOrder = v.Product.Category.Attributes.ToDictionary(a => a.AttributeId, a => a.SortOrder);
            return new
            {
                v.Id,
                v.Sku,
                v.Availability,
                ProductSlug = v.Product.Slug,
                ProductName = v.Product.Name,
                v.Product.Price,
                CategoryName = v.Product.Category.Name,
                Values = v.Values
                    .Select(x => x.AttributeValue)
                    .OrderBy(x => attributeOrder.GetValueOrDefault(x.AttributeId, int.MaxValue)).ThenBy(x => x.AttributeId)
                    .Select(x => x.Label)
            };
        }));
    }
}
