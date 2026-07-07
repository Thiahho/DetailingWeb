# Enterprise

Features de nivel enterprise — para tenants grandes que necesitan más que lo que cubre un `Plan` estándar.

## Estado actual

| Carpeta | Estado | Qué es |
|---|---|---|
| `Branches/` | 🟡 Base implementada, sin conectar | `Branch`: sucursal física de un tenant (`Name`, `Address`, `Phone`, `IsActive`). Un tenant puede tener 0 o varias. **No está conectada a `Core`** — `Booking`, `Professional`, `TimeSlot`, etc. no tienen `BranchId` todavía, así que hoy `Branch` es una tabla que existe pero no afecta la agenda real. Conectarla es un feature real (agenda por sucursal), no solo agregar una columna — deliberadamente no se hizo sin pedido explícito. |
| `WhiteLabel/` | 🟡 Base implementada | `Theme`: personalización visual por tenant — `PrimaryColor`, `SecondaryColor`, `AccentColor`, `FontFamily`. Único por tenant. El frontend todavía no lee `Theme` para aplicar los colores — falta esa integración. |
| `Audit/` | ⏳ Esqueleto, sin implementar | Sin modelo de datos ni lógica todavía. |
| `API/` | ⏳ Esqueleto, sin implementar | Pensado para una API pública/externa de nivel enterprise (distinta de la API interna que usa el frontend) — sin diseñar todavía. |

> `Branding/` (del roadmap original) se eliminó como carpeta separada — `WhiteLabel/` ya cubre ese propósito, tener las dos era redundante.

## Próximos pasos razonables (no implementados)

- Agregar `BranchId` (nullable) a las entidades de `Core` que necesiten filtrar por sucursal, y actualizar la agenda/reportes para poder filtrar por sucursal.
- Que el frontend lea `Theme` del tenant activo y lo aplique (colores de marca, no solo el logo que ya soporta `SiteConfig`).
- Definir qué necesita auditarse (`Audit/`) antes de modelarlo — no inventar un log genérico sin casos de uso concretos.
