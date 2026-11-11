using System.ComponentModel.DataAnnotations;

namespace Turneo.Api.Modules.Catalog.Admin;

public class CatalogCategoryRequest
{
    [Required(ErrorMessage = "El nombre es requerido")]
    [StringLength(CatalogLimits.CategoryNameMaxLength, MinimumLength = 1, ErrorMessage = "El nombre admite hasta 120 caracteres")]
    public string Name { get; set; } = string.Empty;

    [StringLength(CatalogLimits.CategorySlugMaxLength, ErrorMessage = "El slug admite hasta 140 caracteres")]
    public string? Slug { get; set; }

    [StringLength(CatalogLimits.DescriptionMaxLength, ErrorMessage = "La descripción admite hasta 2000 caracteres")]
    public string? Description { get; set; }

    [Range(0, 100_000, ErrorMessage = "El orden debe estar entre 0 y 100000")]
    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    // Order matters: it is the order in which variants combine the attributes.
    [MaxLength(CatalogLimits.MaxAttributesPerCategory, ErrorMessage = "Una categoría admite hasta 10 atributos")]
    public List<int> AttributeIds { get; set; } = new();
}

public class CatalogAttributeRequest
{
    [Required(ErrorMessage = "El nombre es requerido")]
    [StringLength(CatalogLimits.AttributeNameMaxLength, MinimumLength = 1, ErrorMessage = "El nombre admite hasta 80 caracteres")]
    public string Name { get; set; } = string.Empty;

    [StringLength(CatalogLimits.AttributeSlugMaxLength, ErrorMessage = "El slug admite hasta 100 caracteres")]
    public string? Slug { get; set; }

    [Range(0, 100_000, ErrorMessage = "El orden debe estar entre 0 y 100000")]
    public int SortOrder { get; set; }
}

public class CatalogAttributeValueRequest
{
    [Required(ErrorMessage = "La etiqueta es requerida")]
    [StringLength(CatalogLimits.ValueLabelMaxLength, MinimumLength = 1, ErrorMessage = "La etiqueta admite hasta 80 caracteres")]
    public string Label { get; set; } = string.Empty;

    [Range(0, 100_000, ErrorMessage = "El orden debe estar entre 0 y 100000")]
    public int SortOrder { get; set; }

    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "El color debe tener el formato #RRGGBB")]
    public string? ColorHex { get; set; }
}

public class CatalogProductRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "La categoría es requerida")]
    public int CategoryId { get; set; }

    [Required(ErrorMessage = "El nombre es requerido")]
    [StringLength(CatalogLimits.ProductNameMaxLength, MinimumLength = 1, ErrorMessage = "El nombre admite hasta 160 caracteres")]
    public string Name { get; set; } = string.Empty;

    [StringLength(CatalogLimits.ProductSlugMaxLength, ErrorMessage = "El slug admite hasta 180 caracteres")]
    public string? Slug { get; set; }

    [StringLength(CatalogLimits.DescriptionMaxLength, ErrorMessage = "La descripción admite hasta 2000 caracteres")]
    public string? Description { get; set; }

    // Optional: without a price the public catalog shows "Consultar precio".
    [Range(typeof(decimal), "0", "9999999999999999", ErrorMessage = "El precio no es válido")]
    public decimal? Price { get; set; }

    [Range(0, 100_000, ErrorMessage = "El orden debe estar entre 0 y 100000")]
    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    [MaxLength(CatalogLimits.MaxAllowedValuesPerProduct, ErrorMessage = "Un producto admite hasta 500 valores")]
    public List<int> AllowedValueIds { get; set; } = new();
}

public class CatalogVariantPatchRequest
{
    [EnumDataType(typeof(CatalogAvailability), ErrorMessage = "La disponibilidad no es válida")]
    public CatalogAvailability? Availability { get; set; }

    public bool? IsActive { get; set; }
}

public class CatalogVariantBulkRequest : IValidatableObject
{
    [Range(1, int.MaxValue, ErrorMessage = "El producto es requerido")]
    public int ProductId { get; set; }

    // Variants containing all of these values are updated (empty = all of the product's variants).
    [MaxLength(CatalogLimits.MaxAttributesPerCategory, ErrorMessage = "Se admiten hasta 10 valores")]
    public List<int> ValueIds { get; set; } = new();

    [EnumDataType(typeof(CatalogAvailability), ErrorMessage = "La disponibilidad no es válida")]
    public CatalogAvailability? Availability { get; set; }

    // false = turn the matching active variants off by hand; true = turn the
    // matching hand-disabled variants back on.
    public bool? IsActive { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Availability is null && IsActive is null)
            yield return new ValidationResult("Se requiere la disponibilidad o el estado", new[] { nameof(Availability) });
    }
}

public class CatalogMediaRequest
{
    [Required(ErrorMessage = "La URL es requerida")]
    [StringLength(CatalogLimits.MediaUrlMaxLength, MinimumLength = 1, ErrorMessage = "La URL admite hasta 1000 caracteres")]
    public string Url { get; set; } = string.Empty;

    [StringLength(CatalogLimits.MediaPublicIdMaxLength, ErrorMessage = "El identificador admite hasta 300 caracteres")]
    public string? PublicId { get; set; }

    [EnumDataType(typeof(CatalogMediaType), ErrorMessage = "El tipo de archivo no es válido")]
    public CatalogMediaType Type { get; set; }

    public int? AttributeValueId { get; set; }
}

public class CatalogMediaOrderRequest
{
    public List<int> MediaIds { get; set; } = new();
}
