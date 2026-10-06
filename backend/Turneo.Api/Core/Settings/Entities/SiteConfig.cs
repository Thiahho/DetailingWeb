using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Settings;

[Table("SiteConfigs")] 
public class SiteConfig : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string BusinessName { get; set; } = string.Empty;
    public string WhatsAppNumber { get; set; } = string.Empty;
    public string InstagramUrl { get; set; } = string.Empty;
    public string InstagramHandle { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string LocationShort { get; set; } = string.Empty;
    // URL de "Insertar un mapa" de Google Maps (o el <iframe> completo, se parsea el src).
    public string? MapEmbedUrl { get; set; }
    public string SiteUrl { get; set; } = string.Empty;
    public string LogoUrl { get; set; } = string.Empty;
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroSubtitle { get; set; } = string.Empty;
    public string HeroBadge { get; set; } = string.Empty;
    // Bullets curados a mano para la tarjeta de portada del sitio público — reemplaza
    // el default anterior de tomar los primeros 2 Services (se volvía un choclo con
    // muchos servicios cargados). Vacío => el frontend cae de nuevo a ese default.
    public List<string> HeroHighlights { get; set; } = new();
    // Fotos del local (URLs de Cloudinary, en el orden que eligió el admin) para el
    // bloque "El local" de "Sobre nosotros" en el sitio público.
    public List<string> LocalPhotos { get; set; } = new();
    public string MetaDescription { get; set; } = string.Empty;
    // Destino de la acción REVIEW de Smart Tag para calificaciones altas (docs/NFC.md CU-03).
    public string? GoogleReviewUrl { get; set; }
    // Place ID de Google Maps del negocio, para traer sus reseñas reales vía
    // Google Places API (GooglePlacesService) y mostrarlas en el sitio público.
    public string? GooglePlaceId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
