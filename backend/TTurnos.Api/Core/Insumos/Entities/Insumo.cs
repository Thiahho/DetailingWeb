using System.ComponentModel.DataAnnotations.Schema;

namespace TTurnos.Api.Core.Insumos;

[Table("Insumos")]
public class Insumo : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Stock { get; set; }
    public int LowStockThreshold { get; set; }
    public decimal UnitCost { get; set; }
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
