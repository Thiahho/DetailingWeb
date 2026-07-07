# ADR-002 — Estrategia de aislamiento multi-tenant

**Estado:** Aceptada — 2026-07-07

## Problema

El modelo SaaS necesita que muchos negocios (tenants) compartan la misma aplicación sin que ninguno pueda ver o modificar datos de otro. Había que elegir una estrategia de aislamiento que además funcionara sin cambios para los modelos License y Custom, donde cada cliente corre su propio deploy con su propia base.

## Opciones consideradas

1. **Base de datos separada por tenant.** Aislamiento total, pero cada release hay que migrar N bases, y provisionar un tenant nuevo implica crear infraestructura. Sobrecarga operativa alta para un SaaS con muchos tenants chicos (salones).
2. **Schema separado por tenant (mismo Postgres).** Aislamiento fuerte, pero EF Core no soporta bien el schema dinámico por request sin un runner de migraciones custom, y sigue habiendo que migrar N schemas.
3. **Base compartida + columna `TenantId` + filtro global de EF Core.** Una sola base, un tenant nuevo es una fila. El aislamiento lo garantiza el `HasQueryFilter` a nivel de modelo, no la disciplina de cada desarrollador escribiendo `WHERE TenantId = ...` a mano en cada query.

## Decisión

Opción 3. Todas las entidades de `Core` (y las de `SaaS`/`Enterprise` que son propiedad de un tenant) implementan `ITenantScoped` (`Shared/Interfaces`) y tienen `TenantId`. `ApplicationDbContext` aplica `HasQueryFilter(e => e.TenantId == _currentTenant.TenantId)` a cada una — ninguna query puede "olvidarse" del filtro porque no hay opción de omitirlo salvo `IgnoreQueryFilters()` explícito.

Un `SaveChanges`/`SaveChangesAsync` override completa `TenantId` automáticamente en cada entidad nueva (`ChangeTracker.Entries<ITenantScoped>()`), así tampoco hace falta acordarse de setearlo al crear un registro.

**Resolución del tenant actual por request**, en este orden:
1. Claim `tenant_id` del JWT (usuarios autenticados).
2. Header `X-Tenant-Host` (requests públicas proxeadas por el frontend Next.js — ver por qué no se usa `X-Forwarded-Host` estándar más abajo).
3. `Host` directo de la request (llamadas a la API sin pasar por el proxy).
4. `Tenancy:DefaultTenantSlug` de configuración — fallback para desarrollo local y mientras no todos los tenants tengan subdominio propio en producción.

**Por qué un header custom (`X-Tenant-Host`) y no `X-Forwarded-Host`:** el frontend (Vercel) y el backend (Render) son hosts distintos. Si Next.js reenvía el `Host` real del navegador como `X-Forwarded-Host`, hay riesgo de que el proxy de Render (que está delante de la API) también escriba/sobreescriba ese mismo header con su propia información de la cadena de proxies, generando ambigüedad. Un header dedicado sin significado estándar evita esa colisión.

**Para License/Custom:** el mismo mecanismo aplica, pero el deploy dedicado de ese cliente solo tiene un tenant en la tabla — el filtro nunca hace diferencia en la práctica. No hay una rama de código separada para "modo sin multi-tenancy".

## Consecuencias

- Ningún endpoint puede filtrar datos de otro tenant "sin querer" — verificado con un test manual: pedir un subdominio inexistente devuelve vacío, no los datos de otro tenant ni un error.
- Cualquier query o background job que necesite operar **entre** tenants (recordatorios, reintentos de notificación, webhook de MercadoPago) tiene que usar `IgnoreQueryFilters()` explícitamente y setear `TenantId` a mano al crear entidades — es un gotcha real de EF Core + global query filters, con un comentario en cada uno de esos jobs explicando por qué.
- El día que un tenant necesite aislamiento más fuerte que "misma base, filtro de query" (ej. un cliente Enterprise muy grande, requisito de compliance), la opción 1 (DB separada) sigue disponible como configuración de deploy — no requiere cambiar el modelo de datos, solo desplegar una instancia dedicada con un solo tenant, igual que License.
