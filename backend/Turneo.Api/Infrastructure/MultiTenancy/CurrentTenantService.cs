namespace Turneo.Api.Infrastructure.MultiTenancy;

// Instancia scoped (una por request). TenantResolutionMiddleware la completa
// al principio del pipeline; ApplicationDbContext la lee para el query filter
// (aislamiento a nivel aplicación) y TenantSessionInterceptor la lee para
// propagar el tenant actual a la sesión de Postgres vía "SET app.tenant_id"
// (aislamiento a nivel base de datos, Row Level Security).
public class CurrentTenantService : ICurrentTenant
{
    public int TenantId { get; private set; }
    public bool IsResolved { get; private set; }
    public bool IsBypassed { get; private set; }

    public void SetTenant(int tenantId)
    {
        TenantId = tenantId;
        IsResolved = true;
    }

    // Para los pocos puntos legítimos sin un tenant ambiguo real: webhooks
    // públicos, resolución de Smart Tag por token, jobs en background que
    // procesan todos los tenants a propósito, y el panel de PlatformOwner.
    // Le dice a TenantSessionInterceptor que setee 'bypass' en vez de un
    // TenantId — la policy de RLS de cada tabla lo reconoce explícitamente.
    public void SetBypass()
    {
        IsBypassed = true;
        IsResolved = true;
    }
}
