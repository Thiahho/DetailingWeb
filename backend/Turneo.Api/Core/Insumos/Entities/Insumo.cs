using System.ComponentModel.DataAnnotations.Schema;

namespace Turneo.Api.Core.Insumos;

[Table("Insumos")]
public class Insumo : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Stock { get; set; }
    public int LowStockThreshold { get; set; }
    // Cuándo LowStockAlertJob avisó por primera vez que este insumo cayó a/bajo
    // el umbral, sin reponerse desde entonces. Null = no está en alerta (o se
    // acaba de reponer). Sirve para cortar el aviso diario a los 3 días
    // seguidos sin reposición, en vez de insistir indefinidamente por el mismo
    // canal (Telegram) que también avisa turnos nuevos.
    public DateTime? LowStockAlertedSince { get; set; }
    public decimal UnitCost { get; set; }
    public bool IsActive { get; set; } = true;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
