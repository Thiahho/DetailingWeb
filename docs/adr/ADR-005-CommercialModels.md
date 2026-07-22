# ADR-005 — Un único código para tres modelos comerciales

**Estado:** Aceptada — 2026-07-07

## Problema

Turneo se vende de tres formas distintas: suscripción SaaS, licencia perpetua (el cliente compra el software y lo corre él mismo), y desarrollo a medida. Había que decidir si eso implicaba mantener bases de código separadas (una por modelo comercial) o una sola.

## Opciones consideradas

1. **Un fork/rama por modelo comercial.** Cada modelo evoluciona independiente, pero cualquier fix o feature de `Core` hay que aplicarlo N veces y las ramas divergen con el tiempo — exactamente lo que se quiere evitar en una plataforma pensada para durar años.
2. **Un único código, con `CommercialModel` como metadato del tenant, no como rama de ejecución.** El aislamiento multi-tenant (ADR-002) ya resuelve tanto el caso SaaS (muchos tenants en una base) como License/Custom (un solo tenant en un deploy dedicado) sin necesitar código distinto.

## Decisión

Opción 2. `Tenant.CommercialModel` (enum: `SaaS`, `License`, `Custom`) es **solo un metadato** — no condiciona qué funcionalidades corren ni qué código se ejecuta. Los tres modelos difieren en:
- **Cómo se despliega**: SaaS = instancia compartida; License/Custom = instancia dedicada por cliente.
- **Cómo se factura**: SaaS vía `Subscription` (recurrente, ligada a un `Plan`); License vía `License` (pago único + soporte opcional por tiempo); Custom, fuera del sistema de facturación estándar.
- **Cómo se mantiene**: SaaS lo actualiza el proveedor centralizadamente; License/Custom dependen del ciclo de deploy de ese cliente puntual.

Lo que **no** cambia entre modelos: `Core`, los `Modules` instalados, y el mecanismo de límites (`SaaS/Features`, ver ADR-004) — un tenant License puede perfectamente tener un `Plan` asignado (para heredar límites razonables) sin que eso implique que paga por suscripción.

## Consecuencias

- Un fix o feature en `Core` beneficia a los tres modelos comerciales al mismo tiempo, sin trabajo de sincronización.
- El pipeline de deploy es el mismo para los tres modelos — lo único que cambia es cuántos tenants tiene la base de cada instancia desplegada (una para SaaS compartido, una por cliente para License/Custom).
- Riesgo a vigilar: que alguien agregue un `if (tenant.CommercialModel == ...)` dentro de `Core` para condicionar comportamiento — eso reintroduciría exactamente el acoplamiento que esta decisión evita. Si un comportamiento realmente necesita variar por modelo comercial, la vía correcta es un `Feature` (ADR-004) asociado al `Plan` del tenant, no una rama por `CommercialModel`.
