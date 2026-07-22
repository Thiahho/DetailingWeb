namespace Turneo.Api.Enterprise.WhiteLabel;

// Personalización visual white-label. Uno por tenant, opcional — sin fila acá
// el frontend usa los colores/tipografía por defecto de Turneo.
public class Theme : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public string PrimaryColor { get; set; } = "#7c3aed";
    public string? SecondaryColor { get; set; }
    public string? AccentColor { get; set; }
    public string? FontFamily { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
