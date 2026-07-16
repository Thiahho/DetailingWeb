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
| Proyectos de test | **0** | **2** (`backend/TTurnos.Api.Tests`: 68 tests de integración — sección 8; `frontend/tturnos-web` e2e con Playwright — sección 9) |

**Stack:** ASP.NET Core (.NET 9) + EF Core + PostgreSQL, Next.js + React + TypeScript + Tailwind, Hangfire (jobs), JWT + cookies HttpOnly, MercadoPago, Cloudinary, Gmail SMTP / WhatsApp (Meta API). *(Google Calendar API se quitó del stack — ver hallazgo b, resuelto.)*

**Módulos funcionales identificados** (vía comunidades del grafo): reservas/turnos online, panel admin completo (clientes, servicios, **profesionales**, turnos, historial, calendario, estadísticas, contenido, galería), portal de cliente ("Mis Turnos"), pagos con MercadoPago, notificaciones multicanal (email/WhatsApp) con reintento automático, recordatorios 24h automáticos, gestión de contenido multimedia y galería con Cloudinary, bloqueo de fechas, generación automática de time slots, SEO (sitemap/robots), configuración de sitio.

Es un sistema de tamaño medio-alto para un proyecto de un solo rubro: 13 dominios de API, ~15.000 líneas de código propio, sin contar dependencias. Sirve como referencia de escala para el presupuesto.

---

## 2. Seguridad

### 🔴 Crítico

**a) Webhook de MercadoPago sin validación de firma activa — ⏸️ Diferido (sistema en demo)**
*Decisión del 05/07: el sistema está en etapa de demo, sin procesar pagos reales todavía — este hallazgo queda pendiente a propósito hasta que se active el cobro real con MercadoPago. Retomar antes de salir a producción con pagos habilitados. (El rate limiting de `PaymentsController`, que originalmente estaba agrupado con este pendiente, ya se resolvió por separado el 13/07 — ver hallazgo c.)*

`TTurnos.Api/Controllers/PaymentsController.cs:154-156` — la validación HMAC es condicional a que `MercadoPago:WebhookSecret` esté configurado, y en `appsettings.json:73` está vacío. Cualquiera puede simular una notificación de pago.
Además, `app/api/payments/webhook/mercadopago/route.ts` (proxy Next.js) no reenvía los headers `x-signature`/`x-request-id`, y devuelve `200` incluso si falla el reenvío al backend (silencia errores frente a MercadoPago).

**b) `CalendarController` sin ninguna autenticación — ✅ Resuelto (05/07)**
`TTurnos.Api/Controllers/CalendarController.cs` — **ningún endpoint tenía `[Authorize]` ni `[AllowAnonymous]`** explícito, y el proyecto no define una política global de autorización por defecto (`AddAuthorization()` sin fallback policy en `Program.cs:73`), así que ambos endpoints quedaban **públicos sin querer**:
- `POST /api/calendar/turno` — creaba eventos en Google Calendar sin ninguna validación de origen, sin rate limiting.
- `GET /api/calendar/test-auth` — endpoint de setup/debug que además devolvía el `stackTrace` completo en el error (information disclosure).

Se confirmó que `GoogleCalendarService` **no estaba registrado en DI** (`Program.cs` no tenía `AddScoped<GoogleCalendarService>()`) y que **ningún archivo del frontend llama a `/api/calendar/*`** — el controller ya estaba roto (tiraría 500 por fallo de resolución de dependencias) y era código legacy sin caller, paralelo al flujo actual de reservas (`BookingsController` + `TimeSlots`).

**Fix aplicado:** se eliminaron `Controllers/CalendarController.cs`, `Services/GoogleCalendarService.cs` y `Models/TurnoRequest.cs` (sin otros usos), y se quitaron del `.csproj` las dependencias `Google.Apis.Auth` y `Google.Apis.Calendar.v3` (exclusivas de ese servicio) junto con el `<None Update="credentials.json">` que copiaba un archivo que ni siquiera existía en el repo. Compilación verificada: 0 errores (queda 1 warning preexistente y no relacionado sobre una vulnerabilidad conocida en `MailKit` 4.15.1, a revisar aparte).

### 🟠 Alto

**c) Sin rate limiting en ningún endpoint — ✅ Resuelto (05/07, ampliado 13/07)**
No había `AddRateLimiter`/`UseRateLimiter` en `Program.cs`. Los endpoints públicos de escritura no tenían ningún límite de intentos — expuestos a spam de reservas, fuerza bruta sobre login/OTP, y abuso de la integración de calendario (ya eliminada).

**Fix aplicado:** rate limiting nativo de .NET (`Microsoft.AspNetCore.RateLimiting`, sin paquetes nuevos) con tres políticas por IP:
- `"auth"` (5 req/min): `AuthController.Login`, `Register`, `client/access/request`, `client/access/verify` (OTP), `client/session/exchange`.
- `"public-booking"` (20 req/min): `BookingsController.CreateBooking`, `GetBookingsByEmail`, cancelar y reprogramar turno; y, agregado 13/07, `PaymentsController.CreateMercadoPagoPreference` y `GetPaymentByBooking` (ambos `[AllowAnonymous]`, mismo perfil de riesgo que el resto de los endpoints públicos de reservas).
- `"payments-webhook"` (60 req/min, nueva 13/07): solo `PaymentsController.MercadoPagoWebhook`. Se separó de `"public-booking"` a propósito — es tráfico servidor-a-servidor de la propia infraestructura de MercadoPago, no de un usuario final, así que un límite calcado al de un browser real podría cortar ráfagas legítimas de notificaciones de pago. El límite más alto sigue acotando el abuso si la URL del webhook se filtra.

Responde `429` con `Retry-After: 60` al exceder el límite. Se agregó `UseForwardedHeaders()` porque Render actúa de proxy — sin esto, `RemoteIpAddress` sería siempre la IP interna del proxy y el limitador no distinguiría clientes reales.

`GetAllPayments` (`[Authorize(Roles="Admin")]`) se dejó sin rate limiting, mismo criterio que el resto del panel admin autenticado. El nuevo `ProfessionalsController` tampoco tiene rate limiting propio, pero sus únicos endpoints públicos son de solo lectura (`GET`), igual que `ServicesController`/`GalleryController` — no es un gap nuevo, sigue el mismo criterio ya aceptado para catálogos públicos.

**Pendiente:** la validación de firma HMAC del webhook (hallazgo a) y el fix de la clave `MP_ACCESS_TOKEN`→`MercadoPago` (hallazgo g) siguen diferidos a propósito — el rate limiting de `PaymentsController` no dependía de esos fixes y se resolvió por separado.

**d) Dump de base de datos con datos de clientes sin gitignorear — ✅ Resuelto (13/07)**
`TTurnos.Api/bd_turnos.sql` (untracked, 412 líneas) — dump real con sentencias `COPY` (datos de clientes: nombre, teléfono, email según schema de `Bookings`). Se agregó una regla `*.sql` (con excepción para `TTurnos.Api/Scripts/`) al `.gitignore` el 05/07; el archivo en sí ya no está en el working tree (purgado el 13/07).

**g) Config de MercadoPago con clave equivocada — webhook siempre falla — ⏸️ Diferido (junto con hallazgo a)**
Encontrado el 13/07 escribiendo tests de integración para `PaymentsController`, no estaba en la auditoría original. `MercadoPagoWebhook` (`PaymentsController.cs:141`) lee la clave de configuración `"MP_ACCESS_TOKEN:AccessToken"`, que no existe en ningún `appsettings` — la clave real, que sí usa `create-preference`, es `"MercadoPago:AccessToken"`. Resultado: el webhook devuelve `500` para **cualquier** notificación real de MercadoPago, sin importar si la firma es válida o no. Esto vuelve el hallazgo crítico (a) —firma HMAC opcional— inalcanzable en la práctica hoy: el webhook nunca llega a evaluarla. No corregido a propósito (misma decisión que hallazgo a: MercadoPago se configura al final). Documentado como test de regresión en `PaymentsEndpointsTests.cs`.

**h) Cancelación pública de turnos rota para clientes reales — ✅ Resuelto (13/07)**
Encontrado el 13/07 con el primer e2e de Playwright del flujo de reserva, no estaba en la auditoría original. `GET /api/bookings/{id}` (`BookingsController.cs:253`) tenía `[Authorize(Roles = "Client,Admin")]`, mientras que `POST /api/bookings/{id}/cancel` y `.../reschedule` del mismo controller ya eran `[AllowAnonymous]` ("público - cancelar por link de email") — una inconsistencia entre tres endpoints del mismo flujo, no una barrera de seguridad intencional. El link real que manda el email de confirmación (`notifyClientBookingConfirmed` en `app/api/bookings/[...path]/route.ts`) no lleva ningún token. Resultado en producción: un cliente que abre ese link en un dispositivo sin sesión activa recibía `401` con body vacío; el proxy de Next.js hacía `.json()` sobre esa respuesta vacía, explotaba, y el `catch` genérico la transformaba en `"Error de conexión con el servidor"` — mensaje que ocultaba por completo que era un problema de autorización. La autocancelación por email, la funcionalidad central del flujo de cliente, estaba rota para el caso de uso normal (abrir el link desde el teléfono).

**Fix aplicado:** `GetBooking` pasa a `[AllowAnonymous]` + `[EnableRateLimiting("public-booking")]` (mismo criterio que sus dos vecinos), y el chequeo de propiedad del turno solo se aplica si hay una sesión de `Client` autenticada que no coincide con el dueño (portal "Mis turnos" sigue protegido igual que antes). Verificado: los 68 tests de integración del backend siguen en verde, y el e2e completo (reservar + cancelar) pasa end-to-end.

### 🟡 Medio

**e) CORS y cookies — configurados correctamente** (no es un hallazgo, es un punto a favor): orígenes restringidos por configuración (no wildcard), cookies de sesión `HttpOnly` + `Secure` + `SameSite=None` apropiado para cross-site entre Vercel/Render.

**f) `verifySession()` vs `isAuthenticated()`** — la protección real de datos está del lado del servidor (`[Authorize]`), `isAuthenticated()` en `src/lib/auth.ts:2-5` es solo un flag de UI (`localStorage`). No es una brecha de datos, pero conviene documentarlo para que futuros desarrolladores no confíen en él para gating real. **Actualizado 14/07:** se agregó un comentario en el propio código (`src/lib/auth.ts`) explicando exactamente esta distinción, con referencia a `verifySession()` para el caso en que se necesite confirmar sesión contra el servidor — cierra el pendiente de documentación.

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

**Actualizado 14/07:** los DTOs de `ReminderModels.cs` (`CreateCustomerProfileRequest`, `UpdateCustomerProfileRequest`, `CreateReminderRequest`, `UpdateReminderRequest`) ya tienen Data Annotations completas — `[Required, StringLength]` en teléfono/nombre, `[EmailAddress]` en email, `[Range]` en IDs e `IntervalDays`, y `[RegularExpression]` en `Status` para restringirlo a los cuatro valores válidos (`Pending|Sent|Failed|Cancelled`). Ver sección 10.

**Actualizado 15/07:** `UpdateTimeSlotRequest` (`Core/Scheduling/DTOs/`) suma `[Required]` en `StartDateTime` — cierra el último pendiente de esta sección. Como es un `DateTime` no nullable, `[Required]` valida contra el default (`0001-01-01`), cubriendo el caso de un `PUT` sin ese campo en el body. La validación de negocio (fecha futura, sin solapamiento) ya existía en `TimeSlotsController.UpdateSlot` y no se tocó. Compilación verificada: 0 errores.

---

## 4. Confiabilidad y manejo de errores

- Los 2 background services (`ReminderBackgroundService`, `NotificationRetryBackgroundService`) capturan excepciones correctamente y no tumban el proceso — buen patrón.
- Migraciones EF se aplican automáticamente al arrancar (`Program.cs:113-118`, `context.Database.Migrate()`). Es cómodo para deploys automáticos, pero significa que no hay ningún gate/revisión manual antes de que un cambio de esquema se aplique en producción — riesgo a tener en cuenta a medida que el sistema crezca. La migración `AddProfessionals` se generó pero **no se aplicó automáticamente** en esta sesión (a pedido explícito: las migraciones se aplican de forma manual) — se generó también el script SQL idempotente correspondiente (`TTurnos.Api/Scripts/add_professionals.sql`) para aplicarla a mano.
- Manejo de errores en controllers es mayormente `try/catch` devolviendo `BadRequest(ex.Message)` — funcional, pero expone mensajes de excepción interna al cliente en varios lugares, lo cual es un detalle de information disclosure menor pero recurrente. *(El caso de `CalendarController` ya no aplica — controller eliminado.)* **Actualizado 14/07:** los dos casos más expuestos (`AuthController.Login` y `PaymentsController.CreateMercadoPagoPreference`, ambos `[AllowAnonymous]`) ya no devuelven `ex.Message` al cliente — loguean a consola y responden un mensaje genérico. El resto de los controllers (autenticados, menor exposición) sigue con el patrón viejo, sin priorizar todavía. Ver sección 10.

---

## 5. Calidad de código y mantenibilidad

- **Cero tests automatizados — ✅ Resuelto (13/07)**: `backend/TTurnos.Api.Tests` cubre los 13 controllers con 68 tests de integración (Testcontainers + Postgres real). `frontend/tturnos-web` sumó una suite de 14 tests e2e con Playwright cubriendo el flujo público de reserva, el portal de cliente, y las 12 páginas admin con UI real (las únicas dos sin cobertura, Bloqueo de fechas y OTP del portal, no tienen ninguna pantalla que las use, ver sección 9). Ver secciones 8 y 9 para detalle y los bugs encontrados en el proceso (varios de backend y de frontend, algunos de cara al cliente).
- **Acoplamiento alto en el core del backend — ✅ Resuelto (13/07 piloto, extendido 14/07)**: la comunidad "Backend Namespaces & Controllers" tenía cohesión ~0.057 (muy baja) y `ApplicationDbContext` era el nodo con mayor betweenness centrality (0.118) del sistema. El piloto del 13/07 (`IProfessionalsRepository`/`ProfessionalsRepository`) se extendió el 14/07 al resto de los controllers que inyectaban `ApplicationDbContext` directo: Bookings, ContentVideos, Payments, Analytics, BlockedDates, TimeSlots, Services, BusinessSettings, SiteConfig y Gallery pasan a inyectar su propio repositorio. De los 13 controllers del inventario, ya ninguno inyecta `ApplicationDbContext` directo salvo `ProfessionalsController` (que conserva una sola consulta de `TimeSlots`, decisión documentada en sección 8) — `AuthController` y el controller de Reminders nunca lo hicieron, ya pasaban por una capa de `Service`. Ver sección 10.
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
| Validar firma webhook MercadoPago (configurar secret + revisar proxy) + fix de clave `MP_ACCESS_TOKEN`→`MercadoPago` | Crítico | ⏸️ Diferido — retomar antes de habilitar pagos reales |
| ~~Asegurar/eliminar `CalendarController` (sin auth)~~ — ✅ resuelto | Crítico | Bajo (horas) |
| ~~Rate limiting en endpoints públicos~~ — ✅ resuelto (13/07, incluye Payments) | Alto | Medio (1-2 días) |
| ~~Gitignorear y purgar `bd_turnos.sql` del working tree~~ — ✅ resuelto (13/07) | Alto | Bajo (minutos) |
| ~~Agregar Data Annotations a DTOs públicos~~ — ✅ resuelto | Medio | Medio (1-2 días) |
| ~~Módulo Profesionales (CRUD)~~ — ✅ resuelto | — | Bajo-Medio (según PRD: ~24hs) |
| ~~Suite de tests automatizados (backend)~~ — ✅ resuelto (13/07, 68 tests/13 controllers) | Medio-Alto | Alto (para cobertura razonable) |
| ~~Suite de tests e2e (frontend)~~ — ✅ resuelto (13/07, Playwright: reserva pública, mis-turnos, profesional, admin Servicios/Profesionales/Configuración/Turnos/Galería/Contenido/Cuenta/Clientes/Historial/Estadísticas/Calendario — 14 tests, cubre todas las páginas admin con UI real) | Medio-Alto | — |
| ~~Reducir acoplamiento de `ApplicationDbContext` / modularizar controllers~~ — ✅ resuelto (13/07 piloto en Professionals, extendido a los 10 controllers restantes el 14/07) | Bajo (no urgente, pero crecía con cada módulo TTURNOS) | Alto (refactor, no crítico a corto plazo) |
| **Módulos TTURNOS pendientes del PRD** (ver detalle abajo) | — | — |

**Módulos del PRD de TTURNOS Belleza aún no construidos** (estimación gruesa basada en el alcance del propio documento, sujeta a ajuste — el PRD es un esqueleto, no una spec detallada):

| Módulo | Alcance según PRD | Esfuerzo estimado* |
|---|---|---|
| ~~Servicios (extensión)~~ — ✅ resuelto (15/07) | categorías, buffer, color, orden, profesionales asociados (ya cubierto en parte por la M2M de Profesionales) | Bajo (horas-1 día) |
| ~~Agenda multi-profesional~~ — ✅ resuelto (15/07, ver sección 12) | vista día/semana/mes, drag&drop, filtros por profesional — hoy no existe nada de esto, es build desde cero | Alto (varios días, probablemente requiere librería tipo FullCalendar) |
| ~~Clientes (CRM completo)~~ — ✅ resuelto (15/07, ver sección 13) | ficha extendida: cumpleaños, Instagram, notas, fotos, profesional favorito, historial | Medio (1-2 días) |
| ~~Historial~~ — ✅ resuelto (16/07, ver sección 14) | registro detallado por turno con productos/fotos/pago | Medio (1-2 días) |
| Automatizaciones | motor visual trigger→condición→acción→espera; **reutilizable parcialmente** desde `ReminderBackgroundService`/`NotificationRetryBackgroundService` (ver hallazgo semántico en sección 5) | Alto (motor visual es un producto en sí mismo) |
| ~~Caja~~ — ✅ resuelto (16/07, primer corte, ver sección 15) | cobros, devoluciones, señas, caja diaria/mensual | Alto (nuevo dominio, toca Payments) |
| Estadísticas (extensión) | dashboards nuevos: profesional con mayores ventas, horas ocupadas/libres, ausencias | Medio (1-2 días, ya hay una base en `AnalyticsController`) |
| UX / Design system | sistema de diseño formal (botones, inputs, dark mode, etc.) | Medio-Alto (transversal a todo el frontend) |

*Esfuerzo aproximado en horas/días de desarrollo — ajustar según la tarifa y el criterio de quien arme el presupuesto final.

---

## 8. Actualización — sesión 13/07

Trabajo de seguimiento sobre esta auditoría: suite de tests de integración para el backend, un bug crítico encontrado y corregido, y arranque del piloto de reducción de acoplamiento de `ApplicationDbContext` (ítems marcados como deuda en las secciones 5 y 7).

**Suite de tests de integración (`backend/TTurnos.Api.Tests`)**
- xUnit + `Microsoft.AspNetCore.Mvc.Testing` + `Testcontainers.PostgreSql` — Postgres real en Docker por corrida, no EF InMemory, para validar migraciones reales, columnas `jsonb` y los query filters globales de multi-tenancy tal cual corren en producción.
- **68 tests, ~15-20s, cubren los 13 controllers** del inventario de la sección 1: Auth, Bookings, Professionals, Payments, Services, TimeSlots, BlockedDates, BusinessSettings, SiteConfig, ContentVideos, Gallery, Analytics, Reminders — más una suite de aislamiento multi-tenant dedicada (`MultiTenancyIsolationTests`) cruzando Bookings y Professionals entre tenants.
- Frontend sigue sin cobertura (fuera de alcance de esta sesión).

**Bug crítico encontrado y corregido: loop infinito en `TimeSlotGeneratorService`**
Escribiendo el test de éxito para `PUT /api/businesssettings` se detectó que `GenerateSlotsForDayAsync` (`TimeSlotGeneratorService.cs:58`) nunca terminaba: la condición del `while` tenía la variable del loop (`currentTime`) a ambos lados de la comparación, que se cancelaba algebraicamente dejando una condición constante (`slotDuration <= startTime + 8h`), casi siempre verdadera. Con cualquier configuración normal de horarios, el método generaba `TimeSlot` nuevos sin parar. Se dispara desde `PUT /api/businesssettings` (`RegenerateAllSlotsAsync`) — colgó la corrida de tests ~12 minutos y tumbó el contenedor de Postgres la primera vez. Se verificó que **el frontend actual no tiene UI conectada a este endpoint** (no está en el panel admin), así que no era una bomba activa en el uso normal, pero sí explotable directo por API con un JWT de Admin.
**Fix aplicado:** calcular el fin de la jornada laboral (`StartTime + 8h`) una sola vez fuera del loop en vez de re-derivarlo de `currentTime` en cada vuelta. Verificado: genera slots correctamente y termina en <1s; suite completa en verde.

**Bug encontrado, diferido a propósito: config de MercadoPago** — ver hallazgo (g) en sección 2.

**Purga de `bd_turnos.sql`** — ver hallazgo (d) en sección 2, ya no está en el working tree.

**Piloto de reducción de acoplamiento de `ApplicationDbContext`** (sección 5 y 7)
Se extrajo `Core/Professionals/Repositories/{IProfessionalsRepository, ProfessionalsRepository}.cs`. `ProfessionalsController` ya no inyecta `ApplicationDbContext` para sus propias operaciones (listados, altas, bajas, conteo para límites de plan, resolución de servicios, cuentas de usuario vinculadas) — solo lo conserva para una consulta puntual de `TimeSlots` en `GetAvailable`, documentada como decisión deliberada (esa consulta es de Scheduling, no de Professionals; abstraerla ahí mezclaría dominios en vez de reducir acoplamiento). Registrado en DI (`Program.cs`). Alcance explícitamente acotado a un solo dominio piloto — **el resto de los 12 controllers sigue sin cambios**; replicar el patrón queda pendiente de decisión explícita antes de tocar más controllers (es el refactor "Alto" de la sección 7, no se hizo de una).

**Rate limiting extendido a `PaymentsController`** (sección 2, hallazgo c)
Los tres endpoints anónimos de `PaymentsController` (`create-preference`, el webhook de MercadoPago, y `GET {bookingId}`) no tenían ninguna política de rate limiting — el único controller público que quedaba sin cubrir tras el fix original del 05/07. Se aplicó `[EnableRateLimiting("public-booking")]` (20 req/min) a `create-preference` y `GetPaymentByBooking`, mismo criterio que el resto de los endpoints públicos de reservas. Para el webhook se creó una política nueva, `"payments-webhook"` (60 req/min) — se separó de `"public-booking"` porque ese tráfico viene de la infraestructura de MercadoPago (servidor a servidor), no de un navegador de un usuario final, y un límite pensado para clientes reales podría cortar notificaciones de pago legítimas en ráfaga. `GetAllPayments` (solo Admin) se dejó sin límite, mismo criterio que el resto del panel admin autenticado. Verificado: compila sin errores y los 68 tests de integración del backend siguen en verde. La validación de firma HMAC del webhook y la clave de configuración de MercadoPago (hallazgos a y g) siguen diferidos a propósito — este cambio no dependía de esos fixes.

---

## 9. Actualización — sesión 13/07 (e2e de frontend)

Primer test end-to-end del frontend (Playwright), arrancando por el flujo público de reserva — la decisión fue e2e real contra la app corriendo en vez de tests de componente aislados, para tener confianza de integración real con la API .NET.

**Riesgo identificado antes de escribir el primer test:** correr el backend local con `dotnet run` para e2e usa por defecto la base de datos real de desarrollo (`bd_turnos`) y credenciales reales de WhatsApp (Meta API) y Gmail SMTP ya cargadas en `appsettings.json` — un test que crea una reserva real mandaría notificaciones reales y ensuciaría la base de dev. Se resolvió con un entorno `Testing` dedicado en el backend, replicando lo que ya hacía `CustomWebApplicationFactory` para los tests .NET pero para una instancia real corriendo:
- `NoopNotificationProvider` (`Infrastructure/Integrations/`) reemplaza a `GmailProvider`/`WhatsAppProvider` cuando `ASPNETCORE_ENVIRONMENT=Testing` (`Program.cs`).
- `appsettings.Testing.json` apunta a una base separada (`bd_turnos_e2e`) en el mismo servidor Postgres local — se crea y migra sola al arrancar (`Database.Migrate()`), sin tocar la base real.
- **Gotcha real de .NET encontrado en el proceso:** `dotnet run` ignora la variable de entorno `ASPNETCORE_ENVIRONMENT` del shell si existe `launchSettings.json`, porque el perfil por defecto (`"http"`) fuerza `"ASPNETCORE_ENVIRONMENT": "Development"` — la primera corrida de verificación terminó conectada a la base real sin querer (se detectó antes de escribir ningún dato, solo un `GET`, sin impacto). Se resolvió con la flag `--no-launch-profile`, que hace que `dotnet run` respete la variable de entorno externa. Útil para cualquier otra herramienta que necesite arrancar el backend en un modo no-Development desde fuera de Visual Studio/Rider.

**Infraestructura (`frontend/tturnos-web`):**
- `@playwright/test` instalado. `playwright.config.ts` levanta **dos** `webServer` (backend .NET en modo `Testing`, frontend `next dev`) con `reuseExistingServer: false` a propósito — si el usuario ya tiene el backend/frontend real corriendo en esos puertos, Playwright falla por puerto ocupado en vez de engancharse silenciosamente a la instancia real.
- `e2e/global-setup.ts` siembra datos vía la API real de admin (registra un admin, crea un servicio, genera turnos con `PUT /api/businesssettings` — el mismo endpoint que se corrigió en la sección 8), no SQL directo. Usa sufijos únicos por corrida para poder ejecutarse repetidas veces sin resetear la base de e2e.
- Se agregaron atributos `data-testid` a `BookingForms.tsx` y `app/(client)/cancelar/page.tsx` para selectores estables (cambio puramente de testabilidad, sin tocar lógica ni estilos).

**Test 1 (`e2e/booking.spec.ts`):** un cliente ve los servicios reales, completa el formulario, elige un turno generado por `BusinessSettings`, reserva, ve la confirmación, y cancela el turno por el link público de `/cancelar`.

**Bug encontrado con el primer intento de este test — ver hallazgo (h) en sección 2.** La mitad de "reservar" pasó a la primera; la mitad de "cancelar" reveló que el flujo público de autocancelación estaba roto para clientes reales. Corregido y verificado con el propio e2e más la suite de 68 tests de integración del backend.

**Test 2 (`e2e/admin-services.spec.ts`):** login de admin (con el admin sembrado en `global-setup.ts`) y CRUD completo de Servicios desde el panel real — crear, editar precio, borrar. Se agregaron `data-testid` a `app/(admin)/admin/login/page.tsx` y `app/(admin)/admin/servicios/page.tsx` (mismo criterio de testabilidad que el flujo de reserva).

**Portal "Mis turnos": el mecanismo OTP existe en el backend pero no tiene ninguna página que lo use — hallazgo nuevo (13/07), no corregido**
Al encarar el e2e del portal de cliente se encontró que `app/(client)/mis-turnos/page.tsx` **no usa OTP en absoluto**: es búsqueda anónima por email vía `GET /api/bookings/by-email`, sin ningún paso de verificación. El mecanismo OTP completo sí existe del lado del backend (`AuthService.RequestClientAccessAsync`/`VerifyClientOtpAsync`, genera código de 6 dígitos, lo hashea, expira a los 15 min) y el proxy de Next.js (`app/api/auth/[...path]/route.ts`) ya tiene la lógica de envío por email lista (`sendOtpEmail`, oculta el código al browser antes de reenviar la respuesta) — pero **ninguna página del frontend llama a `client/access/request` ni `.../verify`**. Es una feature construida a medias: backend + proxy completos, sin la pantalla de "pedime el código y lo ingreso" que los conecte. No es un problema de seguridad (el código nunca llega al browser sin verificar), es simplemente código muerto desde la perspectiva del usuario — decisión del usuario (13/07): no construir esa UI ahora, testear el flujo real que sí existe.

**Test 3 (`e2e/mis-turnos.spec.ts`):** cubre el flujo real de "Mis turnos" (búsqueda por email, sin OTP) — ver turnos propios, cancelar uno, reprogramar otro. `global-setup.ts` siembra dos reservas con un email común vía `POST /api/bookings` público (mismo camino que usaría un cliente real). Se agregaron `data-testid` a `app/(client)/mis-turnos/page.tsx`.

**Test 4 (`e2e/admin-professionals.spec.ts`):** CRUD completo de Profesionales desde el panel real — crear, editar apellido, borrar. Mismo patrón que Servicios. `data-testid` en `app/(admin)/admin/profesionales/page.tsx`.

**Nota sobre "Bloqueo de fechas" (BlockedDatesController):** al revisar qué páginas admin conectar, se confirmó que **ninguna página ni ruta proxy del frontend usa este controller** (`grep` completo de `app/` y `src/` sin resultados, y no existe `app/api/blockeddates/*`) — mismo patrón que el hallazgo del OTP: backend completo (y con tests de integración .NET), sin UI que lo conecte. No se armó e2e para esto por la misma razón que el OTP: no hay nada que un usuario pueda clickear. Fuera de alcance de esta sesión, no corregido.

**Cache de 5 min en `/api/siteconfig` no se invalidaba al guardar — hallazgo nuevo (13/07), ✅ resuelto**
Encontrado escribiendo `e2e/admin-config.spec.ts`: el `PUT` de Configuración actualiza el backend correctamente (aparece "Configuración guardada"), pero el proxy `app/api/siteconfig/route.ts` cachea el `GET` interno con `next: { revalidate: 300 }` sin ningún mecanismo de invalidación — un admin que guarda un cambio y recarga su propia página de Configuración podía ver el valor viejo hasta por 5 minutos, aunque el guardado hubiera funcionado. Causa raíz distinta a los hallazgos (g)/(h): no es un bug de autorización ni de datos, es cache de Next.js sin invalidar. **Fix aplicado:** se etiquetó el fetch cacheado (`tags: ["siteconfig"]`) y el `PUT` llama `revalidateTag("siteconfig")` apenas el backend confirma el guardado — mantiene el cache de 5 min para lecturas normales (bueno para el sitio público) pero lo salta inmediatamente después de un cambio real. Verificado con el propio e2e (guarda → recarga → valor actualizado, ya no el default sembrado por la migración `AddSiteConfigGalleryAndCustomFields`).

**Test 5 (`e2e/admin-config.spec.ts`):** actualiza el nombre del negocio desde el panel real y confirma que persiste tras un reload — el test que encontró el hallazgo del cache.

**Test 6 (`e2e/professional-agenda.spec.ts`):** login de profesional (rol `Professional`, distinto de Admin) y gestión de su propia agenda (`GET /api/timeslots/mine`) — crea un turno disponible y lo elimina. `global-setup.ts` ahora también crea un Profesional y le activa acceso propio vía `POST /api/auth/professional-account` (mismo endpoint que usa `/admin/profesionales` para esto). `data-testid` en `app/(professional)/profesional/login/page.tsx` y `app/(professional)/profesional/agenda/page.tsx`.

**Test 7 (`e2e/admin-timeslots.spec.ts`):** admin crea un turno asignado a un profesional desde `/admin/turnos` y lo elimina. `data-testid` en la página, incluyendo el filtro por profesional de la lista (necesario porque la lista pagina de a 6 y con muchas corridas acumuladas el turno nuevo cae en una página lejana).

**Rate limit "auth" agotado corriendo specs de admin en paralelo — hallazgo nuevo (13/07), ✅ resuelto**
Al sumar el 4° y 5° spec que hacen login de admin (más el de profesional), correr la suite completa en paralelo empezó a fallar con `"Error de conexión con el servidor"` en logins que deberían funcionar. Causa: `/api/auth/login` y `/api/auth/register` comparten la política de rate limiting `"auth"` (5 req/min por IP, ver sección 2 hallazgo c) — mismo aviso que ya dejaron documentado los tests de integración .NET (`AuthEndpointsTests.cs`) sobre este mismo límite. Con 4 logins de admin + 1 de profesional + 1 register corriendo casi simultáneo, se superaba el límite; el 429 resultante tiene body vacío, y el proxy de Next.js (mismo patrón que el hallazgo h) lo reporta como error de conexión en vez de "demasiados intentos".
**Fix aplicado (en la suite de e2e, no en el backend):** `global-setup.ts` loguea al admin **una sola vez**, vía un browser real de Playwright, y guarda la sesión con `storageState`. Los specs `admin-professionals`, `admin-config` y `admin-timeslots` reusan esa sesión en vez de loguearse de nuevo; solo `admin-services.spec.ts` sigue logueando desde cero por UI, para mantener cobertura real del formulario de login. `professional-agenda.spec.ts` también loguea por su cuenta (un solo login más, dentro del margen).

**Gotcha de Playwright encontrado al implementar el fix anterior:** `storageState` no persiste `sessionStorage` (por diseño de Playwright), y `src/lib/auth.ts` usa exactamente esa ausencia como señal de "ventana nueva con una cookie vieja" para forzar un logout silencioso (`isFreshWindow()`/`forceLogoutStaleWindow()`, ver hallazgo (f) de la auditoría original). Sin el fix, cada spec que reusaba `storageState` quedaba deslogueado apenas cargaba la página. Solucionado sembrando el marcador de sesión (`sessionStorage.setItem("tturnos_session_active", "true")`) vía `page.addInitScript()` antes de navegar.

**Cache de Next.js sin invalidar en 4 rutas más (además de siteconfig) — hallazgo nuevo (13/07), ✅ resuelto**
Con la suite corriendo repetidas veces seguidas para investigar flakiness, se detectó el mismo patrón del hallazgo de `siteconfig` replicado en `/api/services`, `/api/professionals`, `/api/gallery` y `/api/content-videos`: sus `route.ts` cachean el `GET` (`next: { revalidate: 60 }`) sin ningún `revalidateTag`/`revalidatePath` en los handlers `POST`/`PUT`/`DELETE`. Como el cache de `fetch` de Next.js en modo `dev` persiste en disco (`.next/cache`) entre reinicios del proceso, corridas de e2e rápidas y seguidas mostraban servicios/profesionales de 1-2 corridas atrás en vez de los recién creados — no es solo un problema de testing, es el mismo bug que hallazgo (siteconfig): **un admin real que crea o edita un Servicio/Profesional/item de Galería/Video puede no verlo reflejado en el sitio público hasta 60 segundos después**, y el proxy no dispara ningún error visible (no es un "problema de conexión", solo cache silencioso).
**Fix aplicado:** mismo patrón que `siteconfig` — se etiquetó cada `fetch` cacheado (`tags: ["services"]`, `["professionals"]`, `["gallery"]`, `["content-videos"]`) y se agregó `revalidateTag(...)` en el `POST` (mismo archivo) y en el `PUT`/`DELETE` (archivo `[...path]`/`[id]` correspondiente) de cada uno. También se etiquetaron las mismas claves en `app/api/public-data/route.ts` (agrega servicios/galería/siteconfig/videos en un solo fetch para la home), así se invalida en conjunto sin duplicar lógica.

**Segunda vuelta del mismo bug de cache — la causa real era `global-setup.ts`, no la app**
Después del fix anterior, el flake volvió a aparecer específicamente en `admin-timeslots.spec.ts` (el dropdown de profesionales no encontraba al recién creado) en corridas repetidas. Causa: `global-setup.ts` crea las entidades pegándole **directo al backend** (`localhost:5048`) en vez de pasar por el proxy de Next.js (`localhost:3000`) — el `revalidateTag()` que se acababa de agregar vive en el *proxy*, así que nunca se disparaba para nada sembrado por el setup, aunque sí funcionaba correctamente para cambios hechos desde la UI real (por eso los primeros tests después del fix pasaban: partían de cache vacío tras un `rm -rf .next` manual, no porque el fix realmente cerrara el problema). **Fix real:** `global-setup.ts` ahora loguea al admin primero (con un browser real de Playwright) y usa esa misma sesión (`context.request`, que reenvía las cookies automáticamente) para crear Servicios, Profesionales, Galería y Contenido a través del proxy — igual que lo haría un admin real desde el panel. Lo que no tiene cache en el proxy (reservas, `businesssettings` — este último ni siquiera tiene ruta proxy propia, otro caso de backend sin UI) se sigue creando directo contra el backend, sin necesidad de pasar por el proxy.
Verificado con 3 corridas seguidas sin resetear la base ni el cache de `.next` — la prueba real de que esta vez la causa raíz quedó resuelta, no solo enmascarada por partir de cache vacío.

**Estabilidad de la suite bajo carga compartida**
Los 9 specs comparten un único backend .NET en modo dev (`Kestrel` + un solo pool de conexión a Postgres) y un único `next dev`. Con 6 workers en paralelo (el default), el backend se volvía notoriamente más lento bajo carga real, y aparecían timeouts intermitentes en aserciones con el timeout default de Playwright (5s para `expect`, 30s por test) que nada tenían que ver con bugs de la app. **Fix aplicado en `playwright.config.ts`:** `workers: 3`, `timeout: 45_000` (por test), `expect: { timeout: 10_000 }` (default de aserciones).

**Test 8 (`e2e/admin-gallery.spec.ts`) y Test 9 (`e2e/admin-content.spec.ts`):** editar y borrar un item de Galería / video de Contenido desde el panel real. La creación no se prueba por e2e — el input de "pegar URL directamente" de `CloudinaryUpload` solo aparece cuando ya hay un valor cargado, así que probar la creación real implicaría subir un archivo de verdad a Cloudinary (servicio externo real), fuera del alcance de un e2e aislado. `global-setup.ts` siembra un item de cada uno con una URL de ejemplo ya cargada.

**Test 10 (`e2e/admin-cuenta.spec.ts`):** cambio de contraseña del admin — solo se prueba el camino de error (contraseña actual incorrecta). El camino exitoso mutaría las credenciales del admin compartido por toda la suite (`seed.adminEmail`/`adminPassword`), y `admin-services.spec.ts` loguea con esas mismas credenciales por UI en paralelo (3 workers) — una carrera real dado el patrón de estado compartido que ya causó los dos bugs de cache de esta sección. Decisión deliberada de no probar el camino exitoso en vez de arriesgar otro flake intermitente.

**"Reservar turno" en Clientes → Nuevo aviso siempre mostraba "No hay turnos disponibles" — hallazgo nuevo (13/07), ✅ resuelto**
Encontrado escribiendo `e2e/admin-clientes.spec.ts`: al programar un aviso para un cliente, el selector de turnos existentes del modal "Nuevo aviso" (`app/(admin)/admin/clientes/page.tsx`, `ReminderForm`) mostraba **"No hay turnos disponibles" siempre**, sin importar cuántos turnos hubiera realmente cargados — forzando al admin a "Crear turno manualmente" en todos los casos. Causa: el código filtraba `slots.filter((s) => s.isAvailable)`, pero `GET /api/timeslots/available` no incluye ese campo en su respuesta (es redundante — el endpoint ya solo devuelve turnos disponibles por definición). Con el campo siempre `undefined`, el filtro descartaba absolutamente todos los turnos. Confirmado con el trace real de Playwright: la respuesta traía 60+ turnos con datos completos, pero el filtro los vaciaba a cero antes de renderizar. **Fix aplicado:** se sacó el filtro redundante (y el campo `isAvailable` inexistente de la interfaz `TimeSlot` del componente) — los turnos que trae el endpoint ya están disponibles, no hace falta re-filtrarlos.
**Nota de UX menor — ✅ resuelta (14/07):** el campo "Detalle del turno" del mismo formulario no tenía asterisco de obligatorio, pero el backend exige `Subject` no vacío (`CreateBookingRequest`) — un admin que lo dejaba vacío recibía "No se pudo reservar el turno" sin más detalle. Se agregó el asterisco y el atributo `required` al input, mismo fix aplicado en paralelo al campo equivalente del modal "Nueva reserva" de Calendario (ver hallazgo de esta misma sección). Ver sección 10.

**Test 11 (`e2e/admin-clientes.spec.ts`):** el flujo completo de Clientes — crear cliente, ver detalle, editar notas, programar un aviso (que reserva un turno real + crea el `ScheduledReminder`, ejercitando el bug de arriba), cancelar el aviso, borrar el cliente. Es el spec más largo de la suite: encontró el bug del filtro `isAvailable` y también un `confirm()` nativo sin manejar en la cancelación de avisos (mismo patrón que otros specs, agregado a tiempo).

**Historial crasheaba al buscar reservas sin servicio asignado — hallazgo nuevo (13/07), ✅ resuelto**
Encontrado escribiendo `e2e/admin-historial.spec.ts`: al escribir en el buscador de `/admin/historial`, la página entera crasheaba con `TypeError: Cannot read properties of null (reading 'toLowerCase')`. Causa: el filtro de búsqueda hacía `b.service.toLowerCase()` sin protegerlo, mientras que el campo hermano `subject` sí estaba protegido (`(b.subject ?? "").toLowerCase()`) — `Service` es opcional en `CreateBookingRequest` (`string?`), así que cualquier reserva creada sin especificar servicio (como las que siembra la propia suite de e2e, pero también cualquier reserva real cargada sin ese dato) rompía la búsqueda para **todo el panel de Historial**, no solo para esa fila. La interfaz `BookingRecord` del componente además declaraba `service: string` (no-nullable), ocultando el problema en tiempo de compilación. **Fix aplicado:** mismo patrón que `subject` — `(b.service ?? "").toLowerCase()` — y se corrigió el tipo a `service?: string` para que TypeScript refleje la realidad del dato.

**Test 12 (`e2e/admin-historial.spec.ts`):** busca una reserva sembrada específicamente para este test (para no depender del estado final de las reservas de "Mis turnos", que cancela/reprograma otro spec en paralelo), ve el detalle en el modal, lo cierra clickeando el backdrop, y confirma la reserva desde la fila de la tabla — encontró el bug de arriba.

**Test 13 (`e2e/admin-estadisticas.spec.ts`):** dashboard de solo lectura — confirma que el panel carga sin errores, que los KPIs principales muestran valores numéricos (sin asumir un total puntual, ya que otros specs mutan reservas en paralelo) y que las tres secciones (reservas por mes, servicios más solicitados, próximas reservas) están presentes. No se encontró ningún bug — la página ya usaba `service?.replace(...)` con optional chaining en el único lugar donde podría haber repetido el problema de Historial.

**"Nueva reserva" del Calendario admin siempre fallaba con "No se pudo crear la reserva" — hallazgo nuevo (13/07), ✅ resuelto**
Encontrado escribiendo `e2e/admin-calendario.spec.ts`: el modal "Nueva reserva" de `/admin/calendario` (reservar directo desde un turno libre del calendario, sin pasar por Clientes) nunca lograba crear la reserva — el backend devolvía 400 y el formulario mostraba el mensaje genérico de fallback. Causa: el formulario no tiene ningún campo para `Subject` (Detalle del turno) y nunca lo manda en el body de `POST /api/bookings` — pero `CreateBookingRequest.Subject` es `[Required, StringLength(200, MinimumLength = 1)]` en el backend, así que la validación del `ModelState` rechazaba **cualquier** intento, sin excepción, silenciosamente (la respuesta de error no trae un campo `message` legible, así que el usuario solo veía el fallback "No se pudo crear la reserva" sin ninguna pista de qué faltaba). Es más severo que la nota de UX menor ya documentada para el mismo campo en `ReminderForm` (Clientes, ver hallazgo del bug 6 de esta sección): ahí el campo existe pero no está marcado como obligatorio en la UI; acá el campo directamente no existe, así que la función "reservar desde el calendario" estaba 100% rota para cualquier admin que la usara. **Fix aplicado:** se agregó el input "Detalle del turno" (mismo patrón que `ReminderForm`) al modal, con `required` en el HTML y wireado a `reserveForm.subject`, que ya viaja en el body por el spread `...reserveForm`.

**Test 14 (`e2e/admin-calendario.spec.ts`):** navega al calendario, busca (día por día, no asume que "hoy" tenga turnos libres — el horario comercial puede haber cerrado ya, o los días recientes pueden estar completos por la propia acumulación de datos de la suite) un turno libre, lo reserva con el formulario completo, lo verifica en el panel del día, ve el detalle en el modal, y lo libera (`confirm()` nativo) — encontró el bug de arriba. `data-testid` agregados a `admin/estadisticas/page.tsx` y `admin/calendario/page.tsx`.

**Estado: 14 tests, todos en verde, corridas repetidas confirmadas estables.**

**Pendiente:** ninguno — Bloqueo de fechas y OTP siguen sin UI que testear (ver notas arriba), no son specs pendientes sino features sin pantalla.

**Nota de mantenimiento:** con muchas corridas acumuladas en la misma sesión de desarrollo, los días más cercanos del calendario (turnos generados con `maxDaysInAdvance: 10`) pueden agotar sus turnos libres — la propia base `bd_turnos_e2e` no se resetea sola entre corridas (deliberado, ver sección de mantenimiento en la memoria del proyecto). El test de Calendario ya contempla esto probando día por día en vez de asumir uno fijo; si algún otro spec empezara a fallar por falta de turnos disponibles, resetear la base es la solución (`DROP DATABASE bd_turnos_e2e;`).

---

## 10. Actualización — sesión 14/07

Dos commits ("1407") sobre el estado del 13/07: el refactor de acoplamiento que quedó como piloto en la sección 8 se extendió a todo el backend, más un puñado de fixes menores encontrados al hilo (information disclosure, validación de DTOs, UX de campos obligatorios).

**Rollout completo de la capa de repositorio (cierra el pendiente de las secciones 5, 7 y 8)**
El piloto del 13/07 (`IProfessionalsRepository`/`ProfessionalsRepository`, un solo controller) se replicó a los 10 controllers restantes que todavía inyectaban `ApplicationDbContext` directo: `BookingsController`, `ContentVideosController`, `PaymentsController`, `AnalyticsController`, `BlockedDatesController`, `TimeSlotsController`, `ServicesController`, `BusinessSettingsController`, `SiteConfigController` y `GalleryController` (`Modules/Beauty/BeforeAfter`) pasan a inyectar su propio `I*Repository`, registrado en `Program.cs`. Verificado leyendo los diffs: es una extracción mecánica (mover las queries LINQ tal cual a la clase `*Repository`, el controller solo orquesta y mapea a DTO), sin cambios de comportamiento — por ejemplo `TimeSlotsController.GetAvailableSlots` sigue filtrando por `IsAvailable`/fecha/`professionalId` con el mismo `Where`, solo que ahora vive en `TimeSlotsRepository.GetAvailableAsync`.

De los 13 controllers del inventario, ya **ninguno** inyecta `ApplicationDbContext` directo salvo `ProfessionalsController` (conserva una sola consulta de `TimeSlots` en `GetAvailable`, decisión ya documentada en sección 8 — es una consulta de Scheduling, no de Professionals). `AuthController` y el controller de Reminders nunca tuvieron el problema: ya pasaban por `AuthService`/`ReminderService`/`NotificationService`, que sí siguen usando `ApplicationDbContext` internamente (correcto, es su capa de datos).

**Verificado:** `dotnet build` compila sin errores (solo el warning preexistente y no relacionado de `MailKit` 4.15.1). La suite de 68 tests de integración **no se re-corrió en esta sesión** — requiere Docker (Testcontainers) para levantar Postgres real, y no estaba disponible en el entorno donde se hizo esta revisión. Dado que el refactor es mecánico y no toca lógica de negocio, el riesgo de regresión es bajo, pero correr la suite completa antes de deployar es la validación pendiente más importante de esta sesión — no se puede dar por cerrado el pendiente de la sección 8 sin eso.

**Information disclosure: `AuthController.Login` y `PaymentsController.CreateMercadoPagoPreference` — ✅ resuelto parcialmente**
Los dos endpoints anónimos de mayor exposición señalados en la sección 4 dejaron de devolver `ex.Message` al cliente: ahora loguean el detalle a consola (`Console.WriteLine`) y responden un mensaje genérico (`"Error al iniciar sesión"` / sin el campo `detail`). El resto de los controllers —autenticados, menor superficie de ataque— sigue con el patrón `BadRequest(ex.Message)` sin tocar; no se replicó el fix a todos a propósito, se priorizaron los dos endpoints públicos.

**Validación agregada a los DTOs de Reminders (`ReminderModels.cs`) — cierra el pendiente de la sección 3**
`CreateCustomerProfileRequest`, `UpdateCustomerProfileRequest`, `CreateReminderRequest` y `UpdateReminderRequest` (usados por el flujo de "Nuevo aviso" de Clientes, sección 9) suman `[Required]`/`[StringLength]` en teléfono y nombre, `[EmailAddress]` en email, `[Range]` en `CustomerProfileId`/`BookingId`/`IntervalDays`, y `[RegularExpression]` en `Status` de `UpdateReminderRequest` para restringirlo a los cuatro valores válidos del enum (`Pending|Sent|Failed|Cancelled`) en vez de aceptar cualquier string. Sigue pendiente solo `UpdateTimeSlotRequest` (menor prioridad, ver sección 3).

**UX: asterisco de obligatorio en "Detalle del turno" (Clientes y Calendario) — ✅ resuelto**
Cierra la nota de UX menor documentada en la sección 9 (test 11, `ReminderForm` de Clientes) y refuerza el fix del bug de la misma sección (test 14, modal "Nueva reserva" de Calendario): ambos campos "Detalle del turno" ahora muestran `*` en el label y tienen el atributo HTML `required`, coherente con que el backend exige `Subject` no vacío (`CreateBookingRequest`).

**Nota de código, no de seguridad: `mejoras.txt`**
Se agregó un archivo vacío (`mejoras.txt`, 0 bytes) en la raíz del repo en el mismo commit del refactor. Sin contenido, sin impacto — mencionado solo por completitud del inventario de cambios de la sesión.

**Nota para el resto de esta auditoría:** varias rutas de archivo citadas en las secciones 1-9 (p.ej. `TTurnos.Api/Controllers/PaymentsController.cs`, `TTurnos.Api/Services/GoogleCalendarService.cs`) reflejan la estructura plana `Controllers/`/`Services/` que el proyecto tenía originalmente. El backend ya está reorganizado bajo `Core/`, `Modules/`, `Infrastructure/`, `Shared/`, `SaaS/`, `Enterprise/` (arquitectura "FASE 1" del roadmap de generalización, confirmada commiteada desde antes del 13/07) — por ejemplo `PaymentsController.cs` vive hoy en `Core/Payments/Controllers/`. Las rutas viejas en este documento son válidas como referencia histórica de *qué* archivo, no de *dónde* está hoy; no se reescribieron retroactivamente para no romper la trazabilidad de cuándo se encontró cada hallazgo.

---

## 11. Actualización — sesión 15/07

Cierre del último pendiente menor de validación (sección 3) y arranque de los módulos pendientes del PRD de TTURNOS Belleza (sección 7): primer módulo, **Servicios (extensión)**.

**`UpdateTimeSlotRequest` sin anotaciones — ✅ resuelto**
Se agregó `[Required]` a `StartDateTime` (`Core/Scheduling/DTOs/UpdateTimeSlotRequest.cs`). Al ser un `DateTime` no nullable, valida contra el default (`0001-01-01`), cubriendo un `PUT` sin ese campo en el body. La validación de negocio existente en `TimeSlotsController.UpdateSlot` (fecha futura, sin solapamiento) no se tocó. Cierra el pendiente de la sección 3.

**Módulo Servicios (extensión) — ✅ resuelto (15/07)**
Alcance según el PRD (sección 5 de `TTurnosRoadmap.md`): categorías, buffer, color, orden — de estos, "orden" y "profesionales asociados" (M2M) ya existían desde el módulo Profesionales; se agregó lo que faltaba:

- **Backend** (`Core/Services/Entities/Service.cs`): tres columnas nuevas — `Category` (`string?`, libre), `BufferMinutes` (`int`, default 0, sin uso todavía en la generación de slots — es dato informativo/preparatorio, `TimeSlotGeneratorService` sigue generando slots de duración fija por `BusinessSettings`, no por servicio), `Color` (`string`, hex, default `#7c3aed`, mismo patrón que `Professional.CalendarColor`).
- `ServiceRequest` (`Core/Services/Controllers/ServicesController.cs`) suma validación **desde el día uno** para los campos nuevos, mismo criterio que `ProfessionalRequest`: `[StringLength(100)]` en `Category`, `[Range(0, 480)]` en `BufferMinutes` (tope de 8 horas), `[Required, RegularExpression]` en `Color` para forzar hex válido (`#RRGGBB`).
- Migración EF `AddServiceCategoryBufferColor` generada (no aplicada manualmente en la base de dev a propósito, mismo criterio que el resto del proyecto — se aplica sola al arrancar la app vía `context.Database.Migrate()`, o al levantar el entorno `Testing` de e2e, donde ya se verificó). El `defaultValue` de la columna `Color` en la migración se ajustó a mano a `"#7c3aed"` (scaffolding de EF lo dejaba en `""`) para que los registros existentes no queden con un hex inválido.
- **Frontend** (`app/(admin)/admin/servicios/page.tsx`): inputs de Categoría (texto libre), Buffer (número, minutos, 0-480) y Color (`<input type="color">`, mismo patrón que `/admin/profesionales`) en el formulario; la card del listado ahora muestra un punto de color junto al título y la categoría debajo del nombre, si está cargada.
- **Fuera de alcance a propósito** (no estaba en el pedido "extensión" del PRD ni es parte del esfuerzo "Bajo" estimado): usar `BufferMinutes` para separar turnos generados en `TimeSlotGeneratorService`, y agrupar/filtrar por categoría en la página pública de Servicios (`app/(public)/servicios/page.tsx`) — ese archivo además usa un sistema de diseño distinto (`midnight`/`lux`) al del resto del admin (`cream`/`charcoal`/`blush`), aparentemente remanente del template original previo al pivot a TTURNOS Belleza; no se tocó.

**Verificado:** `dotnet build` sin errores. `dotnet test` sobre `TTurnos.Api.Tests`: **68/68 en verde** (primera vez que se re-corre la suite completa desde el refactor de repositorios del 14/07 — cierra también esa validación pendiente de la sección 10, ahora con Docker disponible en el entorno). Se agregó un segundo test a `e2e/admin-services.spec.ts` (categoría/buffer/color se guardan y persisten al reabrir edición); los 2 tests del spec pasan, confirmando además que la migración se aplica sola sobre `bd_turnos_e2e` al levantar el backend en modo `Testing`.

---

## 12. Actualización — sesión 15/07 (Agenda multi-profesional)

Segundo módulo del PRD encarado en la misma sesión, siguiendo a Servicios (sección 11). Decisión previa acordada con el usuario: usar una librería (`react-big-calendar`) en vez de extender a mano el grid CSS existente, y en el primer corte cubrir vista Semana con columnas por profesional + colores + drag&drop de reprogramación + vista Día — el ítem "Alto" del PRD (sección 6: día/semana/mes, drag&drop, filtros, colores, conflictos).

**Alcance construido:**
- **Librería:** `react-big-calendar` 1.20 + `date-fns` 4 (localizer) + `@types/react-big-calendar` (dev). El addon `dragAndDrop` de la propia librería (`react-big-calendar/lib/addons/dragAndDrop`) se usa tal cual, sin dependencias extra — internamente es mouse-based (`onMouseDown`/`mousemove`/`mouseup`), no HTML5 DnD nativo, dato relevante para cómo se testeó (ver abajo).
- **Componente nuevo** `src/components/calendar/AgendaCalendar.tsx`: envuelve `Calendar` con `withDragAndDrop`, mapea los `TimeSlot` del backend a eventos (columna = profesional vía `resourceId`, color = `Professional.CalendarColor`, turnos libres con borde punteado vs. reservados con relleno sólido — más opaco si es `Pending`, sólido si es `Confirmed`), y expone un componente de evento custom (`AgendaEventContent`) solo para poder colgarle `data-testid`/`data-slot-id`/`data-booking-id` estables (react-big-calendar no los expone de otra forma).
- **`/admin/calendario`** (`app/(admin)/admin/calendario/page.tsx`): se agregaron tabs "Mes / Semana / Día" arriba del calendario. La vista Mes existente (grid + panel lateral) queda intacta y sigue siendo la vista por defecto; Semana/Día usan `AgendaCalendar` con un filtro por profesional propio (antes solo existía dentro de la vista Mes).
- **Reprogramar arrastrando:** al soltar un turno reservado sobre otra celda, el componente busca — dentro de los turnos del mismo profesional y mismo día — el turno **disponible** más cercano en el tiempo al punto donde se soltó (no exige coincidencia exacta al minuto, porque los `TimeSlot` son recursos fijos generados por `BusinessSettings`/creados a mano, no horarios libres continuos). Si no hay ningún turno disponible ese día para ese profesional, se cancela la reprogramación con un aviso. Solo los turnos reservados son arrastrables (`draggableAccessor`); los turnos libres no tienen sentido moverlos.
- **Backend nuevo:** `POST /api/bookings/{id}/admin-reschedule` (`Core/Bookings/Controllers/BookingsController.cs`, `[Authorize(Roles="Admin")]`) — mismo mecanismo transaccional que el `reschedule` público existente (`TryClaimSlotAsync`/`ReleaseSlotAsync` de `IBookingsRepository`), pero **sin** las dos restricciones pensadas para el flujo de autoservicio del cliente: acá un admin sí puede mover turnos `Confirmed` (el público exige WhatsApp para esos) y no está pensado para rate limiting de endpoint anónimo (mismo criterio que el resto del panel admin autenticado, ver sección 2 hallazgo c). No se tocó el endpoint público existente.
- **Bug latente encontrado y corregido de paso:** los modales de "Nueva reserva" y "Detalle de reserva", y el link de WhatsApp del detalle, calculaban la fecha mostrada a partir de `selectedDay` + `current.month/year` (estado que solo existe en la vista Mes) en vez de derivarla del propio `startDateTime` del turno. Funcionaba por coincidencia en Mes, pero en Semana/Día esos modales habrían mostrado una fecha vacía o incorrecta. Se corrigió para calcular la fecha siempre desde `parseLocalDate(slot.startDateTime)`, válido en cualquier vista.

**Explícitamente fuera de alcance de este corte** (PRD "Alto" completo, no se pretendió cerrar entero de una): vista Mes con drag&drop (Mes sigue siendo de solo clic, como antes), redimensionar turnos arrastrando el borde (`resizable={false}` — la duración la fija el servicio/negocio, no tiene sentido estirarla desde la agenda todavía), indicadores visuales de conflicto más allá de la separación por profesional/columna (hoy simplemente no puede haber dos turnos superpuestos para el mismo profesional, a nivel de datos, así que no hay conflictos que detectar visualmente), soporte táctil/mobile para el drag (la librería lo permite pero no se probó).

**Verificado:**
- `dotnet build` (backend) y `npx tsc --noEmit` (frontend): sin errores.
- `e2e/admin-calendario.spec.ts` (vista Mes existente): sigue pasando — confirma que el fix del bug latente de fecha no rompió nada.
- Test nuevo `e2e/admin-agenda.spec.ts`: crea dos turnos para el profesional sembrado (vía `/admin/turnos`), reserva uno desde la agenda semanal, lo arrastra sobre el otro turno libre, y confirma que el backend confirma la reprogramación (`admin-reschedule`) y que la UI refleja el turno movido. **Pasó de forma estable en corridas aisladas y repetidas (1x, luego 3x seguidas sin fallar)**, confirmando que el drag&drop simulado por mouse de Playwright es compatible con el addon de `react-big-calendar`.
- **Al correr la suite completa en paralelo (`--workers=3`) se encontraron y corrigieron dos problemas reales de la propia suite de e2e** (no bugs de producto):
  1. El test nuevo no filtraba por profesional en la vista agenda — con 40+ profesionales acumulados en `bd_turnos_e2e` (la base no se resetea sola entre corridas, ver nota de mantenimiento de la sección 9), "Todos los profesionales" renderiza una fila por cada uno, y esa vista pesada + carga paralela hacía flakear la búsqueda del evento por timeout. Se agregó `data-testid="calendario-agenda-professional-filter"` al selector de la vista Semana/Día y el test ahora filtra por su propio profesional antes de buscar sus turnos — más rápido y más correcto (el test no necesita ver profesionales ajenos).
  2. El `finally` de limpieza del test nuevo (libera + borra los dos turnos creados) es necesario para poder repetir la corrida sobre el mismo offset de fecha sin chocar con `SlotExistsAsync`.
- **Pendiente, no cerrado en esta sesión:** tras tantas corridas acumuladas de e2e en esta misma sesión, `bd_turnos_e2e` se quedó sin turnos disponibles para que `global-setup.ts` siembre reservas (`"No quedan turnos disponibles para sembrar reservas de e2e"`, mismo síntoma ya documentado en la sección 9). Se le preguntó al usuario si resetear la base (`DROP DATABASE bd_turnos_e2e`) para volver a correr la suite completa en paralelo como último check; **decisión: no resetear todavía, dejar documentado el punto exacto donde se quedó esto** en vez de tomar la acción destructiva. **Para retomar:** resetear `bd_turnos_e2e` (o esperar a que se libere corriendo menos specs a la vez) y correr `npx playwright test --workers=3` una vez más para confirmar que toda la suite (incluyendo `admin-agenda.spec.ts` junto al resto) pasa en paralelo sin el problema de datos acumulados — la corrección del punto 1 de arriba ya debería resolverlo, pero no llegó a verificarse con la suite completa en verde en un solo run.

---

## 13. Actualización — sesión 15/07 (cierre del pendiente de e2e + módulo Clientes CRM)

Se retomó el pendiente exacto donde quedó la sección 12 (correr la suite completa de e2e en paralelo tras resetear `bd_turnos_e2e`) y, a continuación, se encaró el primer módulo del PRD que quedaba con mayor impacto de UX cotidiano: **Clientes (CRM completo)**.

### Cierre del pendiente de la sección 12 — causa raíz real: entorno local mal configurado, no la suite

Con autorización explícita del usuario se corrió `DROP DATABASE bd_turnos_e2e` (la base ya no existía, probablemente dropeada en una sesión anterior) y se reintentó `npx playwright test --workers=3`. La suite **no arrancaba en absoluto** — cuatro intentos seguidos fallaron en el login del admin sembrado por `global-setup.ts`, cada uno con un síntoma superficial distinto (timeout de `waitForURL`, luego `page.goto`, luego un 401 explícito), lo que llevó a investigar tres capas de causas antes de encontrar la real:

1. **Contraseña de Postgres desactualizada** (`appsettings.json` y `appsettings.Testing.json` tenían `Password=456789`, la real es `123456`) — corregida en ambos archivos. Sin esto el backend en modo `Testing` ni siquiera arrancaba.
2. **`frontend/tturnos-web` no tenía `node_modules` instalado** en este entorno — se corrió `pnpm install` (el proyecto usa pnpm, no npm; un primer intento con `npm install` tocó `package-lock.json` sin querer, revertido con `git checkout --`). De paso, `pnpm-lock.yaml` quedó desincronizado con `package.json` desde la sesión de Agenda (12): le faltaban las entradas lockeadeadas de `@playwright/test`, `date-fns`, `react-big-calendar` y `@types/react-big-calendar` — `pnpm install` las agregó, dejando el lockfile consistente por primera vez desde que se sumaron esas dependencias.
3. **La causa real, la que explicaba el 401 "Email o contraseña incorrectos" pese a que el admin se acababa de registrar con éxito:** no existe `frontend/tturnos-web/.env.local` en este entorno (es un archivo gitignoreado, nunca se commiteó, y en esta máquina/checkout nunca se creó). Sin él, `NEXT_PUBLIC_API_URL` cae al default hardcodeado en el código (`https://detailing-api.onrender.com`, el mismo default que trae `.env.example` para "copiar y pegar" en desarrollo) — la **producción real**, no el backend local de `Testing` en el puerto 5048. El `POST /api/auth/register` de `global-setup.ts` pega directo a `localhost:5048` (sin pasar por el proxy), así que el admin de e2e se creaba correctamente en la base local — pero el login de la UI pasa por el proxy de Next.js (`app/api/auth/[...path]/route.ts`), que reenviaba silenciosamente ese login a producción, donde ese usuario nunca existió. Confirmado con logging temporal en el proxy y en `TenantResolutionMiddleware` comparando request directa (200) vs. vía proxy (401) con el mismo body exacto — la diferencia era el `API_URL` resuelto, no tenant ni headers. **Fix:** se creó `.env.local` (gitignoreado, no se commitea) con `NEXT_PUBLIC_API_URL=http://localhost:5048` y `NEXT_PUBLIC_API_BASE_URL=http://localhost:5048`. Cualquier otro entorno que clone este repo para desarrollo/e2e local necesita este mismo paso manual (documentado en `.env.example`, simplemente no se había hecho todavía en esta máquina).

Un efecto colateral menor de la misma investigación: `global-setup.ts` ganó timeouts más generosos (60s) en la navegación de login y un warmup explícito de `/admin/login` antes de loguear, por si el arranque en frío de Next.js en modo dev llegara a ser más lento que el timeout default de 30s en otro entorno — no era la causa de este bug puntual, pero es una mejora de robustez razonable que se dejó.

**Verificado:** con el `.env.local` en su lugar, la suite completa corrió dos veces seguidas con `--workers=3`: **14/16 y 14/16**, con fallas que **no se repitieron en el mismo test** entre ambas corridas (`admin-clientes`+`admin-agenda` la primera vez, `admin-agenda`+`admin-config` la segunda) salvo `admin-agenda.spec.ts`, que falló las dos veces bajo carga paralela. Corrido en soledad (`--workers=1`), `admin-agenda.spec.ts` **pasó limpio** — confirma que es la misma clase de flakiness ya documentada en la sección 9 ("Estabilidad de la suite bajo carga compartida": backend/DB compartidos entre los 3 workers, timeouts intermitentes que no son bugs de producto), no una regresión. El otro fallo (`admin-clientes`, primera corrida) sí era un bug real introducido en esta misma sesión — ver más abajo, ya corregido y verificado en la segunda corrida.

### Módulo Clientes (CRM completo) — construido en esta sesión

Alcance según el PRD (sección 7 de este documento): ficha extendida con cumpleaños, Instagram, notas, fotos, profesional favorito, historial. `CustomerProfile` era hasta ahora un modelo flaco pensado solo para el flujo de avisos WhatsApp (`Phone, Name, Email?, Notes?`), sin ninguno de estos campos.

**Backend:**
- `Core/Clients/Entities/CustomerProfile.cs`: se agregaron `Birthday` (`DateOnly?`), `Instagram` (`string?`), `FavoriteProfessionalId`/`FavoriteProfessional` (FK opcional a `Professional`, `OnDelete(SetNull)` — si se borra el profesional, el cliente no se rompe, solo pierde la referencia), y `PhotoUrls` (`string?`, array JSON de URLs de Cloudinary serializado como texto, columna `jsonb` — mismo patrón exacto que `Professional.Schedule`, sin tipar del lado del backend, el frontend serializa/deserializa).
- `Core/Notifications/DTOs/ReminderModels.cs`: `CreateCustomerProfileRequest`/`UpdateCustomerProfileRequest`/`CustomerProfileResponse` extendidos con los cuatro campos nuevos, con Data Annotations desde el día uno (`[StringLength]` en Instagram, `[Range]` en FavoriteProfessionalId, `[StringLength(4000)]` en PhotoUrls) — mismo criterio que `ProfessionalRequest`/`ServiceRequest` de sesiones anteriores. Nuevo record `CustomerBookingHistoryItem` para el historial.
- `Core/Notifications/Services/ReminderService.cs`: `CreateProfileAsync`/`UpdateProfileAsync` validan que `FavoriteProfessionalId`, si viene, exista de verdad (`InvalidOperationException` si no). Nuevo método `GetCustomerHistoryAsync(customerProfileId)`: no hay FK directa `Booking↔CustomerProfile` (`Booking` guarda `CustomerPhone` como string suelto, decisión ya documentada en sesiones previas), así que el historial se arma haciendo *match* por `CustomerPhone == profile.Phone` — el mismo criterio que ya usa `CreateProfileAsync` para detectar teléfonos duplicados.
- `Core/Notifications/Controllers/RemindersController.cs`: nuevo endpoint `GET /api/reminders/customers/{id}/history`.
- Migración `AddCustomerProfileCrmFields` generada (no aplicada a mano en la base de dev, mismo criterio que el resto del proyecto — se aplica sola al arrancar la app). Verificada aplicándose sola sobre `bd_turnos_e2e` en modo `Testing`.

**Frontend (`app/(admin)/admin/clientes/page.tsx`):**
- `CustomerForm` suma inputs de Cumpleaños (`<input type="date">`), Instagram (texto), Profesional favorito (`<select>`, reusa `/api/professionals`) y Fotos (múltiples `CloudinaryUpload`, con miniaturas + botón de borrar cada una — mismo componente que ya usa Profesionales/Servicios/Galería, pero acá se permite cargar varias en vez de una sola).
- Vista de detalle: nueva sección de "ficha extendida" (cumpleaños formateado, Instagram como link real a `instagram.com/{handle}`, nombre del profesional favorito, miniaturas de fotos) — solo se renderiza si hay al menos un dato cargado, para no ensuciar la vista de clientes sin CRM completo todavía.
- Nueva sección "Historial de turnos" debajo de "Avisos programados", con badges de estado propios (`Confirmado`/`Cancelado`/`Pendiente`, mismos colores que `/admin/historial`) — distintos de los badges de `ScheduledReminder` (`Pendiente`/`Enviado`/`Fallido`/`Cancelado`) para no confundir dos conceptos de "estado" distintos en la misma pantalla.
- `app/api/reminders/customers/[id]/history/route.ts`: proxy nuevo siguiendo el mismo patrón que el resto de `api/reminders/*`.

**Bug propio encontrado y corregido en el proceso:** el historial no se refrescaba después de programar un aviso (el flujo de "Nuevo aviso" reserva un turno real de paso), así que un cliente recién reservado no aparecía en su propio historial hasta recargar la página a mano. Encontrado por el e2e nuevo (ver abajo), no por revisión manual. **Fix:** `saveReminder` ahora llama `loadHistory(selected.id)` después de crear el aviso, mismo patrón que ya actualiza `reminders`.

**Verificado:**
- `dotnet build` (backend) y `npx tsc --noEmit` (frontend): sin errores.
- Se extendió `e2e/admin-clientes.spec.ts` (no un spec nuevo): completa cumpleaños/Instagram/profesional favorito al editar el cliente, confirma que la ficha extendida los muestra, y confirma que el turno reservado junto con el aviso aparece en el historial — encontró el bug de arriba en su primera corrida.
- Verificación manual en browser (Playwright standalone, no parte de la suite): registro de admin, creación de un profesional y un cliente con todos los campos del CRM cargados, captura de pantalla confirmando que la ficha extendida (cumpleaños, Instagram como link, profesional favorito) se renderiza correctamente.
- Suite completa de e2e (16 tests): **16/16 en la corrida final**, sin el bug del historial ni el 401 del entorno.

**Explícitamente fuera de alcance de este corte** (no pedido, ni parte del "CRM completo" mínimo): editar/eliminar fotos individuales desde la vista de detalle (solo desde el formulario de edición), un componente reutilizable de galería de fotos (se implementó inline, específico de esta pantalla — no se identificó otro lugar del código que necesite subir múltiples fotos todavía), y mover el CRUD de clientes fuera de `RemindersController` a un `ClientsController` propio (deuda ya señalada en la sección 6 del mapa de exploración de esta sesión, no se tocó por no ser parte del pedido).

---

## 14. Actualización — sesión 16/07 (Historial: productos/fotos/pago por turno)

Último módulo pendiente del PRD de la tabla de la sección 7: "registro detallado por turno con productos/fotos/pago". De las tres partes, **Pago ya existía completo** (entidad `Payment`, ya se mostraba en Historial) — no se tocó nada ahí. Se construyeron **productos** (no existía nada) y **fotos antes/después por turno** (no existía, pero sí un patrón ya probado en `CustomerProfile.PhotoUrls` para copiar).

**Decisión de diseño (pedida explícitamente por el usuario):** no modelar "productos" como texto libre, sino pensando en el futuro módulo Caja, y contemplando que además de productos hay que poder registrar **servicios** usados (ya modelados como `Service`). Se construyó un catálogo simple `Product` (nombre, precio, activo — sin stock, eso queda para Caja) más una tabla de **items por turno** (`BookingItem`) que referencia opcionalmente un `Service` o un `Product`, con nombre/cantidad/precio **capturados en el momento** — no recalculados desde el catálogo después, para que un cambio de precio futuro no altere turnos ya cerrados. Le deja a Caja, cuando se construya, un ledger real por turno para sumar y cobrar sin re-derivar nada.

**Backend:**
- `Core/Products/` (nuevo dominio, mismo esqueleto que `Core/Services`): entidad `Product` (`Name`, `Price`, `IsActive`, `Order`), `ProductRequest` con Data Annotations desde el día uno (mismo criterio que `ProfessionalRequest`/`ServiceRequest`), `IProductsRepository`/`ProductsRepository`, `ProductsController` — a diferencia de `ServicesController`, acá **todos** los endpoints son `[Authorize(Roles="Admin")]` porque no hay consumo público, solo se usa para armar el detalle de un turno desde el panel.
- `Core/Bookings/Entities/BookingItem.cs` (nueva entidad) + `BookingItemType.cs` (const `Service`/`Product`, mismo patrón que `BookingStatus`): cada fila referencia opcionalmente un `Service` o un `Product` (`OnDelete(SetNull)`, mismo patrón que `CustomerProfile.FavoriteProfessional`) y guarda `Name`/`Quantity`/`UnitPrice` como snapshot. `Booking` suma `ICollection<BookingItem> Items`, `PhotoUrlsBefore`/`PhotoUrlsAfter` (columnas `jsonb`, mismo patrón que `CustomerProfile.PhotoUrls`).
- Nuevo endpoint `PUT /api/bookings/{id}/detail` (`[Authorize(Roles="Admin")]`) — reemplaza la lista de items del turno completa en cada guardado (más simple que CRUD granular por item) y actualiza las fotos. `AdminBookingListItem` (usado por `GET /api/bookings`, la lista de Historial) suma `PhotoUrlsBefore`, `PhotoUrlsAfter` y `Items`.
- Migración `AddBookingItemsProductsAndPhotos` generada, no aplicada a mano en la base de dev (mismo criterio que el resto del proyecto — se aplica sola al arrancar vía `context.Database.Migrate()`); verificada aplicándose sin errores en un arranque real en modo `Testing`.

**Frontend:**
- Nueva página admin `/admin/productos` (`app/(admin)/admin/productos/page.tsx`) — CRUD mínimo (Nombre, Precio, Orden, Estado), mismo patrón que `/admin/servicios` pero sin los campos que no aplican a un producto (slug, duración, categoría, buffer, color). Entrada "Productos" agregada al grupo "Negocio" del sidebar.
- Proxies `app/api/products/{route.ts,[id]/route.ts}`, mismo patrón que `app/api/services/*` con `revalidateTag("products")`.
- `app/api/bookings/[...path]/route.ts` no tenía handler `PUT` (y el `PATCH` existente ni siquiera reenviaba el body al backend, solo lo usaba para el email de confirmación) — se agregó un `PUT` genérico que reenvía path + body tal cual, sin lógica de notificación.
- `/admin/historial`: el modal de detalle de un turno suma una sección "Productos y servicios utilizados" (agregar por tipo Servicio/Producto desde un selector cargado de `/api/services/all` y `/api/products`, cantidad, precio — autocompletado desde el catálogo para productos, manual para servicios porque `Service.Price` es texto libre no numérico —, con quitar por fila y total) y "Fotos antes/después" (dos bloques `CloudinaryUpload` multi-foto, mismo patrón exacto que `photos` de `/admin/clientes`). Botón "Guardar detalle" hace `PUT /api/bookings/{id}/detail`.

**Verificado:**
- `dotnet build` (backend) y `npx tsc --noEmit` (frontend): sin errores.
- Migración confirmada aplicándose sola sobre `bd_turnos_e2e` en un arranque real en modo `Testing`.
- `dotnet test` sobre `TTurnos.Api.Tests`: **68/68 en verde**.
- Se extendió `e2e/admin-historial.spec.ts` (no un spec nuevo): agrega un servicio y un producto sembrados al detalle de un turno, guarda, recarga la página y reabre el detalle para confirmar que persistió en el backend (no solo en el estado local de React). `global-setup.ts` suma un producto sembrado (`productName`) al mismo `.e2e-seed.json` que ya usaba `serviceTitle`.
- Suite completa de e2e (17 specs): **16/17** en la corrida con `--workers=3`; el único fallo (`admin-agenda.spec.ts`) es la misma flakiness bajo carga paralela ya documentada en las secciones 9 y 13 (backend/DB compartidos entre workers) — confirmado corriéndolo en soledad, donde pasa limpio.

**Explícitamente fuera de alcance de esta sesión:** subida real de fotos antes/después probada por e2e (mismo criterio que Galería/Contenido — implicaría subir un archivo real a Cloudinary, fuera del alcance de un e2e aislado; sí se probó a mano en browser); uso de `Product.Price`/stock por el módulo Caja (ese módulo todavía no se construyó); edición/reordenamiento de items ya guardados desde la UI (hoy se agregan y se quitan, pero no se editan in-place — hay que quitar y volver a agregar).

---

## 15. Actualización — sesión 16/07 (Módulo Caja — primer corte)

Último módulo "Alto" pendiente del PRD (`docs/TTurnosRoadmap.md`, módulo 10): "Todo el flujo. Cobros. Devoluciones. Señas. Mercado Pago. Efectivo. Transferencias. Caja diaria. Caja mensual." Se construyó un primer corte completo y funcional, con decisiones de alcance explícitas para no arriesgar código sensible ya existente.

**Decisión de diseño: MercadoPago no entra al ledger de Caja en este corte.** El flujo de cobro de Caja (Efectivo/Transferencia) es manual, registrado por el admin — no pasa por ninguna pasarela. MercadoPago sigue siendo el webhook automático ya existente (`PaymentsController.cs`), que tiene hallazgos de seguridad diferidos a propósito (firma HMAC, clave de config — sección 2, hallazgos a/g) y no se tocó. En vez de hacer que el webhook también genere `CajaMovement`, el total de MercadoPago del período se lee **de solo lectura** directo de `Payment` (`Status=Approved`, `PaidAt` en el rango) al armar el reporte diario/mensual — así "todo el flujo" queda visible sin tocar el código frágil del webhook. `CajaMovement.Method` solo admite `Cash`/`Transfer`.

**Backend — nuevo dominio `Core/Caja/`** (mismo esqueleto que `Core/Products/`):
- `CajaSession` — turno de caja diario: `OpenedAt/OpenedByUserId/OpeningCashBalance`, `ClosedAt/ClosedByUserId/ClosingCashCounted`, `Status` (`Open`/`Closed`). Una sola sesión abierta por tenant a la vez (chequeo en el repositorio antes de abrir, mismo criterio que `SlugExistsAsync` — no es un constraint de DB).
- `CajaMovement` — cada movimiento: `Type` (`Charge` cobro / `Deposit` seña / `Refund` devolución / `ManualIn` / `ManualOut` — estos dos últimos **no estaban en el PRD literal**, se agregaron porque sin ellos "cerrar caja con diferencia" no tiene forma de explicar un faltante/sobrante real, ej. vuelto o retiro de efectivo), `Method` (`Cash`/`Transfer`), `Amount`, `BookingId` opcional (`OnDelete SetNull` — si se borra el turno, ej. por expiración, el movimiento de dinero no se pierde), `RefundOfMovementId` opcional (referencia informativa, sin validación cruzada de montos), `CreatedByUserId`.
- `CajaController` (`[Authorize(Roles="Admin")]` en todos los endpoints, mismo criterio que `PaymentsController`/`ProductsController` — ningún endpoint de dinero es accesible a `Professional` en este sistema): `GET /current`, `POST /open`, `POST /close`, `POST /movements`, `GET /sessions?year=&month=` (caja mensual, solo lectura), `GET /pending-bookings` (turnos de los últimos 30 días con `ItemsTotal` de `BookingItem` vs. lo ya cobrado, para la lista de "Cobrar" en la UI).
- **Primer uso real de `ClaimTypes.NameIdentifier`** en el código: viaja en el JWT desde `AuthService.cs:314` desde siempre, pero ningún controller lo había leído hasta ahora — Caja es el primer lugar que necesita dejar registrado qué admin abrió/cerró/cobró.
- Efectivo esperado al cierre = saldo inicial + cobros/señas/ingresos en efectivo − devoluciones/egresos en efectivo (las transferencias no cuentan para la reconciliación física). Se calcula al vuelo en cada lectura, no se persiste como campo — así nunca puede quedar desincronizado de los movimientos reales.
- Migración `AddCaja` generada, no aplicada a mano (mismo criterio de siempre), verificada aplicándose sola en un arranque real en modo `Testing`.

**Frontend:**
- Nueva página `/admin/caja` con dos vistas: **Caja diaria** (si no hay sesión abierta, form de apertura; si hay, tarjetas de totales, botones Cobrar/Devolución/Movimiento manual/Cerrar caja, lista de turnos con saldo pendiente con cobro directo por fila, lista de movimientos del día) y **Caja mensual** (selector de mes, tabla de sesiones cerradas con diferencia de cierre, totales agregados incluyendo MercadoPago de solo lectura).
- Proxy genérico `app/api/caja/[...path]/route.ts` (GET/POST, mismo patrón que el `PUT` agregado a `app/api/bookings/[...path]/route.ts` en la sesión de Historial).
- Entrada "Caja" en el sidebar, grupo "Negocio".

**Explícitamente fuera de alcance de este corte** (documentado, no construido):
- Sincronizar pagos de MercadoPago al ledger de `CajaMovement` (ver decisión de diseño arriba) — el total se lee de `Payment`, no se generan movimientos.
- Multi-caja (varias cajas simultáneas por sucursal/profesional) — una sola caja por tenant.
- Editar o borrar un movimiento ya registrado — solo se puede "revertir" con una Devolución nueva, nunca mutar el original (más seguro para un ledger de dinero).
- Facturación fiscal / integración AFIP.
- Profesionales operando su propia caja — exclusivo de Admin.

**Verificado:**
- `dotnet build` (backend) y `npx tsc --noEmit` (frontend): sin errores.
- Migración confirmada aplicándose sola en un arranque real en modo `Testing`.
- Test de integración nuevo `CajaEndpointsTests.cs` (10 tests): no permite abrir dos cajas a la vez, no permite movimientos sin sesión abierta, valida `Type`/`Method`, y verifica el cálculo de efectivo esperado con cobro/devolución/transferencia y la diferencia al cerrar. `dotnet test` completo: **78/78 en verde** (68 previos + 10 nuevos).
- e2e nuevo `e2e/admin-caja.spec.ts`: abre caja, cobra un turno sembrado en efectivo, registra una devolución parcial, cierra declarando un conteo distinto al esperado y verifica que la diferencia mostrada sea la correcta. `global-setup.ts` suma un turno dedicado (`cajaBookingId`) al seed, mismo patrón que `historialCustomerName`.
- Suite completa de e2e (18 specs) corrida con `--workers=3`: **15/18**. De los 3 fallos, `admin-agenda.spec.ts` y `admin-clientes.spec.ts` son la misma flakiness bajo carga paralela ya documentada (secciones 9 y 13) — confirmado corriéndolos solos, donde pasan limpio.

**Hallazgo nuevo (16/07), no investigado — fuera de alcance de esta sesión:** `admin-config.spec.ts` (nombre del negocio) empezó a fallar de forma consistente, incluso corrido en soledad y con `.next/cache` borrado a mano — el valor que persiste tras recargar no es el que el test acaba de guardar, sino uno de una corrida anterior. Se confirmó por `git status` que esta sesión no tocó ningún archivo de `admin/configuracion` ni `api/siteconfig`, así que no es una regresión de Caja, pero tampoco se diagnosticó la causa real (candidatos: el mismo patrón de cache de Next.js ya documentado en la sección 9, o un bug real en cómo `SiteConfigRepository` resuelve la fila vigente tras muchas corridas de e2e acumuladas en la misma base sin resetear — sección 9 y 12 ya advierten que `bd_turnos_e2e` no se resetea sola). Queda pendiente de investigar en una próxima sesión.
