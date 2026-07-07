namespace TTurnos.Api.SaaS.Tenants;

public class Tenant
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }

    // Rubro que usa este tenant — coincide con el nombre de una carpeta en Modules/ (Beauty, Restaurant, ...)
    public required string Vertical { get; set; }

    public CommercialModel CommercialModel { get; set; }
    public TenantStatus Status { get; set; } = TenantStatus.Active;

    // Plan vigente — gobierna los límites (SaaS/Features) sin importar el
    // modelo comercial. Nullable: un tenant sin plan asignado no se bloquea
    // (fail-open), ver PlanLimitsService.
    public int? PlanId { get; set; }
    public Plan? Plan { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? TrialEndsAt { get; set; }
}
