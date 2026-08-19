namespace Turneo.Api.Core.Loyalty;

// Un giro/premio ganado por un cliente del negocio. Independiente de
// CustomerProfile a propósito (mismo criterio que RouletteLead): el cliente
// puede girar la ruleta antes de tener ficha propia, identificado solo por
// WhatsApp — un giro por WhatsApp por tenant (ver índice único en DbContext).
public class LoyaltySpin : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public required string CustomerName { get; set; }
    public required string WhatsApp { get; set; }

    public int PrizeId { get; set; }
    public LoyaltyPrize? Prize { get; set; }

    public required string Code { get; set; }
    public DateTime SpunAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }

    public LoyaltySpinStatus Status { get; set; } = LoyaltySpinStatus.Pending;
    public DateTime? RedeemedAt { get; set; }
    public int? RedeemedByUserId { get; set; }
}
