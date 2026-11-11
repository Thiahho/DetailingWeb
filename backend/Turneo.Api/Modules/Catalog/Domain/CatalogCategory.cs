using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Modules.Catalog;

// A catalog section (e.g. "Remeras"). Its ordered attributes define how the
// variants of its products are combined (e.g. Talle × Color).
[Table("CatalogCategories")]
public class CatalogCategory : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<CatalogCategoryAttribute> Attributes { get; set; } = new();
    public List<CatalogProduct> Products { get; set; } = new();
}

// Ordered link between a category and the attributes its products vary by.
[Table("CatalogCategoryAttributes")]
public class CatalogCategoryAttribute : ITenantScoped
{
    public int TenantId { get; set; }
    public int CategoryId { get; set; }
    public CatalogCategory Category { get; set; } = null!;
    public int AttributeId { get; set; }
    public CatalogAttribute Attribute { get; set; } = null!;
    public int SortOrder { get; set; }
}
