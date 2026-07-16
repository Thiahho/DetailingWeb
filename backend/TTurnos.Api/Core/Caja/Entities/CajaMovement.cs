using System.ComponentModel.DataAnnotations.Schema;

namespace TTurnos.Api.Core.Caja;

[Table("CajaMovements")]
public class CajaMovement : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int CajaSessionId { get; set; }
    public CajaSession CajaSession { get; set; } = null!;
    public string Type { get; set; } = CajaMovementType.Charge;
    public string Method { get; set; } = CajaMovementMethod.Cash;
    public decimal Amount { get; set; }
    public int? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public int? RefundOfMovementId { get; set; }
    public CajaMovement? RefundOfMovement { get; set; }
    public string? Description { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
