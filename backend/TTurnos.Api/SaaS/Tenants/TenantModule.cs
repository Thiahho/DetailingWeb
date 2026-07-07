namespace TTurnos.Api.SaaS.Tenants;

// Tabla puente: qué módulo(s) tiene habilitado cada tenant.
public class TenantModule : ITenantScoped
{
    public int Id { get; set; }

    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public int ModuleId { get; set; }
    public Module? Module { get; set; }

    public DateTime EnabledAt { get; set; } = DateTime.UtcNow;
}
