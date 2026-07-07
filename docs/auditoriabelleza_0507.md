# Auditoría completa del sistema — DetailingWeb / TTURNOS Belleza (05/07)

Base para presupuestar el sistema completo: inventario funcional, tamaño, seguridad, validaciones y calidad de código. Hecha cruzando el grafo de conocimiento del proyecto (`graphify-out/graph.json`, actualizado a 1105 nodos / 1681 edges / 143 comunidades tras sumar el módulo Profesionales y el PRD de TTURNOS Belleza) con lectura puntual del código fuente.

Esta versión extiende `auditoria_completa_0507.md` con lo agregado durante el arranque del pivot a TTURNOS Belleza (gestión de turnos para salones de belleza): el módulo Profesionales (CRUD completo) y su impacto en el inventario y el presupuesto.

---

## 1. Inventario del sistema (tamaño y stack)

| Métrica | Valor (05/07 original) | Valor actualizado |
|---|---|---|
| Backend (.cs, sin migraciones) | ~4.754 líneas | ~4.904 líneas |
| Frontend (.ts/.tsx) | ~9.487 líneas | ~10.172 líneas |
| Controllers (API) | 13 | 13 (se quitó `CalendarController`, se sumó `ProfessionalsController`) |
| Servicios de dominio | 13 | 12 (se quitó `GoogleCalendarService`) |
| Modelos / DTOs | 27 archivos | 27 archivos (se quitó `TurnoRequest.cs`, se sumó `Professional.cs`) |
| Páginas Next.js (público + admin) | 16 | 17 (+ `/admin/profesionales`) |
| Rutas proxy API (Next.js) | 23 | 25 (+ `app/api/professionals/*`) |
| Migraciones EF Core | 16 | 17 (+ `AddProfessionals`) |
| Proyectos de test | **0** | **0** (sin cambios) |

**Stack:** ASP.NET Core (.NET 9) + EF Core + PostgreSQL, Next.js + React + TypeScript + Tailwind, Hangfire (jobs), JWT + cookies HttpOnly, MercadoPago, Cloudinary, Gmail SMTP / WhatsApp (Meta API). *(Google Calendar API se quitó del stack — ver hallazgo b, resuelto.)*

**Módulos funcionales identificados** (vía comunidades del grafo): reservas/turnos online, panel admin completo (clientes, servicios, **profesionales**, turnos, historial, calendario, estadísticas, contenido, galería), portal de cliente ("Mis Turnos"), pagos con MercadoPago, notificaciones multicanal (email/WhatsApp) con reintento automático, recordatorios 24h automáticos, gestión de contenido multimedia y galería con Cloudinary, bloqueo de fechas, generación automática de time slots, SEO (sitemap/robots), configuración de sitio.

Es un sistema de tamaño medio-alto para un proyecto de un solo rubro: 13 dominios de API, ~15.000 líneas de código propio, sin contar dependencias. Sirve como referencia de escala para el presupuesto.

---

## 2. Seguridad

### 🔴 Crítico

**a) Webhook de MercadoPago sin validación de firma activa — ⏸️ Diferido (sistema en demo)**
*Decisión del 05/07: el sistema está en etapa de demo, sin procesar pagos reales todavía — este hallazgo queda pendiente a propósito hasta que se active el cobro real con MercadoPago. Retomar antes de salir a producción con pagos habilitados (junto con rate limiting en `PaymentsController`, que tampoco se aplicó aún).*

`TTurnos.Api/Controllers/PaymentsController.cs:154-156` — la validación HMAC es condicional a que `MercadoPago:WebhookSecret` esté configurado, y en `appsettings.json:73` está vacío. Cualquiera puede simular una notificación de pago.
Además, `app/api/payments/webhook/mercadopago/route.ts` (proxy Next.js) no reenvía los headers `x-signature`/`x-request-id`, y devuelve `200` incluso si falla el reenvío al backend (silencia errores frente a MercadoPago).

**b) `CalendarController` sin ninguna autenticación — ✅ Resuelto (05/07)**
`TTurnos.Api/Controllers/CalendarController.cs` — **ningún endpoint tenía `[Authorize]` ni `[AllowAnonymous]`** explícito, y el proyecto no define una política global de autorización por defecto (`AddAuthorization()` sin fallback policy en `Program.cs:73`), así que ambos endpoints quedaban **públicos sin querer**:
- `POST /api/calendar/turno` — creaba eventos en Google Calendar sin ninguna validación de origen, sin rate limiting.
- `GET /api/calendar/test-auth` — endpoint de setup/debug que además devolvía el `stackTrace` completo en el error (information disclosure).

Se confirmó que `GoogleCalendarService` **no estaba registrado en DI** (`Program.cs` no tenía `AddScoped<GoogleCalendarService>()`) y que **ningún archivo del frontend llama a `/api/calendar/*`** — el controller ya estaba roto (tiraría 500 por fallo de resolución de dependencias) y era código legacy sin caller, paralelo al flujo actual de reservas (`BookingsController` + `TimeSlots`).

**Fix aplicado:** se eliminaron `Controllers/CalendarController.cs`, `Services/GoogleCalendarService.cs` y `Models/TurnoRequest.cs` (sin otros usos), y se quitaron del `.csproj` las dependencias `Google.Apis.Auth` y `Google.Apis.Calendar.v3` (exclusivas de ese servicio) junto con el `<None Update="credentials.json">` que copiaba un archivo que ni siquiera existía en el repo. Compilación verificada: 0 errores (queda 1 warning preexistente y no relacionado sobre una vulnerabilidad conocida en `MailKit` 4.15.1, a revisar aparte).

### 🟠 Alto

**c) Sin rate limiting en ningún endpoint — ✅ Resuelto (05/07, parcial)**
No había `AddRateLimiter`/`UseRateLimiter` en `Program.cs`. Los endpoints públicos de escritura no tenían ningún límite de intentos — expuestos a spam de reservas, fuerza bruta sobre login/OTP, y abuso de la integración de calendario (ya eliminada).

**Fix aplicado:** rate limiting nativo de .NET (`Microsoft.AspNetCore.RateLimiting`, sin paquetes nuevos) con dos políticas por IP:
- `"auth"` (5 req/min): `AuthController.Login`, `Register`, `client/access/request`, `client/access/verify` (OTP), `client/session/exchange`.
- `"public-booking"` (20 req/min): `BookingsController.CreateBooking`, `GetBookingsByEmail`, cancelar y reprogramar turno.

Responde `429` con `Retry-After: 60` al exceder el límite. Se agregó `UseForwardedHeaders()` porque Render actúa de proxy — sin esto, `RemoteIpAddress` sería siempre la IP interna del proxy y el limitador no distinguiría clientes reales.

**Pendiente:** `PaymentsController` (`create-preference` y el webhook) queda sin política de rate limiting — se abordará junto con el fix de validación de firma de MercadoPago (ver hallazgo a). El nuevo `ProfessionalsController` tampoco tiene rate limiting propio, pero sus únicos endpoints públicos son de solo lectura (`GET`), igual que `ServicesController`/`GalleryController` — no es un gap nuevo, sigue el mismo criterio ya aceptado para catálogos públicos.

**d) Dump de base de datos con datos de clientes sin gitignorear**
`TTurnos.Api/bd_turnos.sql` (untracked, 412 líneas) — dump real con sentencias `COPY` (datos de clientes: nombre, teléfono, email según schema de `Bookings`). Se agregó una regla `*.sql` (con excepción para `TTurnos.Api/Scripts/`) al `.gitignore`, pero el archivo en sí sigue en el working tree — conviene borrarlo si ya cumplió su propósito.

### 🟡 Medio

**e) CORS y cookies — configurados correctamente** (no es un hallazgo, es un punto a favor): orígenes restringidos por configuración (no wildcard), cookies de sesión `HttpOnly` + `Secure` + `SameSite=None` apropiado para cross-site entre Vercel/Render.

**f) `verifySession()` vs `isAuthenticated()`** — la protección real de datos está del lado del servidor (`[Authorize]`), `isAuthenticated()` en `src/lib/auth.ts:2-5` es solo un flag de UI (`localStorage`). No es una brecha de datos, pero conviene documentarlo para que futuros desarrolladores no confíen en él para gating real.

### ✅ Resuelto en esta sesión

**Timezone en recordatorios** — `ReminderBackgroundService.cs` usaba `DateTime.Now` crudo dependiente del timezone del servidor; se corrigió para usar `NowArgentina()` (ya definido, sin usar), consistente con `TimeSlotsController`. Compilación verificada.

---

## 3. Validación de datos (entrada de usuario) — ✅ Resuelto (05/07, DTOs públicos)

**Antes:** 26 de 27 archivos de Models/DTOs no tenían ninguna Data Annotation (`[Required]`, `[EmailAddress]`, `[Range]`, `[StringLength]`). Ningún controller llamaba `ModelState.IsValid` manualmente — aunque todos tienen `[ApiController]` (que valida automáticamente el `ModelState` si hay anotaciones), como los DTOs no las tenían, esa protección casi no se activaba en la práctica. Ejemplo: `BookingsController.CreateBooking` (endpoint público anónimo) guardaba nombre/teléfono/email/mensaje tal cual llegaban, sin límite de longitud ni formato.

**Fix aplicado:** se agregaron Data Annotations a los DTOs de los endpoints públicos/anónimos (los de mayor exposición). Al tener `[ApiController]`, el 400 automático ya funciona sin tocar los controllers:

- `CreateBookingRequest` (`BookingsController.cs`): `TimeSlotId` con `[Range(1, int.MaxValue)]`; `CustomerName`, `CustomerPhone`, `Email`, `Subject` con `[Required]` + `[StringLength]`; `Email` además `[EmailAddress]`; `Service`/`CustomFieldsJson`/`Message` opcionales con tope de longitud.
- `RescheduleRequest`: `NewTimeSlotId` con `[Range(1, int.MaxValue)]`.
- `LoginRequest`, `RegisterRequest`, `ChangePasswordRequest`: `[Required]` + `[EmailAddress]`/`[StringLength]` en todos los campos, complementando (sin duplicar) las reglas de negocio que ya existían en `AuthService` (match de contraseñas, longitud mínima).
- `ClientAccessDtos.cs` (`ClientAccessRequest`, `ClientOtpVerifyRequest`, `ClientPortalTokenRequest`): email con formato válido, `OtpCode` restringido a exactamente 6 dígitos vía `[RegularExpression]` (coincide con el formato real generado en `AuthService:149`), `Password` opcional se dejó sin `[Required]` porque solo se usa en el modo `EmailPassword` (verificado en `AuthService.RequestClientAccessAsync`).

**Nuevo (módulo Profesionales):** `ProfessionalRequest` (`ProfessionalsController.cs`) se construyó **con validación desde el día uno** (no como retrofit): `[Required, StringLength]` en nombre/apellido, `[RegularExpression]` para forzar `CalendarColor` como hex válido (`#RRGGBB`), `[Range(0,100)]` en `Commission`, `[StringLength(4000)]` en el JSON de horario. Es el primer DTO del proyecto que nace con estas reglas en vez de agregarlas después.

**Pendiente (menor prioridad, no público/anónimo):** `UpdateTimeSlotRequest` y los DTOs de `ReminderModels.cs` quedan sin anotaciones — están detrás de `[Authorize(Roles="Admin")]`, así que el riesgo es mucho menor.

---

## 4. Confiabilidad y manejo de errores

- Los 2 background services (`ReminderBackgroundService`, `NotificationRetryBackgroundService`) capturan excepciones correctamente y no tumban el proceso — buen patrón.
- Migraciones EF se aplican automáticamente al arrancar (`Program.cs:113-118`, `context.Database.Migrate()`). Es cómodo para deploys automáticos, pero significa que no hay ningún gate/revisión manual antes de que un cambio de esquema se aplique en producción — riesgo a tener en cuenta a medida que el sistema crezca. La migración `AddProfessionals` se generó pero **no se aplicó automáticamente** en esta sesión (a pedido explícito: las migraciones se aplican de forma manual) — se generó también el script SQL idempotente correspondiente (`TTurnos.Api/Scripts/add_professionals.sql`) para aplicarla a mano.
- Manejo de errores en controllers es mayormente `try/catch` devolviendo `BadRequest(ex.Message)` — funcional, pero expone mensajes de excepción interna al cliente en varios lugares (`AuthController.Login`), lo cual es un detalle de information disclosure menor pero recurrente. *(El caso de `CalendarController` ya no aplica — controller eliminado.)*

---

## 5. Calidad de código y mantenibilidad

- **Cero tests automatizados** en todo el repo (ni backend ni frontend). Cualquier presupuesto de mantenimiento/extensión debería contemplar esto como deuda técnica de base.
- **Acoplamiento alto en el core del backend**: la comunidad "Backend Namespaces & Controllers" tiene cohesión ~0.057 (muy baja) y `ApplicationDbContext` sigue siendo el nodo con mayor betweenness centrality (0.118) del sistema — ahora toca también las migraciones y modelos de `Professionals`. No es un bug, pero implica que cambios al modelo de datos tienen blast radius amplio, y **este riesgo crece con cada módulo nuevo de TTURNOS** que se agregue de la misma forma (todos los controllers inyectan `ApplicationDbContext` directo, sin capa de repositorio).
- Código muerto detectado y corregido: `NowArgentina()` sin usar en `ReminderBackgroundService` (ya corregido), y el módulo `CalendarController`/`GoogleCalendarService` que era un flujo de reservas paralelo/legacy (ya eliminado).
- El grafo de conocimiento detectó una relación semántica no obvia: el **"Módulo Automatizaciones"** planificado en el PRD de TTURNOS (motor tipo Zapier: trigger → condición → acción → espera → acción) es conceptualmente similar a los background services que **ya existen** (`ReminderBackgroundService`, `NotificationRetryBackgroundService`). Esto es una oportunidad de reutilización: ese módulo futuro no necesita partir de cero, puede evolucionar del mecanismo de reintentos/recordatorios ya construido.

---

## 6. Módulo Profesionales (TTURNOS Belleza) — construido 05/07

Primer módulo del pivot a gestión de turnos para salones de belleza (`TTurnosRoadmap.md`, sección 4). Alcance acordado explícitamente: **solo CRUD** (modelo, API, pantalla admin) — sin integrar todavía con la reserva pública ni con la generación de turnos (`TimeSlot` sigue siendo un recurso único compartido, no por-profesional).

**Backend:**
- `TTurnos.Api/Models/Professional.cs` — entidad nueva (`FirstName`, `LastName`, `PhotoUrl`, `CalendarColor`, `Specialty`, `Commission`, `Schedule` jsonb, `IsActive`, `Order`) + `WeeklyScheduleDay` (horario por día de la semana).
- Relación M2M implícita con `Service` (tabla de join `ProfessionalServices`, sin modificar `Service.cs`).
- `TTurnos.Api/Controllers/ProfessionalsController.cs` — CRUD completo; `Commission` excluida deliberadamente de la respuesta pública (dato financiero interno).
- Migración `AddProfessionals` generada (no aplicada, ver sección 4) + script SQL idempotente en `TTurnos.Api/Scripts/add_professionals.sql`.

**Frontend:**
- `app/admin/profesionales/page.tsx` — CRUD admin completo (foto vía Cloudinary, selector de color de calendario, multi-select de servicios asociados, editor de horario semanal).
- `app/api/professionals/route.ts` + `app/api/professionals/[...path]/route.ts` — proxies siguiendo el mismo patrón que el resto del sitio.
- Entrada "Equipo" agregada al sidebar admin (`AdminSidebar.tsx`).

**Explícitamente fuera de alcance (decisión registrada, no olvido):** selección de profesional en la reserva pública, turnos por-profesional, vistas de agenda multi-recurso (día/semana/mes con drag&drop), enforcement real de horarios/vacaciones, cálculo de comisiones, entidad Sucursal (el PRD la menciona pero el sistema sigue asumiendo un solo local).

**Deuda que este módulo hereda del resto del sistema:** sin tests, sin rate limiting propio (aceptable por ahora, ver 2.c), y agrega una tabla más al ya sobrecargado `ApplicationDbContext` (ver 5).

---

## 7. Resumen para presupuesto

| Ítem | Severidad | Esfuerzo estimado* |
|---|---|---|
| Validar firma webhook MercadoPago (configurar secret + revisar proxy) | Crítico | ⏸️ Diferido — retomar antes de habilitar pagos reales |
| ~~Asegurar/eliminar `CalendarController` (sin auth)~~ — ✅ resuelto | Crítico | Bajo (horas) |
| ~~Rate limiting en endpoints públicos~~ — ✅ resuelto (excepto Payments) | Alto | Medio (1-2 días) |
| Gitignorear y purgar `bd_turnos.sql` del working tree | Alto | Bajo (minutos) |
| ~~Agregar Data Annotations a DTOs públicos~~ — ✅ resuelto | Medio | Medio (1-2 días) |
| ~~Módulo Profesionales (CRUD)~~ — ✅ resuelto | — | Bajo-Medio (según PRD: ~24hs) |
| Suite de tests automatizados (backend + frontend) | Medio-Alto | Alto (para cobertura razonable) |
| Reducir acoplamiento de `ApplicationDbContext` / modularizar controllers | Bajo (no urgente, pero crece con cada módulo TTURNOS) | Alto (refactor, no crítico a corto plazo) |
| **Módulos TTURNOS pendientes del PRD** (ver detalle abajo) | — | — |

**Módulos del PRD de TTURNOS Belleza aún no construidos** (estimación gruesa basada en el alcance del propio documento, sujeta a ajuste — el PRD es un esqueleto, no una spec detallada):

| Módulo | Alcance según PRD | Esfuerzo estimado* |
|---|---|---|
| Servicios (extensión) | categorías, buffer, color, orden, profesionales asociados (ya cubierto en parte por la M2M de Profesionales) | Bajo (horas-1 día) |
| Agenda multi-profesional | vista día/semana/mes, drag&drop, filtros por profesional — hoy no existe nada de esto, es build desde cero | Alto (varios días, probablemente requiere librería tipo FullCalendar) |
| Clientes (CRM completo) | ficha extendida: cumpleaños, Instagram, notas, fotos, profesional favorito, historial | Medio (1-2 días) |
| Historial | registro detallado por turno con productos/fotos/pago | Medio (1-2 días) |
| Automatizaciones | motor visual trigger→condición→acción→espera; **reutilizable parcialmente** desde `ReminderBackgroundService`/`NotificationRetryBackgroundService` (ver hallazgo semántico en sección 5) | Alto (motor visual es un producto en sí mismo) |
| Caja | cobros, devoluciones, señas, caja diaria/mensual | Alto (nuevo dominio, toca Payments) |
| Estadísticas (extensión) | dashboards nuevos: profesional con mayores ventas, horas ocupadas/libres, ausencias | Medio (1-2 días, ya hay una base en `AnalyticsController`) |
| UX / Design system | sistema de diseño formal (botones, inputs, dark mode, etc.) | Medio-Alto (transversal a todo el frontend) |

*Esfuerzo aproximado en horas/días de desarrollo — ajustar según la tarifa y el criterio de quien arme el presupuesto final.
