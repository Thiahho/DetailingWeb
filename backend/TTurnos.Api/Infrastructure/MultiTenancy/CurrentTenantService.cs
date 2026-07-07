namespace TTurnos.Api.Infrastructure.MultiTenancy;

// Instancia scoped (una por request). TenantResolutionMiddleware la completa
// al principio del pipeline; ApplicationDbContext la lee para el query filter.
public class CurrentTenantService : ICurrentTenant
{
    public int TenantId { get; private set; }
    public bool IsResolved { get; private set; }

    public void SetTenant(int tenantId)
    {
        TenantId = tenantId;
        IsResolved = true;
    }
}
