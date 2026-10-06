using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Content;

[Table("ContentVideos")]
public class ContentVideo : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Title { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    // Posteo original (reel/post de Instagram o TikTok) al que lleva la preview
    // del sitio público. Null => la card no es un link.
    public string? LinkUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
