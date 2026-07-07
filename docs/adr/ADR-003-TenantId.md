# ADR-003 — TenantId como `int`, no `Guid`

**Estado:** Aceptada — 2026-07-07

## Problema

Al diseñar la entidad `Tenant` y la columna `TenantId` que llevan todas las entidades de `Core`, había que elegir el tipo de la clave: `Guid` (convención común en sistemas multi-tenant, para no exponer/permitir enumerar tenants por id secuencial) o `int` (identity autoincremental, la convención que ya usa el resto del modelo de datos del proyecto).

## Opciones consideradas

1. **Guid.** No enumerable, generable sin round-trip a la base, convención frecuente en SaaS multi-tenant.
2. **int (identity).** Consistente con el resto de las entidades del proyecto (`Booking.Id`, `Professional.Id`, etc. son todas `int`), índices más chicos y joins más baratos, más simple de leer/depurar en desarrollo.

## Decisión

`int`, por decisión explícita del usuario. Todas las FK `TenantId` en el proyecto son `int`.

## Consecuencias

- Consistencia total con el resto del modelo de datos — no hay una isla de `Guid` en medio de entidades `int`.
- El id de tenant es técnicamente enumerable (1, 2, 3, ...). No es un problema de seguridad por sí solo porque el aislamiento real lo da el query filter por `TenantId` (ver ADR-002), no la imposibilidad de adivinar el id — aun así, ningún endpoint público debería devolver el `TenantId` crudo de otro tenant en una respuesta.
- Si en algún momento se requiere generar un `TenantId` sin round-trip a la base (ej. alta de tenant offline), se resuelve en la capa de aplicación (reservando un rango o usando un id temporal), no cambiando el tipo de la columna.
