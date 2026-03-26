using System.ComponentModel.DataAnnotations.Schema;

namespace DetailingApi.Models;

[Table("ContentVideos")]
public class ContentVideo
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
