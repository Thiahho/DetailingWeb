namespace Turneo.Api.SaaS.Usage;

// Consumo agregado por tenant y período, para hacer cumplir los límites del Plan
// (ej. Metric = "bookings_created", Period = primer día del mes que agrupa).
public class UsageRecord : ITenantScoped
{
    public long Id { get; set; }

    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public required string Metric { get; set; }
    public DateTime Period { get; set; }
    public int Count { get; set; }
}
