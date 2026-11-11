using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Modules.Catalog;

public enum CatalogMediaType
{
    Image = 0,
    Video = 1,
}

// A photo or video of a product, already uploaded to Cloudinary by the admin
// frontend: the API only stores its URL and public id.
[Table("CatalogMedia")]
public class CatalogMedia : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int ProductId { get; set; }
    public CatalogProduct Product { get; set; } = null!;
    // When set, the media shows that value (e.g. the red color).
    public int? AttributeValueId { get; set; }
    public CatalogAttributeValue? AttributeValue { get; set; }
    public CatalogMediaType Type { get; set; }
    public string Url { get; set; } = string.Empty;
    public string? PublicId { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
