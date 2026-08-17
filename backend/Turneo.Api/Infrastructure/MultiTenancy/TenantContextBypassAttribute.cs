namespace Turneo.Api.Infrastructure.MultiTenancy;

// Marca una acción pública donde no hay un tenant ambiguo real que resolver
// por host/JWT (webhooks de terceros, resolución de Smart Tag por token) —
// TenantResolutionMiddleware la detecta y llama ICurrentTenant.SetBypass()
// en vez de intentar resolver un tenant por Host/DefaultTenantSlug, que acá
// sería incorrecto. Mismo criterio que ya usan estos controllers a nivel EF
// con IgnoreQueryFilters(), ahora también a nivel de sesión de Postgres (RLS).
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class TenantContextBypassAttribute : Attribute
{
}
