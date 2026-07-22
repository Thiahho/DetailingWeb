namespace Turneo.Api.Modules.Beauty.Treatments;

// Extensión Beauty-specific de un Service genérico de Core (relación 1:1).
// Core nunca sabe que esto existe — Bookings sigue referenciando solo
// ServiceId. Cuando aparezca otro rubro (Gastronomía, Salud), cada uno
// agrega su propia extensión análoga sin tocar Core ni Bookings.
public class Treatment : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public int ServiceId { get; set; }
    public Service? Service { get; set; }

    public string? Category { get; set; }
    public string? EstimatedProducts { get; set; }
    public int? SessionCount { get; set; }
    public bool RequiresBeforeAfter { get; set; }
    public bool RequiresConsent { get; set; }
    public string? Notes { get; set; }
}
