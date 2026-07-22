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

El frontend (Vercel) y el backend (Render) corren en hosts distintos. Cuando Next.js hace un `fetch()` server-side hacia la API, el `Host` que ve el backend es el suyo propio, no el subdominio que el usuario realmente visitó (`salon-x.Turneo.app`) — así que hay que reenviarlo explícitamente.

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

Configurar el DNS wildcard (`*.Turneo.app` o el dominio que se defina) y `Tenancy:BaseDomain` real en producción — hasta entonces no se puede probar el ruteo por subdominio real, aunque el código ya está listo para cuando exista. Esto es responsabilidad del usuario (dashboard externo, no algo que se resuelva desde el código).
