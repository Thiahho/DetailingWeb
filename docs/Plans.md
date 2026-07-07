# Modelos comerciales y planes

Ver la decisión de diseño completa en [ADR-005](adr/ADR-005-CommercialModels.md).

## Los tres modelos comerciales

`Tenant.CommercialModel` (enum: `SaaS`, `License`, `Custom`) comparten exactamente el mismo código:

- **SaaS**: muchos tenants en una base compartida, aislados por `TenantId` (ver [MultiTenancy](MultiTenancy.md)).
- **Licencia perpetua**: el cliente corre su propio deploy con su propia base — en la práctica, un único tenant, sin necesidad de multi-tenancy real.
- **Custom**: desarrollo a medida sobre la misma base, mismo patrón que Licencia.

> **`CommercialModel` no controla funcionalidades.** Solo define **cómo se despliega, factura y mantiene** el sistema para ese tenant — nunca condiciona qué código se ejecuta ni qué features tiene disponibles. Eso es responsabilidad exclusiva del `Plan` (ver [Features](Features.md)). Un tenant License puede perfectamente tener un `Plan` asignado sin que eso implique que paga por suscripción.

## Entidades

- **`Plan`** (`SaaS/Plans`): `Name`, `PriceMonthly`/`PriceYearly` (nullable), `IsActive`. Los límites y permisos **no** son columnas acá — viven en `SaaS/Features` (ver [Features](Features.md)).
- **`Subscription`** (`SaaS/Subscriptions`): solo aplica al modelo SaaS — `TenantId`, `PlanId`, `Status`, período de facturación.
- **`License`** (`SaaS/Licenses`): solo aplica al modelo License — `TenantId`, `LicenseKey`, fecha de compra, vencimiento de soporte.
- **`Tenant.PlanId`** (nullable): define qué plan rige a un tenant sin importar su modelo comercial. Es lo que consulta `IPlanLimitsService` para saber qué límites aplican.

## Planes seedeados

`SaaSCatalogSeeder` (`Infrastructure/Persistence`) siembra automáticamente al arrancar la API (idempotente, corre una sola vez) los 6 planes del roadmap original:

| Plan | MaxProfessionals | MaxBranches | MaxBookings | WhatsApp | IA |
|---|---|---|---|---|---|
| Starter | 1 | 1 | 50 | ❌ | ❌ |
| Pro | 5 | 1 | 500 | ✅ | ❌ |
| Premium | 15 | 3 | 2000 | ✅ | ✅ |
| Enterprise | sin límite | sin límite | sin límite | ✅ | ✅ |
| License | sin límite | sin límite | sin límite | ✅ | ✅ |
| Custom | sin límite | sin límite | sin límite | ✅ | ✅ |

**Los precios (`PriceMonthly`/`PriceYearly`) se dejaron sin definir (`null`) a propósito** — son una decisión de negocio real que todavía no se cargó, distinta de los límites (que sí son un valor de partida razonable, editable en cualquier momento vía `UPDATE` sobre `PlanFeatures`).

El tenant "legacy" (el negocio de belleza que ya corre en producción) quedó asignado al plan `License`, coherente con su `CommercialModel`.
