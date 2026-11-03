using Microsoft.EntityFrameworkCore;

namespace Turneo.Api.Infrastructure.MultiTenancy;

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
        // PlatformOwner opera cruzando todos los tenants (alta de tenants,
        // takedown de contenido) — sin esto caería al DefaultTenantSlug por
        // fallback, que ya era semánticamente incorrecto a nivel EF (por eso
        // esos controllers usan IgnoreQueryFilters()) y rompería RLS directo
        // (la policy filtraría todo a un tenant que no es el que se quiere tocar).
        var isPlatformOwner = context.User?.IsInRole("PlatformOwner") ?? false;
        var hasExplicitBypass = context.GetEndpoint()?.Metadata.GetMetadata<TenantContextBypassAttribute>() is not null;

        if (isPlatformOwner || hasExplicitBypass)
        {
            currentTenant.SetBypass();
            await next(context);
            return;
        }

        var tenantClaim = context.User?.FindFirst("tenant_id")?.Value;

        if (tenantClaim is not null && int.TryParse(tenantClaim, out var tenantIdFromClaim))
        {
            currentTenant.SetTenant(tenantIdFromClaim);
        }
        else
        {
            var host = context.Request.Headers["X-Tenant-Host"].FirstOrDefault()
                ?? context.Request.Host.Host;
            var (slug, fromSubdomain) = ResolveSlugFromHost(host, configuration);

            if (slug is not null)
            {
                // Esta query es la primera que toca la base en requests anónimas —
                // abre la conexión física y dispara TenantSessionInterceptor ANTES
                // de que sepamos el tenant, dejando la sesión en "app.tenant_id='0'"
                // (default de CurrentTenantService) para el resto de la request.
                var tenantId = await db.Tenants
                    .AsNoTracking()
                    .Where(t => t.Slug == slug)
                    .Select(t => t.Id)
                    .FirstOrDefaultAsync();

                if (tenantId != 0)
                {
                    currentTenant.SetTenant(tenantId);

                    // Re-aplicar en la conexión ya abierta: el interceptor no vuelve a
                    // correr solo porque cambiamos CurrentTenantService en memoria. Sin
                    // este SET, todo lo que siga en esta request (incluida la query o el
                    // insert que dispare el controller) queda bloqueado por RLS aunque el
                    // query filter de EF esté apuntando al tenant correcto.
                    // tenantId es un int devuelto por la propia query de arriba, nunca texto
                    // de usuario — mismo criterio que TenantSessionInterceptor.
#pragma warning disable EF1002
                    await db.Database.ExecuteSqlRawAsync($"SET app.tenant_id = '{tenantId}'");
#pragma warning restore EF1002
                }
                else if (fromSubdomain)
                {
                    // Subdominio real del dominio base sin tenant detrás: cortar acá
                    // con 404 en vez de seguir con tenant 0 (sitio vacío, writes que
                    // fallan con 500). El fallback DefaultTenantSlug no entra acá.
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    await context.Response.WriteAsJsonAsync(new { message = "Negocio no encontrado" });
                    return;
                }
            }
        }

        await next(context);
    }

    // FromSubdomain = true solo cuando el slug salió de un subdominio de
    // Tenancy:BaseDomain; false cuando es el fallback DefaultTenantSlug.
    private static (string? Slug, bool FromSubdomain) ResolveSlugFromHost(string host, IConfiguration configuration)
    {
        var baseDomain = configuration["Tenancy:BaseDomain"];

        if (!string.IsNullOrEmpty(baseDomain) &&
            host.EndsWith("." + baseDomain, StringComparison.OrdinalIgnoreCase))
        {
            // Los hosts no distinguen mayúsculas y los slugs se guardan en minúscula.
            var sub = host[..^(baseDomain.Length + 1)].ToLowerInvariant();

            // Los subdominios reservados (api, admin, ...) nunca son tenants: se
            // mantiene el comportamiento previo (sin 404) para no cortar llamadas
            // directas si el backend vive en uno de ellos (ej. api.<BaseDomain>).
            if (!string.IsNullOrEmpty(sub) && sub != "www")
                return (sub, !TenantSlugRules.IsReserved(sub));
        }

        return (configuration["Tenancy:DefaultTenantSlug"], false);
    }
}
