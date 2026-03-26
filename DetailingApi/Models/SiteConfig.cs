namespace DetailingApi.Models;

public class SiteConfig
{
    public int Id { get; set; }
    public string BusinessName { get; set; } = string.Empty;
    public string WhatsAppNumber { get; set; } = string.Empty;
    public string InstagramUrl { get; set; } = string.Empty;
    public string InstagramHandle { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string LocationShort { get; set; } = string.Empty;
    public string SiteUrl { get; set; } = string.Empty;
    public string LogoUrl { get; set; } = string.Empty;
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroSubtitle { get; set; } = string.Empty;
    public string HeroBadge { get; set; } = string.Empty;
    public string MetaDescription { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
