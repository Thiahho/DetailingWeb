# Arquitectura

Ver también las decisiones de diseño detalladas en [`docs/adr/`](adr/).

## Capas

```
Core            Dominio agnóstico de rubro. Cada dominio (Bookings, Services, Professionals,
                Scheduling, Auth, ...) se organiza por feature: Entities/, DTOs/,
                Controllers/, Services/
Modules         Extensiones específicas de cada rubro (Beauty/Treatments, Beauty/BeforeAfter,
                ...) — deben poder instalarse sin modificar Core
Infrastructure  Persistence, Integrations (Gmail, WhatsApp, MercadoPago), BackgroundJobs
                (Hangfire), Authentication (JWT), MultiTenancy, Storage
Shared          Interfaces y tipos cruzados entre capas: Abstractions, Constants, DTOs,
                Enums, Exceptions, Extensions, Helpers, Interfaces, Validators
SaaS            Tenants, Plans, Subscriptions, Licenses, Billing, Usage, Features
                (feature flags y límites por plan — no son columnas sueltas en Plan)
Enterprise      Branches (sucursales), WhiteLabel (personalización visual), Audit, API
```

## Dependencias permitidas

Esta es probablemente la regla más importante del repo — documentarla explícitamente evita que con el tiempo aparezcan referencias desde `Core` hacia un módulo específico, que es justo lo que rompería la reutilización entre rubros y modelos comerciales (ver [ADR-001](adr/ADR-001-Core-And-Modules.md)):

```
Modules    → Core   ✅
SaaS       → Core   ✅
Enterprise → Core   ✅

Core → Modules      ❌
Core → SaaS         ❌
Core → Enterprise   ❌
```

`Core` no importa nada de las capas que dependen de él. Si en algún momento `Core` necesita "saber" algo de un `Module`, `SaaS` o `Enterprise`, es señal de que ese algo en realidad pertenece a `Core` (agnóstico) o de que la dependencia está invertida y hay que resolverla con una interfaz en `Shared`, no con un import directo — ejemplo real de esto: `IPlanLimitsService` (ver [Features](Features.md)).

## Principios

1. Un único Core.
2. Un único código fuente.
3. Todo negocio es un Tenant.
4. Toda funcionalidad específica de un rubro vive en un Module.
5. Ningún cliente modifica el Core.

## Cómo decidir dónde va una nueva funcionalidad

```
¿Sirve para cualquier rubro?
        │
        Sí
        │
        ▼
      Core
────────────────────
¿Solo para un rubro puntual (ej. Belleza)?
        │
        ▼
  Modules/<Rubro>
────────────────────
¿Depende de qué plan tiene el tenant?
        │
        ▼
  SaaS/Features
────────────────────
¿Solo para clientes grandes (sucursales, whitelabel, auditoría)?
        │
        ▼
   Enterprise
────────────────────
¿Es exclusivo de un cliente puntual?
        │
        ▼
    Custom
```

Este árbol es el que más se va a consultar a medida que el proyecto crece — ante la duda, la pregunta correcta no es "¿dónde me conviene ponerlo?" sino "¿en cuántos rubros/tenants/planes distintos podría existir esto?".

## Flujo de una request

```
Cliente → Tenant → Plan → Módulos habilitados → Core → Infraestructura
```

Todo entra identificando primero **quién** (`Tenant`, resuelto por JWT o subdominio — ver [MultiTenancy](MultiTenancy.md)) y **qué puede hacer** (`Plan`, vía `SaaS/Features` — ver [Features](Features.md)) antes de llegar a la lógica de negocio agnóstica de `Core`, que a su vez se apoya en `Infrastructure` para todo lo externo (DB, email, WhatsApp, pagos).

Ejemplo concreto, una reserva:

```
Reserva → Tenant → Plan → Validación de límites → Booking → Payment → Notification
```

> La resolución de `Tenant`, el aislamiento por `TenantId` y la "Validación de límites" (`IPlanLimitsService`) ya están implementados end-to-end. Hoy la validación de límites solo está conectada en `ProfessionalsController` (`MaxProfessionals`) como referencia — replicar el mismo patrón en `BookingsController` (`MaxBookings`) y donde se necesite `MaxBranches` queda pendiente. Ver [Features](Features.md).

## Ejemplo concreto de la regla Core/Module

Un "servicio" (nombre, precio, duración) existe en cualquier rubro — un corte de pelo, una mesa de restaurante, una consulta médica son todos `Service` en `Core`. Lo que cambia es la información específica de cada rubro: `Modules/Beauty/Treatments/Treatment.cs` extiende un `Service` con datos de belleza (categoría, sesiones, si requiere antes/después) sin que `Core` ni `Bookings` sepan que existe. Cuando se agregue un rubro nuevo, agrega su propia extensión análoga sin tocar el núcleo. Detalle completo en [Modules](Modules.md).

## Estructura del proyecto

```
backend/TTurnos.Api/     Backend ASP.NET Core (+ TTurnos.sln)
  Core/                  Dominio agnóstico de rubro — un folder por dominio, y dentro de
                         cada uno organizado por feature (Entities/, DTOs/, Controllers/,
                         Services/):
                         Auth, Users, Roles, Clients, Bookings, Scheduling, Professionals,
                         Services, Payments, Notifications, Reports, Settings, Content
  Modules/                Extensiones específicas de cada rubro (vacío salvo Beauty) — cada
                         módulo debe poder instalarse sin modificar Core:
    Beauty/                 Treatments (extiende Service), BeforeAfter (galería de
                           trabajos), Memberships/ y Products/ (esqueleto, sin implementar)
    Restaurant/, Medical/,  Esqueleto vacío — se completan cuando se necesiten
    Veterinary/, Gym/,
    Automotive/
  Infrastructure/          Persistence (DbContext, seeders), Integrations (Gmail, WhatsApp,
                         Email), BackgroundJobs (setup + filtros de Hangfire), Authentication
                         (setup de JWT), MultiTenancy (resolución de tenant por JWT/
                         subdominio), Storage (esqueleto, sin implementar)
  Shared/                 Interfaces y tipos cruzados entre capas (ITenantScoped,
                         ICurrentTenant, IPlanLimitsService, DTOs, Enums, Helpers, Validators,
                         Extensions, Abstractions, Exceptions)
  SaaS/                    Tenant, Plan, Subscription, License, Usage, Features (feature
                         flags y límites por plan) — modelo de negocio del SaaS
                         (Billing/ es esqueleto, sin implementar)
  Enterprise/               Branches (sucursales), WhiteLabel/Theme (personalización visual)
                         — Audit/, API/ son esqueleto, sin implementar
  Migrations/             Historial de migraciones EF Core
frontend/tturnos-web/     Frontend Next.js
  app/                    Next.js App Router, organizado en route groups por audiencia
                         (no afectan la URL pública):
    (public)/               Home, servicios (sitio público de reserva)
    (client)/                Cancelar turno, "Mis turnos"
    (admin)/admin/            Panel de administración (rol Admin)
    (professional)/           Área del profesional (rol Professional)
    api/                    Proxies server-side a la API (reenvían X-Tenant-Host)
  src/components/            ui/, shared/ (Navbar, WhatsApp), booking/, calendar/,
                         dashboard/ (sidebars), forms/ (upload), payments/
  src/lib/                 Helpers de auth, configuración del sitio, etc.
docs/                     Documentación del proyecto (este directorio)
docker/                   Dockerfile del backend
tools/                    Scripts y utilidades del repo
```
