# Turneo — Plataforma de Reservas y Gestión Multi-Rubro

**Versión:** 1.0.0-alpha

**Estado:** ✔ Arquitectura estable · ✔ Multi-tenant · ✔ SaaS base · 🚧 Nuevos módulos en desarrollo

Plataforma web full-stack de reservas online y administración de negocio, con **varios profesionales trabajando en simultáneo, cada uno con su propia agenda**. Los clientes reservan turno solos desde la web; el negocio gestiona todo — turnos, equipo, servicios, contenido y configuración — desde un panel centralizado.

> Nacida como sistema de detailing automotriz, reorientada primero a salones de belleza, y hoy arquitectada como plataforma **multi-tenant y multi-rubro**: una única base de código sirve tres modelos comerciales (SaaS por suscripción, licencia perpetua, desarrollo a medida) y cualquier vertical con turnos, sin tocar el núcleo del sistema.

```
   Core            dominio agnóstico de rubro (Bookings, Services, Professionals, ...)
     ↓
   Modules         extensiones de cada rubro (Beauty implementado; Restaurant, Medical, ... en roadmap)
     ↓
   SaaS            tenants, planes, suscripciones
     ↓
   Enterprise      sucursales, whitelabel
     ↓
   Custom          desarrollos a medida sobre la misma base
```

Cada capa depende solo de la anterior — `Core` nunca importa nada de `Modules`/`SaaS`/`Enterprise`. Detalle completo, reglas de dependencia y cómo decidir dónde va cada funcionalidad nueva: **[docs/Architecture.md](docs/Architecture.md)**.

---

## Estado del proyecto

| | |
|---|---|
| ✅ **Implementado** | Core (reorganizado por dominio/feature), Multi-tenancy, SaaS (Tenants/Plans/Features), módulo Beauty (Treatments, BeforeAfter), base de Enterprise |
| 🟡 **En desarrollo** | Enforcement de límites de plan (solo `MaxProfessionals` conectado), Enterprise real (Branches sin conectar a Core), Beauty (Memberships/Products sin implementar) |
| ⏳ **Roadmap** | Módulos Restaurant/Medical/Veterinary/Gym/Automotive, SaaS/Billing, Custom, precios reales por plan |

Detalle fase por fase: **[docs/Roadmap.md](docs/Roadmap.md)**.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router, React 18) + TypeScript + TailwindCSS |
| Backend | ASP.NET Core (.NET 9) + Entity Framework Core |
| Base de datos | PostgreSQL |
| Autenticación | JWT Bearer + cookies HttpOnly (roles: Admin, Professional, Client) |
| Pagos | MercadoPago (ARS) — opcional, no bloquea el flujo de reserva |
| Imágenes | Cloudinary (CDN, upload directo desde el navegador) |
| Notificaciones | Email (Gmail SMTP / MailKit) + WhatsApp (Meta API) |
| Jobs en background | Hangfire (recordatorios, reintentos de notificación) |
| Multi-tenancy | Aislamiento por `TenantId` + EF Core global query filter, resuelto por subdominio |

---

## Lo que ofrece

**Para el dueño del negocio:** un panel único donde administrar el equipo completo, la agenda de cada profesional, los servicios, el contenido del sitio y la configuración de marca — sin depender de un desarrollador para cambios de todos los días.

**Para cada profesional:** su propio login y su propia agenda (`/profesional`), donde carga sus horarios disponibles y ve sus turnos, sin ver ni tocar lo que no le corresponde.

**Para el cliente:** reservar un turno 24/7 sin llamar ni escribir por WhatsApp, eligiendo servicio, profesional (o "sin preferencia") y horario, con confirmación inmediata y gestión propia de sus reservas.

Detalle de todas las funciones (reserva pública, portal del cliente, panel admin, área del profesional, notificaciones, SEO): **[docs/API.md](docs/API.md)**.

---

## Correr en local

```bash
# Frontend
cd frontend/Turneo-web
npm install
npm run dev          # http://localhost:3000

# Backend
cd backend/Turneo.Api
dotnet run --urls http://localhost:5048
```

Las migraciones de base de datos se generan con `dotnet ef migrations add` y se aplican automáticamente al arrancar la API (`Database.Migrate()` en `Program.cs`), igual que el catálogo de planes (`SaaSCatalogSeeder`).

En local no hay subdominios, así que el tenant se resuelve por `Tenancy:DefaultTenantSlug` (`appsettings.json`, valor `"legacy"`) — no hace falta configurar nada extra para desarrollar.

---

## Objetivo

Construir una única plataforma capaz de operar bajo tres modelos — **SaaS**, **Licencia** y **Desarrollo personalizado** — compartiendo el mismo `Core` y minimizando la divergencia de código entre ellos.

---

## Documentación

| Documento | Contenido |
|---|---|
| [docs/Architecture.md](docs/Architecture.md) | Capas, dependencias permitidas, principios, árbol de decisión "dónde va esto", estructura del proyecto |
| [docs/MultiTenancy.md](docs/MultiTenancy.md) | Aislamiento por `TenantId`, resolución de tenant, header `X-Tenant-Host`, jobs sin tenant ambiental |
| [docs/Plans.md](docs/Plans.md) | Modelos comerciales, `Plan`, `Subscription`, `License`, planes seedeados |
| [docs/Features.md](docs/Features.md) | Feature flags y límites, `IPlanLimitsService`, estado del enforcement |
| [docs/Modules.md](docs/Modules.md) | Regla Core/Module, estado del módulo Beauty, módulos en roadmap |
| [docs/Enterprise.md](docs/Enterprise.md) | Branches, WhiteLabel, qué falta conectar |
| [docs/Security.md](docs/Security.md) | Validaciones, autenticación, roles, reglas de negocio |
| [docs/API.md](docs/API.md) | Patrón de proxy del frontend, grupos de endpoints |
| [docs/Roadmap.md](docs/Roadmap.md) | Estado del proyecto (implementado / en desarrollo / roadmap), historial de fases |
| [docs/adr/](docs/adr/) | Decisiones de arquitectura (Core/Modules, Multi-tenancy, TenantId, Feature flags, Modelos comerciales) |
| [docs/auditoria_0510.md](docs/auditoria_0510.md) | Auditoría vigente (05/10, solo código): inventario, seguridad, rediseño de ruletas, correcciones aplicadas y pendientes por prioridad |
| [docs/auditoria_0109.md](docs/auditoria_0109.md) | Auditoría anterior (01/09): sigue vigente para modelo comercial y segmento de mercado |
