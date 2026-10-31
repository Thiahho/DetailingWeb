using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Promotions;

public enum PromotionDiscountType
{
    Percent = 0,
    FixedAmount = 1
}

// Descuento automático creado por un profesional sobre sus propios servicios.
// ServiceIds se guarda como int[] (sin tabla puente) para que RLS y el query
// filter por tenant sigan cubriendo todo con una sola tabla.
[Table("Promotions")]
public class Promotion : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int ProfessionalId { get; set; }
    public string Name { get; set; } = string.Empty;
    public PromotionDiscountType DiscountType { get; set; } = PromotionDiscountType.Percent;
    public decimal Value { get; set; }
    public List<int> ServiceIds { get; set; } = new();
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
