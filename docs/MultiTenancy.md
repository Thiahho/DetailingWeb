# Multi-tenancy

Ver la decisión de diseño completa en [ADR-002](adr/ADR-002-MultiTenancy.md) y [ADR-003](adr/ADR-003-TenantId.md) (por qué `TenantId` es `int`, no `Guid`).

## Modelo

Cada negocio registrado es un `Tenant` (`SaaS/Tenants/Tenant.cs`, `int Id`). Todas las entidades de `Core` (y las de `SaaS`/`Enterprise` que pertenecen a un tenant puntual) tienen `TenantId` e implementan `ITenantScoped` (`Shared/Interfaces`).

`ApplicationDbContext`:
- Aplica `HasQueryFilter(e => e.TenantId == _currentTenant.TenantId)` a cada entidad `ITenantScoped` — ningún endpoint puede ver o modificar datos de otro tenant por accidente.
- Un override de `SaveChanges`/`SaveChangesAsync` completa `TenantId` automáticamente en cada entidad nueva (leyendo `ChangeTracker.Entries<ITenantScoped>()`), así ningún Controller/Service tiene que acordarse de setearlo a mano.

## Resolución del tenant actual

`Infrastructure/MultiTenancy/{CurrentTenantService, TenantResolutionMiddleware}`, registrado en el pipeline **después** de `UseAuthentication()` (necesita poder leer el claim del JWT):

1. Claim `tenant_id` del JWT — usuarios autenticados (Admin/Professional/Client). `AuthService.GenerateJwtToken` lo emite siempre.
2. Header `X-Tenant-Host` — requests públicas/anónimas proxeadas por el frontend Next.js (ver más abajo).
3. `Host` directo de la request — llamadas a la API sin pasar por el proxy del frontend.
4. `Tenancy:DefaultTenantSlug` (`appsettings.json`, valor `"legacy"` en dev) — fallback para desarrollo local y mientras no todos los tenants tengan subdominio propio en producción.

## El header `X-Tenant-Host`

El frontend y el backend corren como dos servicios separados en Render. Cuando Next.js hace un `fetch()` server-side hacia la API, el `Host` que ve el backend es el suyo propio, no el subdominio que el usuario realmente visitó (`salon-x.turneobelleza.com`) — así que hay que reenviarlo explícitamente.

- `frontend/Turneo-web/src/lib/tenantHeader.ts` lee `request.headers.get("host")` y lo devuelve como `{ "X-Tenant-Host": host }`.
- Las 24 rutas proxy en `app/api/**/route.ts` lo incluyen en cada `fetch()` hacia el backend.
- **No se usa el header estándar `X-Forwarded-Host`** a propósito — el proxy de Render delante de la API también podría escribir ese header con su propia información de la cadena de proxies, generando ambigüedad. Un header dedicado sin significado estándar evita la colisión.
- La única ruta que **no** lo lleva es el webhook de MercadoPago (`app/api/payments/webhook/mercadopago`) — lo llama MercadoPago directo, no el navegador, así que no hay "host real del usuario" que reenviar. Ver más abajo cómo se resuelve el tenant ahí.

## Jobs y webhooks sin tenant ambiental

Los background jobs (`ReminderBackgroundService`, `NotificationRetryBackgroundService`, `HangfireReminderJob`) y el webhook de MercadoPago corren fuera de cualquier request HTTP — no hay middleware que les resuelva un tenant. Si sus queries usaran el filtro global tal cual, verían `TenantId == 0` (sin resolver) y devolverían vacío para **todos** los tenants, rompiendo silenciosamente reminders/notificaciones/pagos.

Solución aplicada en cada uno: `.IgnoreQueryFilters()` en las queries que necesitan ver datos de todos los tenants (por diseño, no por error), y seteo explícito de `TenantId` (tomado de la entidad relacionada ya cargada, ej. `booking.TenantId`) al crear cualquier entidad nueva ahí — el auto-stamp de `SaveChanges` no sirve en este contexto porque no hay tenant ambiental del que copiarlo.

## Verificación

Probado end-to-end contra la base local:
- Subdominio inexistente → respuesta vacía (aislamiento real, no un fallback que coincide por casualidad).
- Subdominio real → datos correctos de ese tenant.
- Sin header (`localhost`, dev) → cae al fallback `Tenancy:DefaultTenantSlug`.

## Pendiente

Configurar el DNS wildcard `*.turneobelleza.com` en producción. Es responsabilidad del usuario (paneles externos, no se resuelve desde el código). Hasta entonces el ruteo por subdominio no se puede probar en producción.

Lo que ya está hecho en el código (2026-11-03, ver `odd/tasks/tenant-subdomain-rules.md`):
- Los slugs nuevos deben ser etiquetas DNS válidas (3–63 caracteres, `a-z0-9` y guiones) y no pueden ser nombres reservados (`www`, `api`, `admin`, `legacy`…) — `SaaS/Tenants/TenantSlugRules.cs`.
- Un subdominio del dominio base sin negocio detrás responde 404 en vez de seguir sin tenant.

Pasos pendientes (dominio en Cloudflare, frontend y backend en Render):
1. Render, servicio del **frontend** → Custom Domains: agregar `turneobelleza.com` y `*.turneobelleza.com` (Render exige que la raíz también apunte a Render).
2. Cloudflare DNS, todos en **DNS only** (nube gris), con `<front>` = subdominio `.onrender.com` del frontend:
   - `CNAME @ → <front>.onrender.com`
   - `CNAME * → <front>.onrender.com`
   - `CNAME _acme-challenge → <front>.verify.renderdns.com`
   - `CNAME _cf-custom-hostname → <front>.hostname.renderdns.com`
   - Sin registros AAAA; si hay CAA, permitir `letsencrypt.org` y `pki.goog` (también `issuewild`).
3. Variables: backend `Tenancy__BaseDomain=turneobelleza.com`; frontend `NEXT_PUBLIC_TENANCY_BASE_DOMAIN=turneobelleza.com` (se lee en el build: redeploy).
4. Verify en Render; probar `<slug>.turneobelleza.com` (muestra ese negocio) y `nada.turneobelleza.com` (404).
5. Revisar que los slugs ya existentes en producción cumplan `TenantSlugRules`.

Pendiente relacionado: `Notifications:CancellationBaseUrl` es un link fijo a `www.turneobelleza.com/cancelar`; con más de un negocio probablemente deba armarse con el subdominio de cada uno (a verificar).
