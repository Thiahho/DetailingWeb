# Roadmap y estado del proyecto

> No confundir con [`TurneoRoadmap.md`](TurneoRoadmap.md) — ese es el PRD funcional del vertical Belleza (qué pantallas, qué flujos). Este documento es sobre la arquitectura de plataforma (Core/Modules/SaaS/Enterprise).

## Estado actual

### ✅ Implementado

- **Core**: reorganizado por dominio y por feature (`Entities/`, `DTOs/`, `Controllers/`, `Services/`).
- **Multi-tenancy**: aislamiento por `TenantId`, resolución por JWT/subdominio, verificado end-to-end. Ver [MultiTenancy](MultiTenancy.md).
- **SaaS**: `Tenant`, `Plan`, `Subscription`, `License`, `Usage`, `Features` — catálogo de planes sembrado, enforcement de referencia (`MaxProfessionals`). Ver [Plans](Plans.md) y [Features](Features.md).
- **Beauty** (único módulo con código): `Treatments`, `BeforeAfter`. Ver [Modules](Modules.md).
- **Enterprise (base)**: entidades `Branch` y `Theme` existen, sin conectar a `Core` todavía. Ver [Enterprise](Enterprise.md).

### 🟡 En desarrollo / parcial

- **Enforcement de planes**: solo `MaxProfessionals` está conectado — falta `MaxBookings`, `MaxBranches`, `CanUseWhatsapp`, `CanUseAI`.
- **Enterprise real**: `Branch` no tiene `BranchId` en las entidades de `Core` (no filtra agenda por sucursal todavía); `Theme` no lo consume el frontend; `Audit/` y `API/` son esqueleto vacío.
- **Beauty**: `Memberships/` y `Products/` son carpetas vacías, sin modelo de datos (requieren definición de negocio primero).
- **Multi-tenancy en producción**: el mecanismo está implementado y probado localmente, pero falta configurar el DNS wildcard real — sin eso, el ruteo por subdominio no se puede probar en producción.

### ⏳ Roadmap (sin iniciar)

- **Nuevos módulos de rubro**: `Modules/Restaurant`, `Modules/Medical`, `Modules/Veterinary`, `Modules/Gym`, `Modules/Automotive` — carpetas vacías, sin ninguna entidad.
- **SaaS/Billing**: carpeta vacía, sin integración de facturación recurrente todavía (más allá de la preferencia de pago de MercadoPago para reservas).
- **Custom**: sin carpetas por cliente todavía (`Custom/ClienteA`, etc., del roadmap original).
- **Precios reales por plan**: los límites de cada `Plan` están sembrados con valores de partida razonables, pero `PriceMonthly`/`PriceYearly` siguen en `null` — decisión de negocio pendiente.

## Historial de fases (roadmap de arquitectura original)

| # | Fase | Estado |
|---|---|---|
| 1 | Renombrar proyecto (DetailingApi → Turneo.Api) | ✅ |
| 2 | Reordenar repositorio (`/backend`, `/frontend`, `/docs`, `/tools`, `/docker`) | ✅ |
| 3 | Crear Core/Infrastructure/Shared | ✅ |
| 4 | Crear Modules vacíos | ✅ |
| 5 | Agregar SaaS | ✅ |
| 6 | Agregar Tenant (modelo de datos + aislamiento) | ✅ |
| 7 | Sistema de planes (Features + enforcement de referencia) | ✅ |
| 8 | Frontend (route groups por audiencia) | ✅ |
| 9 | Base de datos (Tenant/Plan/Subscription/Module/TenantModule/Theme/Branch) | ✅ |
| 10 | Extraer Beauty como módulo | ✅ |
| 11 | Nuevos módulos | ⏳ Sin iniciar |

Ninguno de estos cambios está commiteado a git todavía — queda staged a propósito, a pedido explícito del usuario, que hace los commits él mismo.
