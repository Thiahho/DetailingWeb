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

`SaaSCatalogSeeder` (`Infrastructure/Persistence`) siembra automáticamente al arrancar la API (idempotente, corre una sola vez) los 6 planes de la **propuesta comercial confirmada el 20/07** — la migración `ReseedCommercialPlanCatalog` (21/07) reemplazó el catálogo placeholder original (Starter/Pro/Premium/Enterprise/License/Custom) por este:

| Plan | Profesionales | Sucursales | Reservas/mes | WhatsApp | IA |
|---|---|---|---|---|---|
| Free | 1 | 1 | 50 | ❌ | ❌ |
| Starter | 2 | 1 | sin límite | ❌ | ❌ |
| Pro | 10 | 1 | sin límite | ✅ | ❌ |
| Business | sin límite | sin límite | sin límite | ✅ | ❌ |
| Licencia | sin límite | sin límite | sin límite | ✅ | ✅ |
| Custom | sin límite | sin límite | sin límite | ✅ | ✅ |

**Ningún plan salvo Licencia/Custom incluye IA** — hoy no importa demasiado porque `CanUseAI` no tiene ningún caller en el backend (ver [Features](Features.md)), pero es una inconsistencia a resolver si se llega a construir esa función. El plan `Starter` (pensado para 1-2 profesionales) tampoco incluye WhatsApp — contradicción real para el segmento de negocio más chico, que es justamente el que más depende de ese canal.

La tabla completa de features tiene más columnas que estas 5 (`MaxClients`, `MaxServices`, `MaxAdmins`, `CanUseMercadoPago`, `CanUseAutomations`, `HideTurneoBranding`) — ver [Features](Features.md) para el catálogo completo y el estado real del enforcement.

**Los precios (`PriceMonthly`/`PriceYearly`) se dejaron sin definir (`null`) a propósito** en los 6 planes — es una decisión de negocio real que todavía no se cargó, distinta de los límites (que sí son un valor de partida razonable, editable en cualquier momento vía `UPDATE` sobre `PlanFeatures`).

El tenant "legacy" (el negocio de belleza que ya corre en producción) quedó asignado al plan `Licencia` según la migración que hizo el reseed — no verificado contra la base real en esta pasada.
