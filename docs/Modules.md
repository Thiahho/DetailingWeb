# Modules

Ver la decisión de diseño completa en [ADR-001](adr/ADR-001-Core-And-Modules.md).

## Regla

Cada módulo (`Modules/<Rubro>/`) contiene únicamente lo que es exclusivo de ese rubro — todo lo que puede existir en más de un rubro vive en `Core` (ver [Architecture](Architecture.md)). Un módulo debe poder instalarse sin modificar `Core`.

Patrón de extensión: una entidad genérica de `Core` (ej. `Service`) se extiende 1:1 desde el módulo, referenciando su id (ej. `Modules/Beauty/Treatments/Treatment.cs` → `ServiceId`), sin que `Core` sepa que la extensión existe.

## Beauty — el único módulo implementado hoy

| Carpeta | Estado | Qué es |
|---|---|---|
| `Treatments/` | ✅ Implementado | `Treatment`: extensión 1:1 de `Service` — `Category`, `EstimatedProducts`, `SessionCount`, `RequiresBeforeAfter`, `RequiresConsent`, `Notes` |
| `BeforeAfter/` | ✅ Implementado | `GalleryItem` + `GalleryController` — portafolio de trabajos (movido desde `Core/Content` en FASE 10, porque "antes/después" es específico de belleza) |
| `Memberships/` | ⏳ Esqueleto, sin implementar | Feature nueva, no existe en el producto todavía — sin modelo de datos hasta tener requisitos reales (qué incluye una membresía, cómo se factura) |
| `Products/` | ⏳ Esqueleto, sin implementar | Feature nueva, no existe en el producto todavía — sin modelo de datos hasta tener requisitos reales (catálogo, stock, precio) |

`ContentVideo`/`ContentVideosController` (videos promocionales) se quedaron en `Core/Content` deliberadamente — a diferencia de la galería antes/después, un video promocional aplica igual a cualquier rubro.

## Módulos en el roadmap (sin código todavía)

`Modules/Restaurant`, `Modules/Medical`, `Modules/Veterinary`, `Modules/Gym`, `Modules/Automotive` existen como carpetas vacías (`.gitkeep`) — reservan el lugar en la estructura pero no tienen ninguna entidad ni lógica. Se completan cuando haya un cliente/necesidad real de ese rubro, siguiendo el mismo patrón que Beauty: identificar qué es genérico (ya cubierto por `Core`) y qué es exclusivo del rubro (va en el módulo).
