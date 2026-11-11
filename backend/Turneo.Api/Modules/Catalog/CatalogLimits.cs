namespace Turneo.Api.Modules.Catalog;

// Column sizes and request limits shared by the model, the validators and the
// variant generator, so a value accepted by the API always fits its column.
public static class CatalogLimits
{
    public const int CategoryNameMaxLength = 120;
    public const int CategorySlugMaxLength = 140;
    public const int AttributeNameMaxLength = 80;
    public const int AttributeSlugMaxLength = 100;
    public const int ValueLabelMaxLength = 80;
    public const int ProductNameMaxLength = 160;
    public const int ProductSlugMaxLength = 180;
    public const int DescriptionMaxLength = 2000;
    public const int MediaUrlMaxLength = 1000;
    public const int MediaPublicIdMaxLength = 300;

    // Bounds the combination key: at most this many value ids of up to 10 digits.
    public const int MaxAttributesPerCategory = 10;
    public const int MaxAllowedValuesPerProduct = 500;
    public const int CombinationKeyMaxLength = 180;
    public const int SkuMaxLength = 200;
}
