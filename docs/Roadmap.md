# Roadmap y estado del proyecto

> No confundir con [`TTurnosRoadmap.md`](TTurnosRoadmap.md) — ese es el PRD funcional del vertical Belleza (qué pantallas, qué flujos). Este documento es sobre la arquitectura de plataforma (Core/Modules/SaaS/Enterprise). Para el estado operativo/de seguridad más reciente, ver siempre [`auditoria_0510.md`](auditoria_0510.md) primero — este documento se actualiza con menos frecuencia.

## Estado actual

### ✅ Implementado

- **Core**: reorganizado por dominio y por feature (`Entities/`, `DTOs/`, `Controllers/`, `Services/`) — hoy son 21 dominios, no solo los del roadmap original: Auth, Users, Roles (permisos granulares de Staff), Bookings, Scheduling, Professionals, Services, Settings, Clients, Notifications, Payments, **Caja**, Products, **Insumos**, Content, **Reviews**, Reports, **Automations**, **SmartTags**, **Loyalty**, **Platform**.
- **Multi-tenancy**: aislamiento por `TenantId` vía query filter de EF Core, resolución por JWT/header/subdominio, verificado end-to-end. **Row Level Security a nivel Postgres** (migración `EnableRowLevelSecurity`) como segunda capa por debajo del query filter. Ver [MultiTenancy](MultiTenancy.md).
- **SaaS**: `Tenant`, `Plan`, `Subscription`, `License`, `Usage`, `Features` — catálogo de planes real (Free/Starter/Pro/Business/Licencia/Custom, reseedeado 21/07), enforcement conectado en 7 puntos (no solo `MaxProfessionals`). Ver [Plans](Plans.md) y [Features](Features.md).
- **Beauty** (único módulo de rubro con código): `Treatments`, `BeforeAfter`. Ver [Modules](Modules.md).
- **Enterprise (base)**: entidades `Branch` y `Theme` existen, sin conectar a `Core` todavía. Ver [Enterprise](Enterprise.md).
- **Módulos de negocio nuevos, fuera del alcance del roadmap de 11 fases original** (construidos entre julio y agosto, no documentados acá hasta ahora): **Caja** (apertura/cierre diario y mensual, cobros/señas/devoluciones), **Insumos** (inventario + receta por servicio + descuento automático de stock), **Reviews** (reseñas propias + Google Places), **Automatizaciones** (reactivación de clientes, motor de reglas), **SmartTags** (NFC/QR físico → reserva/reseña), **Loyalty** (ruleta de fidelización para clientes del negocio), **Marketing/Roulette** (ruleta de captación de leads, propia de Turneo), **Platform** (backoffice de `PlatformOwner`: alta de tenants, takedown de contenido).
- **Ruletas (frontend)**: `/ruleta` (captación de Turneo) y `/beneficios` (fidelización del negocio) comparten el componente visual `src/components/public/roulette/RouletteShared.tsx` (rueda SVG, marco, encabezado, tarjetas); cada una conserva su flujo y su backend.
- **Rate limiting**: políticas `"auth"` (5/min), `"public-booking"` (20/min), `"payments-webhook"` (60/min), `"public-read"` — cubren también los endpoints nuevos.
- **Permisos granulares de Staff**: rol `Staff` con acceso módulo por módulo (`ModulePermission`, `/admin/permisos`), además de Admin/Professional/Client.

### 🟡 En desarrollo / parcial

- **Enforcement de planes**: 7 de 11 features conectados (`MaxProfessionals`, `MaxBookings`, `MaxServices`, `MaxClients`, `CanUseAutomations`, `CanUseMercadoPago`, `CanUseWhatsapp`) — falta `MaxBranches`, `MaxAdmins` (sembrado sin uso a propósito) y `CanUseAI` (sin ninguna función de IA implementada todavía). Es además **fail-open** por diseño — ver [Features](Features.md).
- **Enterprise real**: `Branch` no tiene `BranchId` en las entidades de `Core` (no filtra agenda por sucursal todavía); `Theme` no lo consume el frontend; `Audit/` y `API/` son esqueleto vacío.
- **Beauty**: `Memberships/` y `Products/` son carpetas vacías, sin modelo de datos (requieren definición de negocio primero).
- **Multi-tenancy en producción**: el mecanismo está implementado y probado localmente, pero falta configurar el DNS wildcard real — sin eso, el ruteo por subdominio no se puede probar en producción. Hoy hay 1 solo tenant real (`legacy`).
- **Permisos de Staff**: Insumos y Productos ya tienen tests de integración que confirman el `403` sin permiso y el `2xx` con permiso (9 casos, 05/10); el resto de los módulos sigue sin test dedicado.

### ⏳ Roadmap (sin iniciar)

- **Nuevos módulos de rubro**: `Modules/Restaurant`, `Modules/Medical`, `Modules/Veterinary`, `Modules/Gym`, `Modules/Automotive` — carpetas vacías, sin ninguna entidad.
- **SaaS/Billing**: carpeta completamente vacía — `Subscription`/`License`/`UsageRecord` son tablas sin ninguna línea de código que las escriba. No hay ninguna forma de cobrarle la suscripción al dueño del negocio dentro del sistema; depende hoy de venta asistida por WhatsApp y alta manual por `PlatformOwner`.
- **Alta de negocio self-service**: no existe — `POST /api/platform/tenants` es exclusivo de `PlatformOwner`. `POST /api/auth/register` ya no es anónimo: solo lo permite `Auth:AllowOpenRegistration=true` (entorno de tests) o un Admin autenticado, y crea un usuario dentro de un tenant ya existente, no un negocio nuevo.
- **Custom**: sin carpetas por cliente todavía (`Custom/ClienteA`, etc., del roadmap original).
- **Precios reales por plan**: los límites de cada `Plan` están sembrados con valores de partida razonables, pero `PriceMonthly`/`PriceYearly` siguen en `null` en los 6 planes — decisión de negocio pendiente.

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
| 11 | Nuevos módulos | ⏳ Sin iniciar (salvo los módulos de negocio fuera de este roadmap, ver "Implementado" arriba) |

Estas 10 fases ya están commiteadas a git desde hace tiempo — la nota anterior sobre cambios "staged sin commitear" quedó obsoleta.
