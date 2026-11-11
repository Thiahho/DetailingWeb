using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Modules.Catalog;

// A configurable dimension of a product (Talle, Color, Medida...). Named with
// the Catalog prefix so it never clashes with System.Attribute.
[Table("CatalogAttributes")]
public class CatalogAttribute : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public List<CatalogAttributeValue> Values { get; set; } = new();
}

[Table("CatalogAttributeValues")]
public class CatalogAttributeValue : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int AttributeId { get; set; }
    public CatalogAttribute Attribute { get; set; } = null!;
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    // Optional swatch (#RRGGBB) for color-like attributes.
    public string? ColorHex { get; set; }
}
