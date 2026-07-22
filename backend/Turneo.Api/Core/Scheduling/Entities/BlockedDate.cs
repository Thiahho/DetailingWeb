namespace Turneo.Api.Core.Scheduling;
using System.ComponentModel.DataAnnotations.Schema;

[Table("BlockedDates")]
public class BlockedDate : ITenantScoped
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public DateTime Date { get; set; }
    public string? Reason { get; set; }
    public bool IsRecurring { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Null = bloquea todo el negocio (comportamiento actual). Con valor, solo ese profesional.
    public int? ProfessionalId { get; set; }
    public Professional? Professional { get; set; }
}