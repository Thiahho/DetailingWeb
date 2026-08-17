namespace Turneo.Api.Core.SmartTags;

// Etiqueta física (NFC o QR) que apunta a /s/{Token}. La etiqueta en sí no
// conoce la acción: Turneo la resuelve en el momento a partir de este
// registro, así que cambiar Action no requiere reemplazar la etiqueta física
// (ver docs/NFC.md sección 6).
public class SmartTag : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public string Token { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string Action { get; set; } = SmartTagAction.Booking;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
