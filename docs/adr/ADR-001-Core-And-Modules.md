# ADR-001 — Core agnóstico + Modules por rubro

**Estado:** Aceptada — 2026-07-07

## Problema

Turneo empezó como un sistema de detailing automotriz de un solo rubro. Al convertirlo en plataforma multi-rubro (belleza, gastronomía, salud, ...), había que decidir cómo separar lo genérico (aplica a cualquier negocio con turnos) de lo específico de cada rubro, sin terminar reescribiendo `Bookings` cada vez que se agrega un nuevo tipo de negocio.

## Opciones consideradas

1. **Un modelo de datos por rubro** (`BeautyBooking`, `RestaurantBooking`, ...) — máxima flexibilidad por rubro, pero `Bookings`, pagos, notificaciones y todo lo transversal se duplican N veces.
2. **Un único modelo con campos opcionales para todos los rubros** — evita duplicar código pero el modelo genérico termina lleno de columnas nulas específicas de un solo rubro (`ChairNumber` para peluquería, `TableNumber` para restaurante, etc.), y agregar un rubro nuevo obliga a migrar el schema de `Core`.
3. **Core agnóstico + extensión 1:1 por Module** — `Core` modela lo que existe en cualquier rubro (`Service`, `Booking`, `Professional`, `Scheduling`). Cada rubro que necesita datos propios crea una entidad de extensión en su `Module`, referenciando el id de la entidad de `Core` (ej. `Modules/Beauty/Treatments/Treatment.cs` → `ServiceId`). `Core` nunca sabe que la extensión existe.

## Decisión

Opción 3. Regla operativa: **todo lo que pueda existir en más de un rubro vive en `Core`; solo lo exclusivo de un rubro vive en su `Module`.** Cada `Module` debe poder instalarse sin modificar `Core`.

Dependencias permitidas en un solo sentido:

```
Modules → Core   ✅
Core → Modules   ❌
```

Ejemplo aplicado (FASE 10, extracción de Beauty): `Core/Services/Entities/Service.cs` (nombre, precio, duración) se queda en `Core` sin cambios. `Modules/Beauty/Treatments/Treatment.cs` es la extensión 1:1 (categoría, sesiones, si requiere antes/después) — `Bookings` sigue referenciando solo `ServiceId`, sin saber que `Treatment` existe.

## Consecuencias

- Agregar un rubro nuevo (ej. Gastronomía) no requiere tocar `Core`, `Bookings` ni migrar su schema — solo agregar el `Module` correspondiente con sus propias extensiones (`RestaurantService`, análoga a `Treatment`).
- Si en el futuro `Core` "necesita" algo de un `Module` (caso real: validar límites de plan, ver ADR-004), la dependencia se invierte con una interfaz en `Shared` — nunca un import directo de `Core` hacia `Modules`/`SaaS`/`Enterprise`.
- Riesgo a vigilar: que alguien agregue un campo específico de un rubro directamente en una entidad de `Core` "porque total es un solo campo" — eso es exactamente lo que esta regla previene, y hay que rechazarlo en review.
