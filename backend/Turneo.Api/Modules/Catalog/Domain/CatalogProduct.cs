using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Modules.Catalog;

// A sellable item of the public catalog. Separate from Core/Products (the
// admin-only items added to bookings). Price is optional: without it the public
// catalog shows "Consultar precio".
[Table("CatalogProducts")]
public class CatalogProduct : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int CategoryId { get; set; }
    public CatalogCategory Category { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<CatalogProductAllowedValue> AllowedValues { get; set; } = new();
    public List<CatalogVariant> Variants { get; set; } = new();
    public List<CatalogMedia> Media { get; set; } = new();
}

// Attribute values enabled for a product; its variants are generated from them.
[Table("CatalogProductAllowedValues")]
public class CatalogProductAllowedValue : ITenantScoped
{
    public int TenantId { get; set; }
    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;
    public int AttributeValueId { get; set; }
    public CatalogAttributeValue AttributeValue { get; set; } = null!;
}
