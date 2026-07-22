# Auditoría del sistema — DetailingWeb (05/07)

Auditoría realizada sobre el grafo de conocimiento del proyecto (`graphify-out/graph.json`) cruzado con lectura puntual del código fuente.

## 🔴 Crítico — Seguridad del webhook de pagos

**Archivo:** `Turneo.Api/Controllers/PaymentsController.cs:154-156`

La validación de firma HMAC del webhook de MercadoPago es **condicional**: solo se ejecuta `if (!string.IsNullOrEmpty(webhookSecret))`. En `appsettings.json:73`, `MercadoPago:WebhookSecret` está **vacío**. Resultado: hoy mismo, cualquiera puede pegarle a `/api/payments/webhook/mercadopago` con un payload falso y el sistema lo acepta sin verificar que venga realmente de MercadoPago.

Además, `app/api/payments/webhook/mercadopago/route.ts` es un proxy Next.js que reenvía el body al backend pero **no reenvía los headers `x-signature` / `x-request-id`** (solo pasa `Content-Type`). Si alguna vez el webhook de MercadoPago apunta a este proxy en vez de directo a la API, la validación de firma es imposible aunque configures el secret. Ese mismo archivo, además, siempre devuelve `200` en el catch — si falla el reenvío al backend, MercadoPago cree que se procesó y no reintenta.

**Acción:** configurar `MercadoPago:WebhookSecret`, y decidir si el webhook le pega directo a la API o al proxy (si es al proxy, hay que reenviar los headers de firma).

## ✅ Resuelto — Inconsistencia de timezone en recordatorios

**Archivo:** `Turneo.Api/Services/ReminderBackgroundService.cs:23-24,44` (antes de la corrección)

`ReminderBackgroundService` definía un método `.NowArgentina()` que **nunca se llamaba**. La lógica real usaba `DateTime.Now` crudo, confiando en que el timezone del servidor coincidiera con el de los slots guardados (comentario del propio código lo reconocía como algo frágil).

En cambio, `TimeSlotsController.cs` sí usa su propio `NowArgentina()` de forma consistente en las 3 validaciones de horarios. Esto coincidía con el commit reciente "Fix ReminderBackgroundService: use DateTime.Now" — parecía un arreglo a medias que dejó código muerto y una inconsistencia real: si el hosting cambiaba de timezone (Render u otro), los recordatorios de 24hs se podían desalinear silenciosamente.

**Fix aplicado (05/07):** se reemplazó `DateTime.Now` por `NowArgentina()` (ya definido pero sin usar) en línea 43, igual que en `TimeSlotsController`. Compilación verificada: 0 errores, 0 warnings.

## 🟠 Alto — Dump de base de datos con datos de clientes sin gitignorear

**Archivo:** `Turneo.Api/bd_turnos.sql` (untracked, 412 líneas)

Es un dump de PostgreSQL con sentencias `COPY` reales — es decir, **datos de clientes** (nombres, teléfonos según el schema de `Bookings`), no solo el esquema. `.gitignore` no tiene ninguna regla para `*.sql`, así que está a un `git add .` de terminar commiteado con PII real.

**Acción:** agregarlo a `.gitignore` y borrarlo del working tree si ya cumplió su propósito (parece un dump de prueba para la migración de recordatorios de hoy).

## 🟡 Medio — Acoplamiento arquitectónico

El propio grafo lo señala: la comunidad "Backend Namespaces & Controllers" (70 nodos) tiene cohesión 0.05 — están agrupados solo porque comparten namespace, no porque colaboren. `ApplicationDbContext` es el nodo puente más conectado del sistema (betweenness 0.079), tocando 15+ áreas (Bookings, Payments, Gallery, TimeSlots, Services, etc.). No es un bug, pero es la señal típica de "God Context" — cualquier cambio al `DbContext` tiene blast radius sobre todo el backend.

## 🟢 Nota menor — Auth client-side

**Archivo:** `src/lib/auth.ts:2-5`

`isAuthenticated()` solo lee `localStorage`, es puramente cosmético (evita flash de UI). La app también tiene `verifySession()` que sí valida contra el backend con la cookie HttpOnly. Mientras los endpoints reales estén protegidos con `[Authorize]` server-side (lo cual parece ser el caso), esto no es una brecha de datos — a lo sumo alguien podría forzar que se muestre el shell de la UI admin sin sesión real, pero cualquier fetch de datos fallaría en el backend.