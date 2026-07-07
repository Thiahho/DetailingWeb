using Microsoft.EntityFrameworkCore;

namespace TTurnos.Api.Infrastructure.MultiTenancy;

// Resuelve el tenant de la request, en este orden:
//   1. Claim "tenant_id" del JWT (usuarios autenticados: Admin/Professional/Client).
//   2. Header "X-Tenant-Host" (rutas públicas anónimas proxeadas por el frontend
//      Next.js — ver src/lib/tenantHeader.ts). El frontend corre en un host
//      distinto al backend (Vercel vs. Render), así que Request.Host acá adentro
//      es el del backend, no el subdominio que el usuario realmente visitó; el
//      frontend nos pasa ese dato explícito en este header dedicado (no usamos
//      el X-Forwarded-Host estándar para no pisarnos con el que ya agrega el
//      proxy de Render delante de esta API).
//   3. Host de la request directa (llamadas a la API sin pasar por el proxy del
//      frontend: Postman, apps móviles futuras, etc.).
//   4. Tenancy:DefaultTenantSlug de config — fallback para localhost/dev y para
//      mientras no todos los tenants tengan subdominio propio.
//
// Debe registrarse después de UseAuthentication() para poder leer el JWT.
public class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext context,
        CurrentTenantService currentTenant,
        ApplicationDbContext db,
        IConfiguration configuration)
    {
        var tenantClaim = context.User?.FindFirst("tenant_id")?.Value;

        if (tenantClaim is not null && int.TryParse(tenantClaim, out var tenantIdFromClaim))
        {
            currentTenant.SetTenant(tenantIdFromClaim);
        }
        else
        {
            var host = context.Request.Headers["X-Tenant-Host"].FirstOrDefault()
                ?? context.Request.Host.Host;
            var slug = ResolveSlugFromHost(host, configuration);

            if (slug is not null)
            {
                var tenantId = await db.Tenants
                    .AsNoTracking()
                    .Where(t => t.Slug == slug)
                    .Select(t => t.Id)
                    .FirstOrDefaultAsync();

                if (tenantId != 0)
                    currentTenant.SetTenant(tenantId);
            }
        }

        await next(context);
    }

    private static string? ResolveSlugFromHost(string host, IConfiguration configuration)
    {
        var baseDomain = configuration["Tenancy:BaseDomain"];

        if (!string.IsNullOrEmpty(baseDomain) &&
            host.EndsWith("." + baseDomain, StringComparison.OrdinalIgnoreCase))
        {
            var sub = host[..^(baseDomain.Length + 1)];
            if (!string.IsNullOrEmpty(sub) && !sub.Equals("www", StringComparison.OrdinalIgnoreCase))
                return sub;
        }

        return configuration["Tenancy:DefaultTenantSlug"];
    }
}
