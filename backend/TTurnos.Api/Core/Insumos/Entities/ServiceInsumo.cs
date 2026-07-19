using System.ComponentModel.DataAnnotations.Schema;

namespace TTurnos.Api.Core.Insumos;

// Receta de un Service: qué insumos consume y en qué cantidad. Se usa para
// auto-agregar esos insumos (con su cantidad) cuando el servicio se carga
// en el detalle de un turno, sin tener que cargarlos a mano cada vez.
[Table("ServiceInsumos")]
public class ServiceInsumo : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public int ServiceId { get; set; }
    public Service Service { get; set; } = null!;
    public int InsumoId { get; set; }
    public Insumo Insumo { get; set; } = null!;
    public int Quantity { get; set; } = 1;
}
