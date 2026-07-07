# ADR-004 — Feature flags y límites como catálogo, no columnas en Plan

**Estado:** Aceptada — 2026-07-07

## Problema

Cada plan comercial (Starter, Pro, Premium, ...) necesita otorgar límites y permisos distintos (cuántos profesionales, si puede usar WhatsApp, si tiene funciones de IA, ...). La primera versión de `Plan` (FASE 5) modeló esto como columnas fijas (`MaxProfessionals`, `MaxBookingsPerMonth`, `MaxBranches`) directamente en la entidad.

## Opciones consideradas

1. **Columnas en `Plan`.** Simple al principio, pero cada límite o feature flag nuevo (`CanUseAI`, `MaxBranches`, lo que sea que se necesite en 6 meses) es una migración de schema, y `Plan` termina lleno de columnas nullable específicas de un momento del producto.
2. **Catálogo `Feature` + tabla puente `PlanFeature`.** `Feature` es el catálogo de qué cosas son configurables (`Key`, `Name`, `Type`: Boolean o Numeric). `PlanFeature` guarda el valor de un `Feature` para un `Plan` puntual (`Value` como string, `-1` = sin límite para los numéricos). Agregar un límite nuevo es una fila en `Feature`, no una migración.

## Decisión

Opción 2. Se implementó en un refactor post-FASE10, reemplazando las columnas de límites que `Plan` tenía desde FASE 5 (migración `AddSaaSFeatures`, con `DropColumn` de las 3 columnas viejas).

`Tenant.PlanId` (nullable) define qué plan rige a un tenant, sin importar su modelo comercial (ver ADR-005: `CommercialModel` no controla esto).

**Enforcement — caso de prueba real de la regla de dependencias (ADR-001):** el código que necesita consultar límites vive en `Core` (ej. `ProfessionalsController`), pero `Core → SaaS` está prohibido. Se resolvió con inversión de dependencia:
- `IPlanLimitsService` (interfaz) vive en `Shared/Interfaces` — `Core` sí puede depender de `Shared`.
- `PlanLimitsService` (implementación) vive en `SaaS/Features`, registrada en el contenedor de DI desde `Program.cs` (el composition root, que sí conoce todas las capas).
- `Core` solo conoce la interfaz. Nunca hay un `using TTurnos.Api.SaaS...` dentro de `Core`.

Regla para toda funcionalidad nueva, a partir de ahora: **antes de escribir código, decidir si pertenece a `Core`, a un `Module`, es un `Feature` del plan, es `Enterprise`, o es `Custom`** (ver `docs/Architecture.md` para el árbol de decisión completo).

## Consecuencias

- Cambiar un límite (ej. subir `MaxProfessionals` de Pro de 5 a 8) es un `UPDATE` en `PlanFeatures`, no un deploy.
- El enforcement real hoy solo está conectado en `ProfessionalsController` (`MaxProfessionals`, responde `402 Payment Required` al exceder) como implementación de referencia. Replicar el mismo patrón para `MaxBookings` en `BookingsController` y `MaxBranches` donde corresponda queda pendiente — no se hizo de forma preventiva en todos los controllers para no tocar código sin necesidad concreta.
- `PlanLimitsService.IsWithinLimitAsync` es **fail-open**: si el tenant no tiene `PlanId` asignado o el plan no tiene ese `Feature` configurado, no bloquea. Es una decisión deliberada para no romper tenants existentes que todavía no tienen plan asignado — hay que tenerlo presente si en el futuro se requiere fail-closed para algún feature crítico.
