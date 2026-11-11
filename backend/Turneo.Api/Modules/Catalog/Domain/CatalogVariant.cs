using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Modules.Catalog;

public enum CatalogAvailability
{
    Disponible = 0,
    APedido = 1,
}

// One combination of a product's allowed values. Never deleted by generation:
// obsolete combinations are deactivated so their availability survives a
// later reactivation.
[Table("CatalogVariants")]
public class CatalogVariant : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;
    // See VariantPlanner.SkuFor: derived from the product id, stable on rename.
    public string Sku { get; set; } = string.Empty;
    // Canonical combination: sorted value ids joined by '-'.
    public string CombinationKey { get; set; } = string.Empty;
    public CatalogAvailability Availability { get; set; } = CatalogAvailability.Disponible;
    public bool IsActive { get; set; } = true;

    public List<CatalogVariantValue> Values { get; set; } = new();
}

[Table("CatalogVariantValues")]
public class CatalogVariantValue : ITenantScoped
{
    public int TenantId { get; set; }
    public int VariantId { get; set; }
    public CatalogVariant Variant { get; set; } = null!;
    public int AttributeValueId { get; set; }
    public CatalogAttributeValue AttributeValue { get; set; } = null!;
}
