# Feature flags y límites por plan

Ver la decisión de diseño completa en [ADR-004](adr/ADR-004-FeatureFlags.md).

## Modelo

- **`Feature`** (`SaaS/Features`): catálogo de qué cosas son configurables por plan. `Key` (ej. `"MaxProfessionals"`), `Name`, `Type` (`Boolean` o `Numeric`), `Description`.
- **`PlanFeature`**: el valor de un `Feature` para un `Plan` puntual. `Value` es siempre `string` — `"true"`/`"false"` para `Boolean`, un número para `Numeric`. Convención: `"-1"` en un `Numeric` significa **sin límite**.

Agregar un límite o permiso nuevo es una fila en `Feature` + una fila en `PlanFeature` por plan — nunca una migración de schema en `Plan`.

Features seedeados hoy: `CanUseWhatsapp`, `CanUseAI`, `MaxProfessionals`, `MaxBranches`, `MaxBookings`. Ver los valores actuales por plan en [Plans](Plans.md).

## Regla para toda funcionalidad nueva

Antes de escribir código, decidir:

1. ¿Pertenece al Core?
2. ¿Es específica de un módulo?
3. ¿Es un Feature del plan?
4. ¿Es Enterprise?
5. ¿Es Custom?

Ver el árbol de decisión completo en [Architecture](Architecture.md#cómo-decidir-dónde-va-una-nueva-funcionalidad).

## `IPlanLimitsService` — enforcement real

`Core` necesita consultar límites de `SaaS`, pero `Core → SaaS` está prohibido (ver [Dependencias permitidas](Architecture.md#dependencias-permitidas)). Se resuelve con inversión de dependencia:

```
Shared/Interfaces/IPlanLimitsService.cs   ← interfaz, Core puede depender de Shared
SaaS/Features/PlanLimitsService.cs        ← implementación real
Program.cs                                ← registra IPlanLimitsService → PlanLimitsService en el DI
```

`Core` (los Controllers) solo conocen `IPlanLimitsService`. Nunca hay un `using Turneo.Api.SaaS...` dentro de `Core`.

```csharp
Task<bool> IsWithinLimitAsync(string featureKey, int currentCount);
```

Resuelve el `Plan` del tenant actual (`Tenant.PlanId`) → busca el `PlanFeature` para ese `Feature.Key` → compara `currentCount` contra el límite (o `true` si es `"-1"`).

**Fail-open por diseño**: si el tenant no tiene `PlanId` asignado, o el plan no tiene ese `Feature` configurado, `IsWithinLimitAsync` devuelve `true` (no bloquea). Es deliberado, para no romper tenants existentes sin plan asignado — tenerlo presente si en el futuro se necesita fail-closed para algún feature crítico.

## Estado del enforcement

| Controller | Feature | Estado |
|---|---|---|
| `ProfessionalsController.Create` | `MaxProfessionals` | ✅ Conectado — responde `402 Payment Required` al exceder |
| `BookingsController` | `MaxBookings` | ⏳ Pendiente — mismo patrón, no implementado todavía |
| (donde corresponda) | `MaxBranches` | ⏳ Pendiente |
| — | `CanUseWhatsapp` / `CanUseAI` | ⏳ Pendiente — hoy no bloquean el envío ni ninguna función de IA |

`ProfessionalsController` es la implementación de referencia — replicar el mismo patrón (`_planLimits.IsWithinLimitAsync(...)` antes de crear la entidad) en los controllers que faltan.
