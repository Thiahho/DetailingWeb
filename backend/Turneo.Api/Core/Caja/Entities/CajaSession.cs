using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Caja;

[Table("CajaSessions")]
public class CajaSession : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public int OpenedByUserId { get; set; }
    public decimal OpeningCashBalance { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ClosedByUserId { get; set; }
    public decimal? ClosingCashCounted { get; set; }
    public string Status { get; set; } = CajaSessionStatus.Open;
    public string? Notes { get; set; }
    public ICollection<CajaMovement> Movements { get; set; } = new List<CajaMovement>();
}
