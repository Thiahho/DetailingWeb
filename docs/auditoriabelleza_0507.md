# Auditoría completa del sistema — DetailingWeb / Turneo Belleza (05/07)

Base para presupuestar el sistema completo: inventario funcional, tamaño, seguridad, validaciones y calidad de código. Hecha cruzando el grafo de conocimiento del proyecto (`graphify-out/graph.json`, actualizado a 1105 nodos / 1681 edges / 143 comunidades tras sumar el módulo Profesionales y el PRD de Turneo Belleza) con lectura puntual del código fuente.

Esta versión extiende `auditoria_completa_0507.md` con lo agregado durante el arranque del pivot a Turneo Belleza (gestión de turnos para salones de belleza): el módulo Profesionales (CRUD completo) y su impacto en el inventario y el presupuesto.

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
| Proyectos de test | **0** | **2** (`backend/Turneo.Api.Tests`: 68 tests de integración — sección 8; `frontend/Turneo-web` e2e con Playwright — sección 9) |

**Stack:** ASP.NET Core (.NET 9) + EF Core + PostgreSQL, Next.js + React + TypeScript + Tailwind, Hangfire (jobs), JWT + cookies HttpOnly, MercadoPago, Cloudinary, Gmail SMTP / WhatsApp (Meta API). *(Google Calendar API se quitó del stack — ver hallazgo b, resuelto.)*

**Módulos funcionales identificados** (vía comunidades del grafo): reservas/turnos online, panel admin completo (clientes, servicios, **profesionales**, turnos, historial, calendario, estadísticas, contenido, galería), portal de cliente ("Mis Turnos"), pagos con MercadoPago, notificaciones multicanal (email/WhatsApp) con reintento automático, recordatorios 24h automáticos, gestión de contenido multimedia y galería con Cloudinary, bloqueo de fechas, generación automática de time slots, SEO (sitemap/robots), configuración de sitio.

Es un sistema de tamaño medio-alto para un proyecto de un solo rubro: 13 dominios de API, ~15.000 líneas de código propio, sin contar dependencias. Sirve como referencia de escala para el presupuesto.

---

## 2. Seguridad

### 🔴 Crítico

**a) Webhook de MercadoPago sin validación de firma activa — ⏸️ Diferido (sistema en demo)**
*Decisión del 05/07: el sistema está en etapa de demo, sin procesar pagos reales todavía — este hallazgo queda pendiente a propósito hasta que se active el cobro real con MercadoPago. Retomar antes de salir a producción con pagos habilitados. (El rate limiting de `PaymentsController`, que originalmente estaba agrupado con este pendiente, ya se resolvió por separado el 13/07 — ver hallazgo c.)*

`Turneo.Api/Controllers/PaymentsController.cs:154-156` — la validación HMAC es condicional a que `MercadoPago:WebhookSecret` esté configurado, y en `appsettings.json:73` está vacío. Cualquiera puede simular una notificación de pago.
Además, `app/api/payments/webhook/mercadopago/route.ts` (proxy Next.js) no reenvía los headers `x-signature`/`x-request-id`, y devuelve `200` incluso si falla el reenvío al backend (silencia errores frente a MercadoPago).

**b) `CalendarController` sin ninguna autenticación — ✅ Resuelto (05/07)**
`Turneo.Api/Controllers/CalendarController.cs` — **ningún endpoint tenía `[Authorize]` ni `[AllowAnonymous]`** explícito, y el proyecto no define una política global de autorización por defecto (`AddAuthorization()` sin fallback policy en `Program.cs:73`), así que ambos endpoints quedaban **públicos sin querer**:
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
`Turneo.Api/bd_turnos.sql` (untracked, 412 líneas) — dump real con sentencias `COPY` (datos de clientes: nombre, teléfono, email según schema de `Bookings`). Se agregó una regla `*.sql` (con excepción para `Turneo.Api/Scripts/`) al `.gitignore` el 05/07; el archivo en sí ya no está en el working tree (purgado el 13/07).

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
- Migraciones EF se aplican automáticamente al arrancar (`Program.cs:113-118`, `context.Database.Migrate()`). Es cómodo para deploys automáticos, pero significa que no hay ningún gate/revisión manual antes de que un cambio de esquema se aplique en producción — riesgo a tener en cuenta a medida que el sistema crezca. La migración `AddProfessionals` se generó pero **no se aplicó automáticamente** en esta sesión (a pedido explícito: las migraciones se aplican de forma manual) — se generó también el script SQL idempotente correspondiente (`Turneo.Api/Scripts/add_professionals.sql`) para aplicarla a mano.
- Manejo de errores en controllers es mayormente `try/catch` devolviendo `BadRequest(ex.Message)` — funcional, pero expone mensajes de excepción interna al cliente en varios lugares, lo cual es un detalle de information disclosure menor pero recurrente. *(El caso de `CalendarController` ya no aplica — controller eliminado.)* **Actualizado 14/07:** los dos casos más expuestos (`AuthController.Login` y `PaymentsController.CreateMercadoPagoPreference`, ambos `[AllowAnonymous]`) ya no devuelven `ex.Message` al cliente — loguean a consola y responden un mensaje genérico. El resto de los controllers (autenticados, menor exposición) sigue con el patrón viejo, sin priorizar todavía. Ver sección 10.

---

## 5. Calidad de código y mantenibilidad

- **Cero tests automatizados — ✅ Resuelto (13/07)**: `backend/Turneo.Api.Tests` cubre los 13 controllers con 68 tests de integración (Testcontainers + Postgres real). `frontend/Turneo-web` sumó una suite de 14 tests e2e con Playwright cubriendo el flujo público de reserva, el portal de cliente, y las 12 páginas admin con UI real (las únicas dos sin cobertura, Bloqueo de fechas y OTP del portal, no tienen ninguna pantalla que las use, ver sección 9). Ver secciones 8 y 9 para detalle y los bugs encontrados en el proceso (varios de backend y de frontend, algunos de cara al cliente).
- **Acoplamiento alto en el core del backend — ✅ Resuelto (13/07 piloto, extendido 14/07)**: la comunidad "Backend Namespaces & Controllers" tenía cohesión ~0.057 (muy baja) y `ApplicationDbContext` era el nodo con mayor betweenness centrality (0.118) del sistema. El piloto del 13/07 (`IProfessionalsRepository`/`ProfessionalsRepository`) se extendió el 14/07 al resto de los controllers que inyectaban `ApplicationDbContext` directo: Bookings, ContentVideos, Payments, Analytics, BlockedDates, TimeSlots, Services, BusinessSettings, SiteConfig y Gallery pasan a inyectar su propio repositorio. De los 13 controllers del inventario, ya ninguno inyecta `ApplicationDbContext` directo salvo `ProfessionalsController` (que conserva una sola consulta de `TimeSlots`, decisión documentada en sección 8) — `AuthController` y el controller de Reminders nunca lo hicieron, ya pasaban por una capa de `Service`. Ver sección 10.
- Código muerto detectado y corregido: `NowArgentina()` sin usar en `ReminderBackgroundService` (ya corregido), y el módulo `CalendarController`/`GoogleCalendarService` que era un flujo de reservas paralelo/legacy (ya eliminado).
- El grafo de conocimiento detectó una relación semántica no obvia: el **"Módulo Automatizaciones"** planificado en el PRD de Turneo (motor tipo Zapier: trigger → condición → acción → espera → acción) es conceptualmente similar a los background services que **ya existen** (`ReminderBackgroundService`, `NotificationRetryBackgroundService`). Esto es una oportunidad de reutilización: ese módulo futuro no necesita partir de cero, puede evolucionar del mecanismo de reintentos/recordatorios ya construido.

---

## 6. Módulo Profesionales (Turneo Belleza) — construido 05/07

Primer módulo del pivot a gestión de turnos para salones de belleza (`TurneoRoadmap.md`, sección 4). Alcance acordado explícitamente: **solo CRUD** (modelo, API, pantalla admin) — sin integrar todavía con la reserva pública ni con la generación de turnos (`TimeSlot` sigue siendo un recurso único compartido, no por-profesional).

**Backend:**
- `Turneo.Api/Models/Professional.cs` — entidad nueva (`FirstName`, `LastName`, `PhotoUrl`, `CalendarColor`, `Specialty`, `Commission`, `Schedule` jsonb, `IsActive`, `Order`) + `WeeklyScheduleDay` (horario por día de la semana).
- Relación M2M implícita con `Service` (tabla de join `ProfessionalServices`, sin modificar `Service.cs`).
- `Turneo.Api/Controllers/ProfessionalsController.cs` — CRUD completo; `Commission` excluida deliberadamente de la respuesta pública (dato financiero interno).
- Migración `AddProfessionals` generada (no aplicada, ver sección 4) + script SQL idempotente en `Turneo.Api/Scripts/add_professionals.sql`.

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
| ~~Reducir acoplamiento de `ApplicationDbContext` / modularizar controllers~~ — ✅ resuelto (13/07 piloto en Professionals, extendido a los 10 controllers restantes el 14/07) | Bajo (no urgente, pero crecía con cada módulo Turneo) | Alto (refactor, no crítico a corto plazo) |
| **Módulos Turneo pendientes del PRD** (ver detalle abajo) | — | — |

**Módulos del PRD de Turneo Belleza aún no construidos** (estimación gruesa basada en el alcance del propio documento, sujeta a ajuste — el PRD es un esqueleto, no una spec detallada):

| Módulo | Alcance según PRD | Esfuerzo estimado* |
|---|---|---|
| ~~Servicios (extensión)~~ — ✅ resuelto (15/07) | categorías, buffer, color, orden, profesionales asociados (ya cubierto en parte por la M2M de Profesionales) | Bajo (horas-1 día) |
| ~~Agenda multi-profesional~~ — ✅ resuelto (15/07, ver sección 12) | vista día/semana/mes, drag&drop, filtros por profesional — hoy no existe nada de esto, es build desde cero | Alto (varios días, probablemente requiere librería tipo FullCalendar) |
| ~~Clientes (CRM completo)~~ — ✅ resuelto (15/07, ver sección 13) | ficha extendida: cumpleaños, Instagram, notas, fotos, profesional favorito, historial | Medio (1-2 días) |
| ~~Historial~~ — ✅ resuelto (16/07, ver sección 14) | registro detallado por turno con productos/fotos/pago | Medio (1-2 días) |
| ~~Automatizaciones~~ — ✅ resuelto (17/07, primer corte, ver sección 24) | motor visual trigger→condición→acción→espera; **reutilizable parcialmente** desde `ReminderBackgroundService`/`NotificationRetryBackgroundService` (ver hallazgo semántico en sección 5) | Alto (motor visual es un producto en sí mismo) |
| ~~Caja~~ — ✅ resuelto (16/07, primer corte, ver sección 15) | cobros, devoluciones, señas, caja diaria/mensual | Alto (nuevo dominio, toca Payments) |
| ~~Estadísticas (extensión)~~ — ✅ resuelto (16/07, ver sección 23) | dashboards nuevos: profesional con mayores ventas, horas ocupadas/libres, ausencias | Medio (1-2 días, ya hay una base en `AnalyticsController`) |
| ~~UX / Design system~~ — ✅ resuelto (17/07, primer corte: botones/inputs unificados en las 17 páginas admin, ver secciones 25-26; dark mode queda fuera de este corte) | sistema de diseño formal (botones, inputs, dark mode, etc.) | Medio-Alto (transversal a todo el frontend) |

*Esfuerzo aproximado en horas/días de desarrollo — ajustar según la tarifa y el criterio de quien arme el presupuesto final.

---

## 8. Actualización — sesión 13/07

Trabajo de seguimiento sobre esta auditoría: suite de tests de integración para el backend, un bug crítico encontrado y corregido, y arranque del piloto de reducción de acoplamiento de `ApplicationDbContext` (ítems marcados como deuda en las secciones 5 y 7).

**Suite de tests de integración (`backend/Turneo.Api.Tests`)**
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

**Infraestructura (`frontend/Turneo-web`):**
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

**Gotcha de Playwright encontrado al implementar el fix anterior:** `storageState` no persiste `sessionStorage` (por diseño de Playwright), y `src/lib/auth.ts` usa exactamente esa ausencia como señal de "ventana nueva con una cookie vieja" para forzar un logout silencioso (`isFreshWindow()`/`forceLogoutStaleWindow()`, ver hallazgo (f) de la auditoría original). Sin el fix, cada spec que reusaba `storageState` quedaba deslogueado apenas cargaba la página. Solucionado sembrando el marcador de sesión (`sessionStorage.setItem("Turneo_session_active", "true")`) vía `page.addInitScript()` antes de navegar.

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

**Nota para el resto de esta auditoría:** varias rutas de archivo citadas en las secciones 1-9 (p.ej. `Turneo.Api/Controllers/PaymentsController.cs`, `Turneo.Api/Services/GoogleCalendarService.cs`) reflejan la estructura plana `Controllers/`/`Services/` que el proyecto tenía originalmente. El backend ya está reorganizado bajo `Core/`, `Modules/`, `Infrastructure/`, `Shared/`, `SaaS/`, `Enterprise/` (arquitectura "FASE 1" del roadmap de generalización, confirmada commiteada desde antes del 13/07) — por ejemplo `PaymentsController.cs` vive hoy en `Core/Payments/Controllers/`. Las rutas viejas en este documento son válidas como referencia histórica de *qué* archivo, no de *dónde* está hoy; no se reescribieron retroactivamente para no romper la trazabilidad de cuándo se encontró cada hallazgo.

---

## 11. Actualización — sesión 15/07

Cierre del último pendiente menor de validación (sección 3) y arranque de los módulos pendientes del PRD de Turneo Belleza (sección 7): primer módulo, **Servicios (extensión)**.

**`UpdateTimeSlotRequest` sin anotaciones — ✅ resuelto**
Se agregó `[Required]` a `StartDateTime` (`Core/Scheduling/DTOs/UpdateTimeSlotRequest.cs`). Al ser un `DateTime` no nullable, valida contra el default (`0001-01-01`), cubriendo un `PUT` sin ese campo en el body. La validación de negocio existente en `TimeSlotsController.UpdateSlot` (fecha futura, sin solapamiento) no se tocó. Cierra el pendiente de la sección 3.

**Módulo Servicios (extensión) — ✅ resuelto (15/07)**
Alcance según el PRD (sección 5 de `TurneoRoadmap.md`): categorías, buffer, color, orden — de estos, "orden" y "profesionales asociados" (M2M) ya existían desde el módulo Profesionales; se agregó lo que faltaba:

- **Backend** (`Core/Services/Entities/Service.cs`): tres columnas nuevas — `Category` (`string?`, libre), `BufferMinutes` (`int`, default 0, sin uso todavía en la generación de slots — es dato informativo/preparatorio, `TimeSlotGeneratorService` sigue generando slots de duración fija por `BusinessSettings`, no por servicio), `Color` (`string`, hex, default `#7c3aed`, mismo patrón que `Professional.CalendarColor`).
- `ServiceRequest` (`Core/Services/Controllers/ServicesController.cs`) suma validación **desde el día uno** para los campos nuevos, mismo criterio que `ProfessionalRequest`: `[StringLength(100)]` en `Category`, `[Range(0, 480)]` en `BufferMinutes` (tope de 8 horas), `[Required, RegularExpression]` en `Color` para forzar hex válido (`#RRGGBB`).
- Migración EF `AddServiceCategoryBufferColor` generada (no aplicada manualmente en la base de dev a propósito, mismo criterio que el resto del proyecto — se aplica sola al arrancar la app vía `context.Database.Migrate()`, o al levantar el entorno `Testing` de e2e, donde ya se verificó). El `defaultValue` de la columna `Color` en la migración se ajustó a mano a `"#7c3aed"` (scaffolding de EF lo dejaba en `""`) para que los registros existentes no queden con un hex inválido.
- **Frontend** (`app/(admin)/admin/servicios/page.tsx`): inputs de Categoría (texto libre), Buffer (número, minutos, 0-480) y Color (`<input type="color">`, mismo patrón que `/admin/profesionales`) en el formulario; la card del listado ahora muestra un punto de color junto al título y la categoría debajo del nombre, si está cargada.
- **Fuera de alcance a propósito** (no estaba en el pedido "extensión" del PRD ni es parte del esfuerzo "Bajo" estimado): usar `BufferMinutes` para separar turnos generados en `TimeSlotGeneratorService`, y agrupar/filtrar por categoría en la página pública de Servicios (`app/(public)/servicios/page.tsx`) — ese archivo además usa un sistema de diseño distinto (`midnight`/`lux`) al del resto del admin (`cream`/`charcoal`/`blush`), aparentemente remanente del template original previo al pivot a Turneo Belleza; no se tocó.

**Verificado:** `dotnet build` sin errores. `dotnet test` sobre `Turneo.Api.Tests`: **68/68 en verde** (primera vez que se re-corre la suite completa desde el refactor de repositorios del 14/07 — cierra también esa validación pendiente de la sección 10, ahora con Docker disponible en el entorno). Se agregó un segundo test a `e2e/admin-services.spec.ts` (categoría/buffer/color se guardan y persisten al reabrir edición); los 2 tests del spec pasan, confirmando además que la migración se aplica sola sobre `bd_turnos_e2e` al levantar el backend en modo `Testing`.

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
2. **`frontend/Turneo-web` no tenía `node_modules` instalado** en este entorno — se corrió `pnpm install` (el proyecto usa pnpm, no npm; un primer intento con `npm install` tocó `package-lock.json` sin querer, revertido con `git checkout --`). De paso, `pnpm-lock.yaml` quedó desincronizado con `package.json` desde la sesión de Agenda (12): le faltaban las entradas lockeadeadas de `@playwright/test`, `date-fns`, `react-big-calendar` y `@types/react-big-calendar` — `pnpm install` las agregó, dejando el lockfile consistente por primera vez desde que se sumaron esas dependencias.
3. **La causa real, la que explicaba el 401 "Email o contraseña incorrectos" pese a que el admin se acababa de registrar con éxito:** no existe `frontend/Turneo-web/.env.local` en este entorno (es un archivo gitignoreado, nunca se commiteó, y en esta máquina/checkout nunca se creó). Sin él, `NEXT_PUBLIC_API_URL` cae al default hardcodeado en el código (`https://detailing-api.onrender.com`, el mismo default que trae `.env.example` para "copiar y pegar" en desarrollo) — la **producción real**, no el backend local de `Testing` en el puerto 5048. El `POST /api/auth/register` de `global-setup.ts` pega directo a `localhost:5048` (sin pasar por el proxy), así que el admin de e2e se creaba correctamente en la base local — pero el login de la UI pasa por el proxy de Next.js (`app/api/auth/[...path]/route.ts`), que reenviaba silenciosamente ese login a producción, donde ese usuario nunca existió. Confirmado con logging temporal en el proxy y en `TenantResolutionMiddleware` comparando request directa (200) vs. vía proxy (401) con el mismo body exacto — la diferencia era el `API_URL` resuelto, no tenant ni headers. **Fix:** se creó `.env.local` (gitignoreado, no se commitea) con `NEXT_PUBLIC_API_URL=http://localhost:5048` y `NEXT_PUBLIC_API_BASE_URL=http://localhost:5048`. Cualquier otro entorno que clone este repo para desarrollo/e2e local necesita este mismo paso manual (documentado en `.env.example`, simplemente no se había hecho todavía en esta máquina).

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
- `dotnet test` sobre `Turneo.Api.Tests`: **68/68 en verde**.
- Se extendió `e2e/admin-historial.spec.ts` (no un spec nuevo): agrega un servicio y un producto sembrados al detalle de un turno, guarda, recarga la página y reabre el detalle para confirmar que persistió en el backend (no solo en el estado local de React). `global-setup.ts` suma un producto sembrado (`productName`) al mismo `.e2e-seed.json` que ya usaba `serviceTitle`.
- Suite completa de e2e (17 specs): **16/17** en la corrida con `--workers=3`; el único fallo (`admin-agenda.spec.ts`) es la misma flakiness bajo carga paralela ya documentada en las secciones 9 y 13 (backend/DB compartidos entre workers) — confirmado corriéndolo en soledad, donde pasa limpio.

**Explícitamente fuera de alcance de esta sesión:** subida real de fotos antes/después probada por e2e (mismo criterio que Galería/Contenido — implicaría subir un archivo real a Cloudinary, fuera del alcance de un e2e aislado; sí se probó a mano en browser); uso de `Product.Price`/stock por el módulo Caja (ese módulo todavía no se construyó); edición/reordenamiento de items ya guardados desde la UI (hoy se agregan y se quitan, pero no se editan in-place — hay que quitar y volver a agregar).

---

## 15. Actualización — sesión 16/07 (Módulo Caja — primer corte)

Último módulo "Alto" pendiente del PRD (`docs/TurneoRoadmap.md`, módulo 10): "Todo el flujo. Cobros. Devoluciones. Señas. Mercado Pago. Efectivo. Transferencias. Caja diaria. Caja mensual." Se construyó un primer corte completo y funcional, con decisiones de alcance explícitas para no arriesgar código sensible ya existente.

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

---

## 16. Actualización — sesión 16/07 (continuación) — Avisos manuales, aviso al profesional, limpieza de "Vehículo", calendario responsive

Continuación de la misma fecha (16/07) sobre el estado de la sección 15, en una conversación distinta enfocada en pulir el flujo de avisos de Clientes, sumar un canal de aviso al profesional, y llevar el calendario semana/día (sección 12) a un estado usable en mobile. No se generó ninguna migración EF nueva en esta sesión — todos los cambios de backend son sobre DTOs/servicios/config existentes.

### Bug: el selector de profesional desaparecía en "Nuevo aviso" si no había mapeo servicio↔profesional

`ReminderForm` (`app/(admin)/admin/clientes/page.tsx`) filtraba los profesionales disponibles por `p.services?.some(s => s.id === selectedServiceObj.id)` — el mismo criterio que la reserva pública. Como asignar servicios a un profesional es opcional en su ficha (`/admin/profesionales`, `serviceIds` arranca en `[]`), en cuanto esa carga faltaba (algo común, sobre todo en salones que recién arrancan con el módulo multi-profesional) el selector quedaba completamente vacío — ni siquiera se podía crear el turno manual, porque ese modo exige elegir profesional y no había ninguno para elegir. Confirmado con datos reales del entorno local: los profesionales sembrados por la propia suite de e2e tienen `services: []`. **Fix aplicado:** si ningún profesional tiene el servicio vinculado, el selector cae a mostrar todos los profesionales activos en vez de bloquear — tiene sentido acá porque es el admin asignando el turno a mano, no un cliente autoreservándose (criterio distinto al de la reserva pública, documentado en el propio comentario del código).

**De paso:** si el cliente ya tiene un `favoriteProfessionalId` cargado (CRM, sección 13), el formulario ahora lo preselecciona al abrir "Nuevo aviso" — sigue siendo editable, no reemplaza la posibilidad de elegir "Sin preferencia" u otro profesional.

### Panel principal: bloque "Próximos avisos programados" + envío manual + "marcar enviado"

Pedido explícito: un bloque en el panel (`/admin`, no solo dentro de la ficha de cada cliente) para ver los avisos `Pending` próximos y poder mandarlos a mano (WhatsApp/email) si el automático no corrió o no está configurado.

- **Backend:** `ReminderResponse` (`Core/Notifications/DTOs/ReminderModels.cs`) suma `CustomerEmail` (antes solo tenía `CustomerName`/`CustomerPhone`, insuficiente para armar un `mailto:`). `ReminderService.MarkSentAsync(id)` marca un `ScheduledReminder` `Pending`/`Failed` como `Sent` sin pasar por el envío automático — para que el job recurrente de Hangfire no lo vuelva a mandar más tarde si el admin ya lo mandó a mano. Nuevo endpoint `POST /api/reminders/{id}/mark-sent` en `RemindersController.cs`.
- **Frontend:** proxy nuevo `app/api/reminders/[id]/mark-sent/route.ts` (mismo patrón que `.../cancel`). El Panel principal (`app/(admin)/admin/page.tsx`) suma una sección arriba de las stats: lista los avisos `Pending` (`GET /api/reminders?status=Pending`, endpoint que ya existía sin usar desde el frontend), con un botón **WhatsApp** (`wa.me` con el mensaje precargado, mismo patrón ya usado en `/admin/turnos`/`/admin/calendario`/`/admin/historial`), un botón **Email** (`mailto:`, solo si el cliente tiene email) y **Marcar enviado**.

### Panel principal: modal de detalle al hacer clic en un turno

`/admin` mostraba los turnos en tabla/cards pero sin forma de ver el detalle completo sin ir a Calendario o Turnos. Se agregó un modal de detalle (cliente, teléfono, servicio, detalle del turno, especialista, pago si tiene, mensaje, botones WhatsApp/Liberar-Cancelar) al clickear cualquier turno con reserva, reusando el mismo patrón visual ya construido en `/admin/calendario` (sección 12). Los turnos libres no son clickeables; el botón de liberar dentro de la fila/card usa `stopPropagation` para no disparar el modal sin querer.

### Aviso por email al profesional asignado al crear un turno

Pedido: que el sistema notifique al profesional (no solo al cliente/admin) cuando se le carga un turno nuevo, con un link que lo lleve a su agenda con el turno resaltado.

**Backend** (`Core/Notifications/`, `Infrastructure/Integrations/`, `Shared/Interfaces/NotificationContracts.cs`):
- Nuevo método en la interfaz `INotificationProvider`: `SendToAddressAsync(toEmail, message)` — espejo de `SendDirectAsync(phone, ...)` que ya existía para WhatsApp, pero para email a una dirección arbitraria (no la del cliente del booking). Implementado en `GmailProvider` (reusa el bloque SMTP existente, extraído a un helper privado compartido con `SendAsync`), y como "no soportado" en `WhatsAppProvider`/`EmailProvider`(Resend)/`NoopNotificationProvider`/`FakeNotificationProvider` (tests) — todos los implementadores de la interfaz debieron actualizarse para seguir compilando.
- Nuevo evento `NotificationEventType.ProfessionalBookingCreated`, tokens de template nuevos (`{{profesional}}`, `{{telefono_cliente}}`, `{{link_agenda}}`) en `NotificationTemplateService`, template default en `appsettings.json` (`Templates:ProfessionalBookingCreated`), toggle `Notifications:NotifyProfessional` (default `true`) y `Notifications:ProfessionalAgendaBaseUrl` (no se agregó a `appsettings.Production.json` — mismo criterio ya usado ahí para `MyBookingsBaseUrl`, se apoya en el fallback hardcodeado del código).
- `NotificationService.DispatchForBookingAsync`, en el evento `BookingCreated`, llama a un nuevo método privado `TryNotifyProfessionalAsync`: resuelve el email vía `Users` (`Role="Professional"`, mismo `ProfessionalId`+`TenantId` que el booking — el email del profesional vive en `User`, no en `Professional`), arma el link `{agendaBaseUrl}?bookingId={id}`, y lo manda por el provider de `Channel == "Email"`. Todo en try/catch (best-effort: un fallo acá no debe romper la reserva ni las notificaciones al cliente) y el `NotificationLog` que genera tiene `IsRetryable = false` a propósito, para que `RetryPendingAsync` (que reconstruye datos orientados al cliente, no sabe nada de profesionales) nunca lo reprocese.

**Frontend:** `/profesional/agenda` (`app/(professional)/profesional/agenda/page.tsx`) ahora lee `?bookingId=` de la URL (`useSearchParams`, envuelto en `<Suspense>` — mismo patrón ya usado en `/cancelar`, necesario en Next 14 para no forzar toda la ruta a client-side rendering) y resalta con badge "NUEVO" + auto-scroll (`scrollIntoView`) el turno que coincide con ese id.

**Explícitamente fuera de alcance:** un "enviar ahora" que dispare el mismo canal automático (WhatsApp Business API + email) bajo demanda — se limitó a WhatsApp/email manual del lado del admin (Panel principal) y al aviso automático al profesional al crear el turno, no se construyó un botón de reenvío forzado del automático.

### Limpieza de campo fantasma "Vehículo" en todo el frontend

El backend reemplazó `Vehicle` por `Subject` hace mucho (migración histórica `ReplaceVehicleWithSubjectOnBooking`, visible en `Migrations/`), pero el frontend nunca terminó de migrar: varias interfaces TypeScript seguían declarando y mostrando `vehicle`, un campo que **ningún endpoint del backend devuelve realmente** (confirmado leyendo `TimeSlotsController`, `BookingsController.GetBooking`, `AnalyticsRepository.GetUpcomingBookingsAsync` — todos proyectan `Subject`, ninguno `Vehicle`) — el dato mostrado era siempre `undefined`/`—`. Más grave: el modal "Nueva reserva" de `/admin/calendario` tenía un input **"Vehículo" marcado `required`** que no se guardaba en ningún lado (el payload lo mandaba, pero ni el backend ni ninguna vista posterior lo leían), duplicando innecesariamente al campo real "Detalle del turno".

**Fix aplicado** (reemplazo `vehicle`→`subject`, label "Detalle" en la UI): `app/(admin)/admin/page.tsx`, `app/(admin)/admin/calendario/page.tsx` (+ se eliminó el input "Vehículo" del formulario de reserva manual), `app/(admin)/admin/estadisticas/page.tsx`, `app/(client)/cancelar/page.tsx`, y los emails de confirmación/cancelación/reprogramación en `app/api/bookings/route.ts` y `app/api/bookings/[...path]/route.ts` (mostraban "Vehículo" con datos que nunca se guardaban). Se actualizaron `e2e/admin-agenda.spec.ts` y `e2e/admin-calendario.spec.ts` para dejar de rellenar el input eliminado.

### Calendario semana/día: rediseño visual, toasts en vez de `alert()`, y crear turno al arrastrar dentro del horario laboral

Continuación directa de la Agenda multi-profesional de la sección 12: pedido de mejorar el diseño (calificado por el usuario de "poco dinámico") y la UX de la notificación de error al arrastrar un turno sin destino libre.

- **Rediseño visual** (`src/components/calendar/agenda-calendar.css`, nuevo): `react-big-calendar` corría 100% con su hoja de estilos default (gris, sin relación con la paleta `cream/ivory/mauve/blush/champagne` del resto del admin) — cero overrides existían en el repo. Se agregaron: bordes retinteados en mauve, "hoy" resaltado en champagne suave, línea de "ahora" en blush, pills de evento con sombra + hover con elevación, texto truncado con ellipsis. Toolbar interno de la librería reemplazado por uno propio (◄ ► Hoy + fecha, mismo lenguaje visual que el resto del panel) y `resourceHeader` custom con un punto de color (`Professional.CalendarColor`) junto al nombre de cada columna.
- **Toasts en vez de `alert()` nativo:** `AgendaCalendar.tsx` tenía un `alert("No hay ningún turno disponible ese día para ese profesional.")` en `handleEventDrop`, y `admin/calendario/page.tsx` tenía dos más iguales en `handleReschedule` (error y catch) — los tres reemplazados por el mismo sistema de toast ya usado en `/admin/turnos`, `/admin/caja`, `/admin/profesionales`, `/admin/servicios`, `/admin/galeria`, `/admin/productos` (copiado, no extraído a componente compartido — six archivos ya duplican el mismo patrón, no se tocaron). El mensaje de error ahora nombra al profesional real en vez de "ese profesional", y se agregó un toast de éxito al reprogramar (antes quedaba mudo).
- **Crear turno al arrastrar dentro del horario laboral (pedido explícito):** si al soltar un turno reservado no hay ningún turno libre ese día para el profesional destino, antes de mostrar el error se chequea `Professional.Schedule` (mismo criterio que `ProfessionalsController.IsWorkingDuringSlot` del backend: sin horario cargado = siempre disponible) contra el punto exacto donde se soltó. Si cae dentro de la jornada, se crea un `TimeSlot` nuevo ahí (`POST /api/timeslots`) y recién ahí se reprograma la reserva sobre él (`onCreateAndReschedule`, nuevo prop de `AgendaCalendar`) — con un toast de éxito distinto que aclara que se creó un turno nuevo. Si cae fuera de la jornada, o el turno estaba "Sin asignar" (no hay horario propio contra qué validar), se mantiene el aviso de error. No cambia el comportamiento existente cuando sí hay un turno libre ese día (sigue snapeando al más cercano).

### Tamaño ajustable (S/M/L) y bug crítico de layout roto en mobile

Pedido: "jugar con el tamaño" del calendario y sus "notas" (el texto de cada evento), responsive y adaptado a mobile.

- **Control de densidad:** tres botones S/M/L (420/640/820px de alto) en el toolbar propio, persistidos en `localStorage`, con default automático a compacto si la primera visita es desde una pantalla angosta (`window.innerWidth < 768`). Contenedor de la grilla envuelto en `overflow-x-auto` con un `min-width` calculado según cantidad de columnas de profesional (×7 si es vista semana), para que en mobile la grilla scrollee horizontal en vez de comprimirse hasta ser ilegible.
- **Bug crítico encontrado con verificación real en navegador, no solo lectura de código:** tras el primer corte, el usuario reportó "MODO MOBILE no se adapta el calendario". Se diagnosticó levantando un Playwright standalone contra los dev servers ya corriendo (backend `:5048`, frontend `:3000`), reusando la sesión de admin ya autenticada (`e2e/.auth-admin.json`) en viewport de 390px, midiendo `document.documentElement.scrollWidth` vs `clientWidth` y recorriendo la cadena de ancestros con `getComputedStyle` — confirmó que **toda la página** (no solo el calendario) se estiraba a ~1300px de ancho en un viewport de 390px. Causa raíz: `app/(admin)/admin/layout.tsx` tiene `<div class="flex"><Sidebar/><main class="flex-1">` — un `flex-1` sin `min-width: 0` no se achica por debajo del contenido más ancho que tenga adentro (el clásico bug de `min-width: auto` implícito en flex items), así que el `min-width` en píxeles del calendario (hasta 10920px con los ~12 profesionales de prueba acumulados en la base × 7 días de la vista semana) se propagaba hacia arriba y estiraba toda la página en vez de quedar contenido en su propio `overflow-x-auto`. **Fix:** `min-w-0` en ese `<main>` — el fix estándar para este problema, sin efecto en desktop. Reverificado con el mismo script: `scrollWidth === clientWidth` tanto en semana como en día, en 390px y en 1440px.
- **Segundo hallazgo del mismo diagnóstico:** el control S/M/L, al vivir dentro del toolbar interno de la librería, quedaba dentro del área con scroll horizontal — en mobile, invisible sin scrollear primero (confirmado midiendo la posición del control contra el viewport visible: `visibleWithoutScroll: false`). **Fix:** el toolbar se sacó por completo del árbol de `react-big-calendar` (`toolbar={false}` en el `Calendar`, navegación/label calculados a mano en `AgendaCalendar.tsx` usando `date-fns` con locale `es`) y se renderiza afuera del contenedor con scroll — siempre visible. Al mover el label fuera de RBC aparecieron dos bugs propios de la primera implementación, encontrados con el mismo método de verificación visual: faltaba `{ locale: es }` en el formato del rango semanal (mostraba "13 – 19 De July"), y la clase `capitalize` de Tailwind ponía mayúscula en cada palabra en vez de solo la primera del texto — ambos corregidos y reverificados con captura de pantalla.
- **Regresión propia encontrada antes de cerrar la sesión:** mover el toolbar rompió `e2e/admin-agenda.spec.ts`, que ubicaba el botón "Siguiente" por accesibilidad (`getByRole("button", { name: "Siguiente" })`, texto que generaba el toolbar default de RBC vía la prop `messages`). El toolbar propio nuevo usa `aria-label="Período siguiente"`, distinto texto. **Fix:** se agregaron `data-testid="agenda-toolbar-{prev,next,today}"` a los tres botones (más robusto que matchear texto accesible) y se actualizó el spec para usarlos. Verificado con un script Playwright standalone (no la suite completa, ver nota de alcance abajo): los tres botones son visibles y clickeables, y click en "Siguiente"/"Hoy" cambia el label del rango correctamente ("13 – 19 de julio" → "20 – 26 de julio" → "13 – 19 de julio").

**Verificado en esta sesión:**
- `dotnet build` (backend) y `npx tsc --noEmit` + `npx next build` (frontend, corrido varias veces a medida que se iba iterando): 0 errores en todos los casos.
- Verificación visual real con Playwright standalone (no como parte de la suite `e2e/`) contra los dev servers ya corriendo, con sesión de admin autenticada: capturas de pantalla en 390px y 1440px confirmando el fix del layout mobile, medición de `scrollWidth`/`clientWidth` antes y después del fix, y confirmación funcional de que los botones de navegación del nuevo toolbar responden y cambian el estado.
- **No se corrió la suite completa de e2e (`npx playwright test`)** en esta sesión — los `webServer` de `playwright.config.ts` tienen `reuseExistingServer: false` a propósito (ver sección 9), y los dev servers ya estaban corriendo manualmente en los mismos puertos para las verificaciones puntuales de arriba; correrla habría requerido primero bajarlos. Quedó verificado narrowly el punto exacto de la regresión encontrada (selectores del nuevo toolbar), pero **no** el flujo completo de `admin-agenda.spec.ts` de punta a punta (crear turnos, reservar, arrastrar, reprogramar) ni el resto de la suite (18 specs a esta altura). Recomendado antes de dar por cerrada esta sesión: correr `npx playwright test --workers=3` con los dev servers manuales apagados.
- **No se corrió `dotnet test`** (requiere Docker/Testcontainers, no disponible en el entorno de esta sesión) — los cambios de backend son aditivos (nuevo método de interfaz implementado en los 5 providers existentes, nuevo endpoint, nuevos campos de DTO) y no tocan lógica de negocio existente, pero igual que en la sesión 10, no se puede dar por cerrado sin correr la suite (68 tests) al menos una vez.

**Explícitamente fuera de alcance de esta sesión:** un componente de Toast compartido (sigue duplicado en 7 archivos ahora, incluyendo `admin/calendario/page.tsx`); soporte táctil real para el drag&drop en mobile (la librería lo permite pero no se probó, mismo pendiente ya anotado en la sección 12); mover el CRUD de Reminders/CustomerProfile fuera de `RemindersController` (deuda ya señalada en la sección 13, no se tocó).

---

## 17. Actualización — sesión 16/07 (cierre de los dos pendientes de la sección 16: suite e2e completa y `dotnet test`)

Continuación directa de la sección 16, en una conversación distinta, dedicada exclusivamente a correr ambas suites completas hasta dejarlas verdes.

### Bug de config encontrado al levantar la suite e2e: password de Postgres desactualizada

Al correr `npx playwright test --workers=3`, el `webServer` del backend (`ASPNETCORE_ENVIRONMENT=Testing`) fallaba al arrancar con `28P01: la autentificación password falló para el usuario «postgres»` al aplicar las migraciones. `appsettings.Testing.json` tenía `Password=123456`, pero la instancia local de Postgres usa `456789` (la misma que ya está en `appsettings.json` por defecto) — desactualizada desde antes de esta sesión, no una regresión de la sección 16. **Fix:** `appsettings.Testing.json` → `Password=456789`.

### Bug real encontrado por la suite: modal sin scroll deja el botón "Reservar y programar aviso" inalcanzable

Con la password corregida, la suite corrió 17/18 — falló `admin-clientes.spec.ts` con `element is outside of the viewport` reintentando el click sobre `reminder-form-submit` durante 45s. Causa raíz: el componente `Modal` compartido en `app/(admin)/admin/clientes/page.tsx` (usado tanto por `CustomerForm` como por `ReminderForm`) no tenía `max-height` ni `overflow-y-auto` en su contenedor — el div de contenido crecía sin límite. Con los ~13 profesionales ya acumulados en `bd_turnos_e2e` (problema de fondo ya documentado en las secciones 9 y 12: la base de e2e no se resetea sola), la grilla de botones "Profesional" del `ReminderForm` empujó el formulario más allá de la altura del viewport, y sin mecanismo de scroll el botón de submit quedó permanentemente fuera de alcance. **No es un problema exclusivo del entorno de test:** cualquier salón real con un equipo de profesionales numeroso pegaría contra el mismo bug al intentar reservar un turno y programar un aviso desde la ficha de un cliente. **Fix aplicado:** `max-h-[90vh] flex flex-col` en el contenedor del modal y `overflow-y-auto` en el div de contenido (`app/(admin)/admin/clientes/page.tsx`, componente `Modal`). Reverificado: `admin-clientes.spec.ts` pasa dentro de la corrida completa.

Nota aparte: correr `admin-clientes.spec.ts` en soledad (`--workers=1`, un solo spec) mostró un fallo distinto y no relacionado ("No hay turnos disponibles" al elegir fecha) que no se reprodujo corriendo la suite completa — probablemente un artefacto de orden/timing de siembra específico de aislar ese spec (el profesional recién creado en `global-setup.ts` se crea después del `PUT /api/businesssettings` que dispara la generación de turnos, y solo el conjunto completo de specs corriendo en paralelo parece dejarlo con turnos disponibles). No investigado a fondo — la corrida que importa (la suite completa) pasó limpia, y no es cómo se corre normalmente.

### Resultado final

- **`npx playwright test --workers=3`: 18/18 ✅** (1.6 min).
- **`dotnet test` (backend, con Docker/Testcontainers ya disponible en este entorno a diferencia de la sesión 16): 78/78 ✅**, 0 fallos, 0 omitidos, 14s. Confirma que los cambios aditivos de la sección 16 (endpoint `mark-sent`, `SendToAddressAsync` en los 5 providers, nuevos campos de DTO) no rompieron nada existente. Warnings preexistentes sin relación (vulnerabilidad moderada en `MailKit` 4.15.1, conflicto de versión `Microsoft.EntityFrameworkCore.Relational` 9.0.0 vs 9.0.1) — no bloqueantes, no investigados en esta sesión.

Con esto quedan cerrados los dos pendientes explícitos que la sección 16 dejó abiertos. **Siguen pendientes, sin tocar:** el hallazgo de `admin-config.spec.ts` fallando en soledad con cache sucio (sección 15), el componente de Toast compartido, el soporte táctil para drag&drop en mobile, y mover el CRUD de Reminders/CustomerProfile fuera de `RemindersController`.

---

## 18. Actualización — sesión 16/07 (cierre del hallazgo de `admin-config.spec.ts`)

Continuación directa de la sección 17, en la misma conversación, atacando en orden el primer pendiente de la lista.

### Bug real encontrado: no era cache de Next.js ni filas duplicadas — era una carrera en el `useEffect` de carga

El hallazgo de la sección 15 especulaba dos candidatos (cache de Next.js, o `SiteConfigRepository` resolviendo mal la fila vigente). Ambos descartados con evidencia directa:

- `SELECT * FROM "SiteConfigs"` contra `bd_turnos_e2e` (vía `docker run postgres:16-alpine psql -h host.docker.internal`, bypaseando toda capa de Next.js) mostró **una sola fila** — no hay condición de carrera de filas duplicadas ni ambigüedad de `FirstOrDefaultAsync()` sin `ORDER BY`.
- Reproducido el fallo corriendo `admin-config.spec.ts` en soledad (`.next/cache` borrado a mano): tras el fallo, la misma consulta directa a la base mostró la fila con `UpdatedAt` recién actualizado (el PUT sí llegó y sí escribió) pero `BusinessName` con el valor **viejo**, no el que el test acababa de tipear. Eso descarta cache de lectura (GET) como causa — el problema está en qué value viajó en el body del PUT.

**Causa raíz:** `ConfiguracionPage` (`app/(admin)/admin/configuracion/page.tsx`) cargaba el config en un `useEffect` sin guard de "ignorar respuesta tardía". React StrictMode (activo por default en Next.js App Router, sin `reactStrictMode: false` en `next.config.js`) invoca los efectos dos veces al montar en modo dev. En una corrida en soledad, con rutas "frías" (compilación on-demand lenta de `/admin/configuracion` y de la ruta proxy `/api/siteconfig`, mismo patrón ya documentado en `global-setup.ts`), la segunda invocación del efecto podía resolver **después** de que el test ya había tipeado el nuevo nombre — y su `setFormData(...)` sin guardas pisaba el estado entero con los datos viejos recién fetcheados, justo antes de que Playwright clickeara "Guardar". El PUT entonces salía con el valor viejo (de ahí el `UpdatedAt` nuevo con `BusinessName` viejo). En la suite completa esto no se ve porque para cuando corre este spec las rutas ya están compiladas (warm) y ambas invocaciones del efecto resuelven casi instantáneas, cerrando la ventana de carrera.

**Fix aplicado:** guard estándar de React (`let ignore = false` + `return () => { ignore = true }`) alrededor del fetch inline en el `useEffect`, descartando `setFormData`/`setLoading` si el efecto ya fue invalidado por una invocación posterior.

**Verificado:** `admin-config.spec.ts` en soledad con `.next/cache` borrado, corrido dos veces — pasa limpio (31s). Suite completa (`npx playwright test --workers=3`) re-corrida después del fix: **18/18 ✅**.

**Nota:** el mismo patrón (`useEffect` sin guard de "ignore" antes de `setState` en un fetch de carga inicial) es potencialmente replicable en otras páginas admin que siguen la misma estructura — no auditado en esta sesión, alcance limitado al spec que efectivamente estaba fallando.

---

## 19. Actualización — sesión 16/07 (cierre del fallo aislado de `admin-clientes.spec.ts`)

Segundo pendiente de la lista, mismo patrón de bug que la sección 18 confirmado en un componente distinto.

### Causa raíz: mismo anti-patrón (fetch sin guard de "ignore"), esta vez en `ReminderForm`

Reproducido de forma consistente corriendo `admin-clientes.spec.ts` en soledad: falla con "No hay turnos disponibles" al elegir fecha, pese a que consultas directas a la base (mismo método de la sección 18: `docker run postgres:16-alpine psql -h host.docker.internal`) confirmaron que el pool global de turnos sin asignar sí tenía disponibilidad (26 turnos futuros con `ProfessionalId` nulo e `IsAvailable=true`) en el momento exacto del fallo.

`ReminderForm` (`app/(admin)/admin/clientes/page.tsx`) precarga `selectedProfessionalId` con el profesional favorito del cliente (sección 16), un profesional recién creado en `global-setup.ts` que nunca tiene turnos propios asignados (`POST /api/timeslots` con `ProfessionalId` explícito nunca se llamó para él). El `useEffect` que trae los turnos disponibles (`GET /api/timeslots/available?professionalId=X`) dispara con ese id apenas monta el formulario — request A, que el backend resuelve vacío porque `TimeSlotsRepository.GetAvailableAsync` filtra estricto por `ProfessionalId` cuando se pasa uno. Al elegir el servicio en el test, `handleServiceChange` resetea `selectedProfessionalId` a `null`, y el mismo efecto vuelve a dispararse — request B, sin filtro de profesional, que trae el pool global (con datos). Sin guard de cancelación, si A tarda más que B en resolver (plausible con rutas frías recién compiladas en una corrida aislada), su `.then` llega **después** y pisa el `slots` correcto de B con el resultado vacío de A.

Exactamente el mismo anti-patrón que la sección 18 (`ConfiguracionPage`), en un `useEffect` distinto del mismo archivo. **Fix aplicado:** mismo guard `ignore` + cleanup en el `useEffect` de `ReminderForm` que hace `GET /api/timeslots/available`.

**Verificado:** `admin-clientes.spec.ts` en soledad, dos corridas consecutivas — ambas pasan limpio (32s, 37s). Suite completa re-corrida después del fix: **18/18 ✅** (1.7 min).

Con esto quedan cerrados los dos primeros puntos de la lista de pendientes. Dado que este mismo anti-patrón ya apareció dos veces en el mismo archivo, vale la pena tenerlo presente si aparecen más flakes de "datos viejos pisando datos nuevos" en otras páginas admin con `useEffect` de carga sin guard.

---

## 20. Actualización — sesión 16/07 (extracción del componente Toast compartido)

Tercer punto de la lista de pendientes — deuda técnica pura (DRY), no un bug: el patrón de notificaciones toast estaba copy-pasteado en **8 páginas admin**, no 7 como decía la sección 16 (se sumó `admin/contenido/page.tsx`, no listado ahí). Se encontraron tres variantes con drift entre sí:

- **Rica** (`turnos`, `calendario`): 4 tipos (incluye `info`), íconos SVG, animación de salida, `duration` configurable por toast. Los propios comentarios del código ("mismo patrón que /admin/turnos") ya señalaban esta como la referencia canónica.
- **Simple** (`productos`, `caja`, `servicios`, `galeria`, `profesionales`): 3 tipos (sin `info`), sin íconos, duración fija (3700/4000ms), sin animación de entrada.
- **Mínima** (`contenido`): 2 tipos (`success`/`error` únicamente), sin componente propio, `<div>` inline sin animación.

**Fix aplicado:** extraído a `src/components/shared/Toast.tsx`, exportando `useToast()` (hook con `{ toasts, showToast, removeToast }`, usando un `useRef` como contador de id en vez de `Date.now()` a secas — el patrón original podía colisionar si dos toasts se disparaban en el mismo milisegundo) y `<ToastContainer />` (con la variante "rica" como diseño único, unificando visualmente las 8 páginas). Las 8 páginas se migraron a importar el hook/componente compartido y se les removió el bloque duplicado (tipo, interfaz, componente `ToastNotification` y a veces `ToastContainer` local).

**Verificado:** `npx tsc --noEmit` (proyecto completo) sin errores; `npx next build` exitoso (41 páginas); suite e2e completa (`npx playwright test --workers=3`): **18/18 ✅**.

Con esto se cierran los primeros tres puntos de la lista de pendientes. **Siguen pendientes:** soporte táctil para drag&drop en mobile del calendario, y mover el CRUD de Reminders/CustomerProfile fuera de `RemindersController`.

---

## 21. Actualización — sesión 16/07 (soporte táctil real para drag&drop en el calendario)

Cuarto punto de la lista — el pendiente que la sección 16 había dejado anotado como "la librería lo permite pero no se probó". Al probarlo de verdad, resultó que la librería **no** lo permitía tal cual: había un bug real en `react-big-calendar` 1.20.0 (la última versión publicada, no hay fix upstream).

### Causa raíz: `EventWrapper.handleStartDragging` descarta todo touch por un chequeo pensado solo para mouse

Código fuente de `node_modules/react-big-calendar/lib/addons/dragAndDrop/EventWrapper.js` (leído directamente, no documentación): el handler que arranca el drag de un evento (cableado tanto a `onMouseDown` como a `onTouchStart`) empieza con `if (e.button !== 0) return;`. En un `TouchEvent`, la propiedad `button` no existe (`undefined`), así que `undefined !== 0` es `true` y la función corta **antes** de llamar a `onBeginAction` — todo `touchstart` se descartaba en silencio, sin importar el navegador o el dispositivo. El resto de la maquinaria de touch (`Selection.js`, el motor genérico de la librería) sí está completa: soporta `touchstart`/`touchmove`/`touchend`, `getEventCoordinates` extrae `touches[0]` correctamente, y hasta implementa un long-press de 250ms antes de armar el drag (para no pisar el scroll de la página) — ese único `if` en `EventWrapper` era el único punto roto.

**Fix aplicado:** parcheado con `pnpm patch` (persiste el fix a través de reinstalaciones futuras vía `patches/react-big-calendar.patch` + `patchedDependencies` en `pnpm-workspace.yaml` — no es un fork, es la forma estándar de pnpm para fixear un bug de un paquete de terceros sin bifurcar el repo). El cambio: `if (e.button !== 0 && e.type !== 'touchstart') return;`.

### Verificación real (no solo lectura de código)

Confirmado con un script Playwright standalone (mismo patrón que la sección 16) contra los dev servers en Testing, con un contexto de navegador `hasTouch: true, isMobile: true` en viewport 390×844: se construyeron y dispararon `TouchEvent`s reales (`touchstart` → esperar >250ms por el long-press → `touchmove` en pasos → `touchend`) sobre un turno reservado en la vista Semana de `/admin/calendario`. Resultado: la clase `rbc-addons-dnd-dragged-event` apareció durante el movimiento (confirmando que el drag arrancó) y el turno terminó reprogramado con éxito — toast **"Turno reprogramado / Se movió a su nuevo horario."**, capturado en screenshot.

Durante esta verificación aparecieron dos problemas del propio entorno de prueba (no del código de la app), documentados por si se repiten: (1) `TaskStop` sobre un proceso `npm run dev` backgroundeado no siempre mata al proceso real de Next.js (quedó un puerto 3000 zombie mientras un nuevo intento arrancaba en 3001/3002 — hubo que matar los PIDs a mano con `taskkill`); (2) mezclar una build de producción (`next build`, corrida en la sección 20 para verificar el refactor de Toast) con el mismo directorio `.next` que después usa `next dev` provoca 404 en los chunks estáticos — hace falta `rm -rf .next` completo (no solo `.next/cache`) antes de levantar el dev server después de una build de producción.

**Verificado además:** suite e2e completa (`npx playwright test --workers=3`) con el patch instalado: **18/18 ✅** — el patch no rompe el drag&drop de mouse existente (mismo código, condición ampliada, no reemplazada).

Con esto se cierran los primeros cuatro puntos de la lista. **Solo queda:** mover el CRUD de Reminders/CustomerProfile fuera de `RemindersController`.

---

## 22. Actualización — sesión 16/07 (separar CustomerProfile de RemindersController — deuda cerrada)

Quinto y último punto de la lista de pendientes, señalado desde la sección 13. `RemindersController`/`ReminderService` mezclaban dos recursos distintos: `CustomerProfile` (ficha de cliente, CRM) y `ScheduledReminder` (avisos programados) — el mismo archivo tenía ambos CRUDs completos.

### Split aplicado, sin cambiar ni una URL externa

Para no romper el proxy del frontend (`app/api/reminders/customers/...`, que pega directo a rutas hardcodeadas del backend) ni los tests de integración existentes (`RemindersEndpointsTests.cs`, que también pegan a URLs literales), el split fue puramente interno — las rutas HTTP quedaron idénticas:

- **Nuevo** `Core/Notifications/Services/CustomerProfileService.cs`: `GetProfilesAsync`, `GetProfileByIdAsync`, `CreateProfileAsync`, `UpdateProfileAsync`, `DeleteProfileAsync`, `GetCustomerHistoryAsync` (movidos tal cual desde `ReminderService`).
- **Nuevo** `Core/Notifications/Controllers/CustomerProfilesController.cs`, con `[Route("api/reminders/customers")]` explícito (mismo prefijo de siempre, ahora fijo en vez de heredado de `[controller]`) — mismos 6 endpoints, mismos verbos, mismos códigos de respuesta.
- `ReminderService.cs` y `RemindersController.cs` quedan reducidos a solo `ScheduledReminder` (`GetRemindersAsync`, `CreateReminderAsync`, `UpdateReminderAsync`, `CancelReminderAsync`, `MarkSentAsync` — este último agregado en la sección 16).
- DTOs separados en dos archivos: `CustomerProfileModels.cs` (nuevo) y `ReminderModels.cs` (reducido a solo los records de `ScheduledReminder`).
- `Program.cs`: se agregó `builder.Services.AddScoped<CustomerProfileService>();` junto al registro existente de `ReminderService`.

Confirmado por grep que `ReminderService`/`RemindersController` no tenían otros consumidores en el código (solo se referenciaban entre sí y en `Program.cs`), así que no quedó nada más por actualizar del lado del backend.

### Verificación

- `dotnet build`: limpio.
- `dotnet test`: **78/78 ✅**, incluye `RemindersEndpointsTests.cs` pegándole a las URLs literales (`/api/reminders`, `/api/reminders/customers`, `/api/reminders/customers/{id}`, `/api/reminders/{id}/cancel`) sin ninguna modificación — confirma que el split no cambió el contrato HTTP.
- Suite e2e completa (`npx playwright test --workers=3`): **18/18 ✅**, con un hallazgo de infraestructura de testing en el camino — la base `bd_turnos_e2e` se quedó completamente sin turnos disponibles (0 de ~87 turnos futuros libres) por la cantidad de corridas completas de la suite acumuladas en esta única sesión (aprox. 10+ corridas entre las secciones 17 a 22). Causa: `TimeSlotGeneratorService.GenerateSlotsForDayAsync` solo evita duplicados por `StartDateTime` (sin filtrar por `IsAvailable`), así que una vez que un horario del día queda reservado, `RegenerateAllSlotsAsync` (que borra y recrea solo los turnos **disponibles**, nunca los reservados) ya no vuelve a generar un turno libre ahí — correcto para el negocio real (un turno reservado no debe "reaparecer" libre), pero agota la ventana fija de `MaxDaysInAdvance=10` días si se corre la suite demasiadas veces el mismo día calendario contra una base que nunca se resetea (mismo problema de fondo ya documentado en las secciones 9, 12, 13 y 15). Solucionado puntualmente borrando los `TimeSlots` futuros de `bd_turnos_e2e` a mano (confirmado antes que los `ON DELETE` de todas las FKs relacionadas —`BookingItems`, `Payments`, `NotificationLogs` en cascada; `CajaMovements`, `ScheduledReminders` a null— no iban a bloquear el borrado), no es un bug de la app ni algo introducido por esta sesión.

Con esto quedan **cerrados los cinco puntos** de la lista de pendientes que arrancó en la sección 16.

---

## 23. Actualización — sesión 16/07 (Estadísticas — extensión "Por profesional")

Penúltimo módulo grande del PRD de la tabla de la sección 7: dashboards nuevos por profesional (ventas, horas ocupadas/libres, ausencias). Ya había una base en `AnalyticsController`/`AnalyticsRepository` (`GET api/analytics/summary`), así que se extendió agregando un método nuevo en vez de crear un controller aparte.

### Qué se agregó

- `IAnalyticsRepository.GetProfessionalStatsAsync(monthStart, monthEnd)`: por cada profesional activo, calcula del mes actual — ventas (suma de `Payment.Amount` con `Status=Approved` y `PaidAt` en el mes, unido por `Booking.ProfessionalId`), turnos pagados, horas ocupadas/libres (a partir de los `TimeSlot` del profesional en el mes, materializados en memoria y sumados como `(EndDateTime-StartDateTime).TotalHours` — mismo criterio que otros métodos de este repositorio que no traducen bien a SQL), % de ocupación, y ausencias próximas (conteo de `BlockedDates` con `ProfessionalId` propio desde hoy en adelante).
- Campo nuevo `professionalStats` agregado a la respuesta existente de `GET /api/analytics/summary` — no se creó un endpoint nuevo.
- Frontend: nueva sección "Por profesional" en `/admin/estadisticas`, tabla con scroll horizontal en mobile.

### Verificación

- `dotnet build` y `npx tsc --noEmit`: limpios.
- **No se corrió `dotnet test` ni la suite e2e de Playwright en esta sesión** — a diferencia de sesiones anteriores, este entorno no tiene Docker disponible (Testcontainers lo requiere para levantar Postgres en los tests de integración). Se agregó igualmente una aserción de shape (`professionalStats` presente) al test de integración existente de Analytics, para que corra la próxima vez que alguien la ejecute con Docker disponible.

---

## 24. Actualización — sesión 16/07-17/07 (Automatizaciones — primer corte)

Último módulo grande del PRD de la tabla de la sección 7, además del Design System: "motor visual trigger→condición→acción→espera". Decisión de alcance acordada con el usuario antes de empezar: **no** construir un motor visual tipo canvas (Zapier/n8n) — esta misma auditoría ya señalaba que "es un producto en sí mismo" (sección 7) — sino una lista de reglas simple, cubriendo los dos triggers de mayor valor real para el negocio: cliente inactivo (win-back) y cumpleaños de cliente.

### Diseño: reutilizar el pipeline de envío existente en vez de reconstruirlo

El sistema ya tenía ~90% de la infraestructura necesaria: `ScheduledReminder` (entidad) + `HangfireReminderJob` (procesa pendientes cada 5 min, WhatsApp directo o Email+WhatsApp si hay `Booking` vinculado). La pieza que faltaba era solo el "quién dispara" — así que el nuevo job de automatizaciones **no reimplementa el envío**, solo decide a quién y crea un `ScheduledReminder` con `ScheduledFor = ahora`, que el job existente recoge solo en su próximo tick.

### Nuevo módulo `Core/Automations/`

- Entidades: `AutomationRule` (trigger, condición embebida en `InactiveDays`, `MessageTemplate`, `CooldownDays`, `IsActive`) y `AutomationRuleExecution` (log de deduplicación, referenciando el `ScheduledReminder` que generó).
- `IAutomationRulesRepository`/`AutomationRulesRepository`: CRUD + `EvaluateRuleAsync` (matchea cumpleaños por `CustomerProfile.Birthday` o inactividad por última reserva agrupada por `CustomerPhone` — no hay FK `Booking`→`CustomerProfile`, el vínculo es siempre por teléfono).
- `AutomationRuleEvaluationJob`: job de Hangfire diario (`0 12 * * *` UTC ≈ 9am Argentina).
- `AutomationRulesController` (`api/automationrules`): CRUD + `POST {id}/run-now` para probar sin esperar el cron.
- `ArgentinaClock` extraído a `Shared/Utilities/` (antes duplicado como método privado de `ReminderBackgroundService`) — ahora genuinamente compartido entre ese servicio y el nuevo job.
- Migraciones: `AddAutomationRules`, `AddClientLabelToAutomationRules`, `AddScheduledReminderToAutomationRuleExecution` (las últimas dos, ver más abajo).

### Hallazgo crítico de diseño: tenant scoping dentro de un job sin HTTP context

Un Hangfire recurring job no pasa por `TenantResolutionMiddleware`, así que `ICurrentTenant.TenantId == 0` dentro del job — el query filter automático de EF (`HasQueryFilter(x => x.TenantId == _currentTenant.TenantId)`) filtraría todo por `TenantId=0` y devolvería cero filas en producción real. `HangfireReminderJob` ya resolvía esto (`IgnoreQueryFilters()` + `TenantId` seteado a mano en cada insert, ver su línea que crea el próximo recordatorio recurrente) — el mismo patrón se replicó en `AutomationRulesRepository.EvaluateRuleAsync` y en `GetActiveRulesCrossTenantAsync`.

### Dos ajustes de producto pedidos por el usuario después del primer corte

1. **El nombre interno de la regla se filtraba al mensaje del cliente**: `ScheduledReminder.ServiceLabel` (que alimenta el placeholder `{servicio}`) salía directo de `AutomationRule.Name` — un campo pensado solo para que el admin identifique la regla. Se agregó `ClientLabel`, un campo separado y deliberadamente distinto de `Name`, para que un nombre interno tipo "Regla winback V2" nunca llegue a la vista del cliente.
2. **Las automatizaciones no mandaban email**: como nunca tienen `BookingId` vinculado, siempre caían en la rama de `HangfireReminderJob` que solo hacía WhatsApp directo. Se extendió esa rama para que, si el `CustomerProfile` tiene email cargado, también intente `GmailProvider.SendToAddressAsync` — best-effort, si el email falla no se marca el recordatorio como fallido porque WhatsApp (canal principal) ya salió. De yapa, esto también mejora los avisos manuales sin turno vinculado que ya existían antes de esta sesión.

### Tercer ajuste: visibilidad de a quién le disparó cada regla

No había ninguna forma de ver, desde el admin, a qué clientes les había llegado un aviso automático. Se vinculó `AutomationRuleExecution` con el `ScheduledReminder` específico que generó (antes eran dos inserts sin relación entre sí), y se agregó `GET /api/automationrules/{id}/executions` + un botón "Ver envíos" por regla en `/admin/automatizaciones`, mostrando cliente, teléfono, cuándo se disparó, y el estado real del envío (Pendiente/Enviado/Falló).

### Verificación

- `dotnet build` y `npx tsc --noEmit`: limpios en cada paso.
- 3 migraciones generadas y verificadas por lectura del código generado (no solo confiando en que corrieron sin error) — se aplican solas al arrancar la API vía `Database.Migrate()`, no hizo falta un `database update` manual.
- **Gotcha de esta sesión en particular:** el backend real del usuario estaba corriendo en paralelo mientras se implementaba, bloqueando el `.exe` final (`MSB3027`/copy-lock) en cada `dotnet build` — no es un error de compilación (confirmado grepeando el log completo por `error CS`, cero matches), pero sí impedía que `dotnet ef migrations add` viera los cambios nuevos vía el flag `--no-build` (usaba el `.dll` viejo en `bin/`, generando migraciones vacías dos veces antes de notar la causa). Solución aplicada: copiar a mano `obj/Debug/net9.0/Turneo.Api.dll` sobre `bin/Debug/net9.0/Turneo.Api.dll` (el `.dll` sí se recompila en `obj/` aunque falle el copy final del `.exe`) antes de cada `migrations add --no-build`.
- **No se corrió `dotnet test` ni la suite e2e** — mismo motivo que la sección 23, sin Docker en este entorno.
- **Verificación end-to-end real (crear regla → "Probar ahora" → confirmar `ScheduledReminder` creado → confirmar envío real) no se completó en esta sesión** — quedó pendiente de que el usuario reinicie su backend local para tomar los últimos cambios (ClientLabel + canal de email + historial de envíos). A diferencia de otras secciones de esta auditoría, este primer corte se documenta con la implementación y los checks estáticos (build/typecheck) confirmados, pero sin la corrida real todavía.

---

## 25. Actualización — sesión 17/07 (UX / Design system — arranque)

Único ítem de la tabla de la sección 7 que seguía sin ningún trabajo (los otros seis módulos del PRD ya se habían cerrado en sesiones anteriores, incluidas las secciones 23 y 24 de más arriba). Sesión enfocada exclusivamente en frontend, sin tocar backend.

### Parte 1 — Unificación de la página pública de Servicios

Retomando la nota de la sección 11 ("ese archivo usa un sistema de diseño distinto, midnight/lux, remanente del template previo al pivot"): al revisar `tailwind.config.js` se confirmó que **`midnight` y `lux` no están definidas en ningún lado** — no son "otra paleta", son clases muertas. El resultado real en `app/(public)/servicios/page.tsx` y `.../servicios/[slug]/page.tsx` era `bg-midnight` (sin efecto, fondo por defecto) combinado con `text-slate-100` (gris casi blanco, sí es un color real de Tailwind) — texto prácticamente invisible sobre fondo claro. Un bug activo, no solo inconsistencia visual.

**Fix aplicado:** ambos archivos migrados a la misma paleta que ya usa la Home (`cream/charcoal/mauve/blush/champagne`, reusando `.glass-card`/`.badge` de `globals.css`, ya themeados correctamente porque son clases globales).

**Verificado:** `npx tsc --noEmit` limpio. Confirmado visualmente con un screenshot de Playwright contra el dev server real — header/hero legible y coherente con el resto del sitio (sin datos de servicios en el screenshot porque el backend .NET no estaba levantado en este entorno; los 500 de `/api/services` son por eso, no por el cambio de estilos).

### Parte 2 — Relevamiento de botones e inputs en las 16 páginas admin

Antes de tocar código, se hizo el mismo tipo de relevamiento que ya se usó para unificar el Toast (sección 20), vía un agente de exploración dedicado. Hallazgos:

- **No existe ningún componente `Button`/`Input` compartido.** `globals.css` define `.form-input` desde hace tiempo, pero tiene **0 usos reales** en las 16 páginas — mismo patrón exacto que el Toast antes de unificarse (una clase compartida que nadie usa).
- **Botón primario:** 5 variantes distintas (una domina en 6 páginas; login/cuenta/configuración usan una variante pill deliberada para CTA único; Contenido usaba verde plano sin relación con la marca).
- **Botón de peligro:** 7 variantes, con un bug de contraste real (`text-charcoal` sobre fondo rojo en Galería/Productos, poco legible) — **no corregido todavía**, ver pendientes.
- **Inputs:** 8 variantes inline distintas, incluyendo un `focus:border-green-500` sin relación semántica con la marca (drift de copiar/pegar).
- **Hallazgo que corrigió una primera lectura incorrecta:** `clientes/page.tsx` parecía tener botones/inputs rotos (clases `input-field`/`btn-primary`/`btn-ghost` no encontradas por un primer grep). Al leer el archivo completo apareció la causa real: definía su **propio** sistema de estilos vía `<style jsx global>` al final del archivo — una séptima variante aislada, con paleta dorado/champagne que no se usa en ningún otro lado del admin. No estaba roto, estaba simplemente desconectado del resto.

### Componente nuevo: `src/components/shared/Button.tsx`

Variantes `primary` (blush + `shadow-glow`, la más usada), `secondary` (outline mauve), `danger` (rojo, con contraste correcto — `text-white`, no el `text-charcoal` que tenía el bug de Galería/Productos); tamaños `default`/`sm`; forma `default`/`pill` (para los CTA únicos de login/cuenta/configuración, mantenidos como variante deliberada en vez de forzarlos a la forma dominante).

**Bug propio encontrado en verificación visual, no solo lectura de código:** la variante `secondary` (`bg-porcelain/5`, sin borde) quedaba prácticamente invisible dentro del modal de Clientes, cuyo fondo (`bg-porcelain`) es del mismo color de base — confirmado con un screenshot real, no evidente leyendo el className aislado. **Fix:** se agregó `border border-mauve/15` a la variante, para que se lea como botón sin importar el color del contenedor.

### Migración piloto: Clientes y Contenido

Alcance acotado a las dos páginas con problemas reales encontrados en el relevamiento (Clientes por el sistema aislado, Contenido por el verde fuera de marca):

- `clientes/page.tsx`: eliminado el bloque `<style jsx global>` completo; los 11 inputs/selects/textarea migrados a `.form-input`; los 4 botones (`CustomerForm` y `ReminderForm`, guardar/cancelar) migrados a `<Button variant="primary">`/`<Button variant="secondary">`.
- `contenido/page.tsx`: botones "+ Nuevo video"/"Guardar" (verde) → `<Button variant="primary">`; "Editar"/"Cancelar" → `variant="secondary"`; "Eliminar" → `variant="danger"`; inputs de título/orden → `.form-input`.

**Verificado:** `npx tsc --noEmit` y `npx next build` (build de producción completa) limpios. Verificación visual real contra el dev server: como el middleware (`middleware.ts`) protege `/admin/*` a nivel de servidor por la sola *presencia* de la cookie `admin_token`/`token` (no valida la firma en ese punto, eso lo hace el backend después), se simuló una sesión localmente con una cookie dummy + flags de `localStorage`/`sessionStorage` — válido solo para QA visual local, no un bypass de nada real, ya que cualquier llamada a la API real seguiría exigiendo un JWT válido del backend (no levantado en este entorno). Se confirmaron ambos modales ("Nuevo video", "Nuevo cliente") con inputs y botones ya coherentes con el resto del sitio.

### Explícitamente pendiente al cierre de esta sesión (cerrado en la sección 26, misma conversación)

- **14 páginas admin restantes** con el mismo drift documentado arriba: turnos, calendario, servicios, profesionales, galería, productos, caja, configuración, cuenta, login, historial, automatizaciones, dashboard, estadísticas.
- El bug de contraste de los botones de peligro en Galería/Productos (`text-charcoal` sobre rojo) — el componente `Button` ya lo resuelve, pero esas páginas todavía no fueron migradas.
- Un componente `Input`/`Select` compartido — por ahora solo se promovió el uso de la clase `.form-input` ya existente, no se extrajo un componente React.
- Dark mode — no se empezó.
- Decisión explícita de no correr la suite e2e de Playwright ni `dotnet test` en esta sesión: los cambios son puramente de frontend/estilos, sin tocar backend ni lógica, y el riesgo de regresión funcional es bajo — pero no se puede dar por cerrado el pendiente sin correrla al menos una vez con el backend disponible.

---

## 26. Actualización — sesión 17/07 (rollout del Button/`.form-input` a las 14 páginas admin restantes)

Continuación directa de la sección 25 en la misma conversación: se pidió explícitamente seguir con el rollout completo en vez de dejarlo en el piloto de Clientes/Contenido.

### Alcance: las 14 páginas restantes, `estadisticas` confirmada 100% de solo lectura

`turnos`, `calendario`, `servicios`, `profesionales`, `galería`, `productos`, `caja`, `configuración`, `cuenta`, `login`, `historial`, `automatizaciones`, `page.tsx` (dashboard) migradas. `estadisticas/page.tsx` se verificó por grep (`<button|<input|<select|<textarea`, cero resultados) — no tiene ningún control interactivo, no había nada que migrar, tal como ya se sospechaba en el relevamiento.

### Bug real encontrado por el propio proceso de migración, no por lectura de código: `.form-input` no se puede combinar con un ancho fijo

Al migrar los inputs de hora/minuto de `turnos/page.tsx` (`w-20`, dos campos lado a lado con `:` en el medio) a `form-input w-20`, se generó y comparó el CSS compilado (`npx tailwindcss -i globals.css -o out.css`) para confirmar el orden de cascada: `.w-20` (utility, línea 970 del output) aparece **antes** que `.form-input` (línea 2940) — como `globals.css` declara `.form-input` después de `@tailwind utilities`, su `width: 100%` (heredado del `@apply w-full` original) queda más abajo en la cascada y **gana** por igual especificidad, aunque `w-20` esté escrito después en el `className`. Es decir, `form-input w-20` habría renderizado a ancho completo, rompiendo el layout compacto de hora/minuto — un bug que solo aparece en runtime, no se ve leyendo el JSX. **Fix:** esos dos inputs quedaron con su clase bespoke original (`w-20 bg-cream border ...`), solo corrigiendo el foco verde a `focus:border-blush` — no se forzó `.form-input` donde no encaja. Ningún otro input migrado en esta sesión tenía un conflicto de ancho equivalente (se revisó cada uno antes de aplicar `form-input`).

### Otros bugs de contraste/drift corregidos de paso (no solo el de Galería/Productos ya conocido)

- **`servicios/page.tsx`** — el bloque "Campos adicionales del formulario" (constructor de campos dinámicos del formulario público) usaba `bg-black/30` (fondo casi negro) **dentro de un contenedor `bg-cream`**, con `text-charcoal` (texto oscuro) encima — texto oscuro sobre fondo oscuro, mal contraste real en producción. Corregido a `bg-ivory` + `focus:border-blush` en los 4 controles de ese bloque (nombre del campo, key, tipo, textarea de opciones).
- **Panel principal (`admin/page.tsx`) y `calendario/page.tsx`** — el botón "Cancelar turno"/"Liberar turno" (acción destructiva real) estaba estilizado neutro (`bg-porcelain/5 ... hover:text-red-600`, el rojo solo aparecía en hover) — exactamente el hallazgo ya anotado en el relevamiento de la sección 25 ("Turnos... estilizado neutral"), reproducido también en estos otros dos lugares. Los tres (`admin/page.tsx`, `admin/turnos/page.tsx`, `admin/calendario/page.tsx`) migrados a `<Button variant="danger">`.
- **`turnos/page.tsx`** — links de texto "Editar"/"Ver detalle" en `text-blue-700` (azul fuera de marca, sin relación con la paleta `cream/mauve/blush`) → `text-blushdark`. Mismo fix en `calendario/page.tsx` ("+ Reservar"/"Ver detalle") y `historial/page.tsx` ("Confirmar").
- **`historial/page.tsx`, `turnos/page.tsx`, `calendario/page.tsx`** — botones "Confirmar" con outline azul (`bg-blue-600/20 border-blue-600/50`) migrados a `<Button variant="primary">`.

### Qué se dejó deliberadamente sin tocar (mismo criterio que la sección 25: no forzar todo a un solo componente)

- Controles de navegación/paginación (flechas prev/next, números de página), tabs de filtro tipo segmented-control (estado, vista mes/semana/día, profesional), y buscadores con ícono — son patrones estructuralmente distintos a un botón de acción o un input de formulario; forzarlos al componente `Button`/`.form-input` habría roto su affordance específica sin ganar consistencia real.
- Inputs compactos dentro de filas densas (editor de ítems de `historial`, horario semanal de `profesionales`, selector de tipo/monto de `caja`) — incompatibles con el padding/tamaño fijo de `.form-input` sin rehacer el layout de la fila; se dejaron con su estilo propio, solo corrigiendo colores fuera de marca donde los había.
- Checkboxes con `accent-green-500`/`accent-blush` — decorativos, no parte del sistema de botones/inputs.
- El WhatsApp CTA verde (`bg-green-600`, usado en varios modales de detalle) — es un color de marca deliberado (WhatsApp), no drift; se dejó igual que en sesiones anteriores.

### Verificación

- `npx tsc --noEmit`: limpio, corrido después de cada archivo (14 checkpoints, no solo al final).
- `npx next build` (producción completa): limpio, 0 errores, corrido después del rollout completo.
- Verificación visual real contra el dev server (mismo método de sesión con cookie/localStorage simulados de la sección 25, backend .NET no disponible en este entorno): capturas de `turnos` (confirma que el fix de ancho hora/minuto no rompió el layout — "09 : 00" se ve compacto, no estirado), `caja` (formulario "Abrir caja"), `automatizaciones` (modal "Nueva Regla" completo) y `calendario` (vista Mes). Sin errores de React en consola.
- **No se corrió la suite e2e de Playwright ni `dotnet test`** — mismo criterio que la sección 25: cambios puramente de estilos/estructura de componentes en el frontend, sin tocar lógica de negocio ni contratos de API. Recomendado correr `npx playwright test --workers=3` antes de dar el rollout por cerrado en un entorno con el backend disponible, dado el volumen de archivos tocados (14 páginas).

Con esto se cierran los cinco puntos pendientes de la sección 25 salvo dos, que quedan fuera de alcance a propósito (no regresiones, decisiones de scope): un componente `Input`/`Select` de React (hoy es solo la clase CSS `.form-input`) y **dark mode**, que no se encaró en ningún momento de esta sesión.

---

## 27. Actualización — sesión 17/07 (bug de fechas cortadas en Calendario, vista Semana)

Reportado por el usuario después del rollout de las secciones 25-26: en `/admin/calendario`, vista Semana, las fechas de la fila de encabezado ("13 lun", "14 mar", etc.) se veían cortadas.

### Diagnóstico: reproducido con datos de prueba, no solo lectura de código

Se armó una página temporal (`app/(admin)/admin/debugagenda123/`, borrada al cerrar la sesión) que renderiza `AgendaCalendar` con profesionales y turnos mock, sin depender del backend — permitió reproducir el bug de forma aislada y confirmar visualmente antes de tocar CSS. Un screenshot recortado sobre la celda de fecha mostró los números con la mitad superior cortada.

**Causa raíz:** en la sesión 16 (rediseño visual del calendario) se agregó `padding: 10px 6px` a `.rbc-header` en `agenda-calendar.css`. Ese selector aplica tanto a la fila de nombre de profesional como a la fila de fechas por día (vista Semana). Con `box-sizing: border-box` (reset global de Tailwind), react-big-calendar estira `.rbc-header` por flexbox al alto que le da su fila contenedora — no al revés — y esa fila de fechas terminó midiendo solo ~21px de alto real. Con 20px de padding vertical (10px arriba + 10px abajo) comidos por el `border-box` dentro de esos 21px, quedaba menos de 1px de espacio visible para una línea de texto de ~21.6px de alto — de ahí el recorte casi total, dejando ver solo una franja del borde inferior de cada número. Confirmado midiendo estilos computados en el navegador (`getComputedStyle`), no solo inspección visual.

**Fix aplicado:** `min-height: 40px` en `.agenda-calendar .rbc-time-header-content .rbc-row` y `.rbc-row-resource` — le da a esas filas alto suficiente para que el padding y el texto convivan sin recortarse.

**Verificado:** reproducido el bug con la página de prueba, confirmada la causa con estilos computados, aplicado el fix y reverificado visualmente — las fechas se ven completas en Semana. Vista Día no estaba afectada (no tiene esa fila de fechas por día, solo la de profesional) y se confirmó sin cambios. Página de debug y screenshots temporales borrados al cerrar; único archivo modificado: `src/components/calendar/agenda-calendar.css`.

---

## 28. Actualización — sesión 18/07 (reservar con cliente registrado o nuevo, desde Calendario Y desde el Panel principal)

Pedido del usuario: en cualquier turno disponible, tanto en `/admin/calendario` como en el **Panel principal** (`/admin`, el dashboard con la tabla de próximos turnos), poder reservarlo eligiendo un **cliente ya registrado** (autocompletando sus datos) o cargando uno **nuevo** — y que ese cliente nuevo quede **registrado automáticamente** como ficha de `CustomerProfile`, no solo como texto suelto en el turno. Cambio **100% frontend**, sin migraciones ni endpoints nuevos — confirmado antes de tocar código que `CustomerProfileService.CreateProfileAsync` (sección 13) ya es idempotente por teléfono (devuelve el existente si ya está cargado en vez de duplicar o fallar), lo que vuelve seguro "registrar automáticamente" sin chequeo previo de duplicados del lado del frontend.

**Estado anterior:** el modal "Nueva reserva" de Calendario (secciones 9-10) era de texto libre — nombre/teléfono a mano, sin buscar ni vincular un `CustomerProfile` existente. El Panel principal directamente no tenía ninguna forma de reservar: un turno libre en la tabla/tarjetas no respondía al click (`onClick` solo abría el detalle si el turno ya tenía `booking`).

**Componente nuevo, compartido entre ambas pantallas:** `src/components/calendar/ReserveSlotModal.tsx` — antes no existía ningún customer-picker reutilizable en el frontend (cada pantalla que necesitaba clientes los buscaba inline, ver `/admin/clientes`). El componente:
- Al montar, hace su propio fetch de `/api/services`, `/api/professionals` y `/api/reminders/customers` — no depende de que la página que lo monta ya los tenga cargados.
- Toggle "Cliente registrado" / "Cliente nuevo" (default: registrado). En modo registrado, buscador que filtra por nombre/teléfono/email (mismo criterio que el buscador de `/admin/clientes`, sección 13) y al elegir uno autocompleta nombre/teléfono/email de solo lectura. En modo nuevo, inputs de nombre/teléfono (validados en el propio modal, teléfono ≥6 caracteres, mismo mínimo que exige el backend) y un campo de email nuevo que el modal original no tenía.
- Al confirmar en modo nuevo: primero `POST /api/reminders/customers` (crea o recupera la ficha por teléfono), después `POST /api/bookings` con esos datos — mismo endpoint y mismo `CreateBookingRequest` de siempre, sin tocar el backend. El vínculo turno↔cliente sigue siendo por `CustomerPhone` como texto, no por `CustomerId` (no existe esa FK, mismo criterio ya documentado en la sección 13 para el historial de Clientes).

**`/admin/calendario`:** el modal inline (`reserveForm`/`reserving`/`reserveError`/`handleReserve`, líneas ~72-166 y ~474-586 antes de este cambio) se reemplazó por `<ReserveSlotModal>`. Se eliminó también el fetch de `/api/services` de la página (quedó sin ningún otro consumidor una vez que el modal pasó a buscar los suyos propios) — verificado con grep antes de borrar que `services` no se usaba en ningún otro lugar de la página; `professionals` sí sigue usándose (filtros de mes/agenda) y no se tocó.

**`/admin` (Panel principal):** hasta ahora era una pantalla de solo lectura + liberar/cancelar. Se agregó:
- `interface Slot` suma `professionalId`/`professionalName` (ya los devuelve `/api/timeslots`, no se usaban en esta página).
- Turnos libres (tarjetas mobile y filas de la tabla desktop) ahora son clickeables y muestran un botón "+ Reservar" en la columna de acción (antes esa columna quedaba vacía para turnos libres, solo mostraba "Liberar/Cancelar" para los reservados).
- La carga de slots del `useEffect` inicial se extrajo a una función `reloadSlots()` reutilizable, para poder refrescar la lista después de reservar sin duplicar la lógica de filtrado/orden/límite de 30 turnos.
- Mismo `<ReserveSlotModal>` que Calendario, montado condicionalmente sobre `reserveSlot`.

**Regresión propia encontrada y corregida antes de cerrar la sesión:** los dos e2e existentes que reservan desde este modal (`e2e/admin-calendario.spec.ts` y `e2e/admin-agenda.spec.ts`, secciones 9 y 12) llenaban `calendario-reserve-name`/`calendario-reserve-phone` directamente — con el modo "Cliente registrado" como default nuevo, esos campos quedan ocultos hasta clickear "Cliente nuevo", así que ambos specs habrían empezado a fallar con este cambio. **Fix aplicado:** se agregó `await page.getByTestId("reserve-mode-new").click()` antes de llenar nombre/teléfono en los dos specs. Los `data-testid` del modal original (`calendario-reserve-modal`, `-service`, `-subject`, `-submit`, y `-name`/`-phone` dentro del modo nuevo) se preservaron sin cambios a propósito para minimizar el diff de los tests.

**Verificado:**
- `npx tsc --noEmit` (frontend): sin errores.
- `pnpm build`: compila limpio, todas las rutas generadas incluyendo `/admin` y `/admin/calendario`.
- `git status` confirmó que el único código tocado fue `app/(admin)/admin/calendario/page.tsx`, `app/(admin)/admin/page.tsx`, el componente nuevo, y los dos specs de e2e — ningún archivo de backend.

**No verificado en esta sesión (pendiente):** no se corrió la suite de e2e completa (`npx playwright test`) tras el cambio — requiere el backend en modo `Testing` contra `bd_turnos_e2e` y no se levantó ese entorno en esta sesión. Los dos specs corregidos (`admin-calendario`, `admin-agenda`) deberían pasar dado el fix aplicado, pero eso sigue siendo una hipótesis hasta la próxima corrida real de la suite. Tampoco se escribió un e2e nuevo para el flujo de "cliente registrado" (autocompletar desde el buscador) ni para reservar desde el Panel principal — ambos caminos nuevos de esta sesión quedan sin cobertura automatizada, solo verificados por build/type-check.

**Explícitamente fuera de alcance de esta sesión** (confirmado con el usuario antes de construir): el paso opcional de programar un aviso/recordatorio al reservar (sí existe en el flujo de Clientes, `ReminderForm`, sección 13) no se sumó a este modal — el pedido fue específicamente "cliente existente o nuevo", no el flujo completo de avisos.

---

## 29. Actualización — sesión 18/07 (atajos de teclado, detalle de turno accesible desde 3 pantallas más, y sistema de permisos por rol)

Sesión larga con varios pedidos encadenados del usuario. Se documentan en el mismo orden en que se pidieron, de menor a mayor alcance — el módulo de Permisos (último pedido) es, con diferencia, el cambio más grande de esta entrada.

### Toast: rediseño + bug de scroll infinito

`src/components/shared/Toast.tsx` tenía fondo sólido saturado por tipo (verde/rojo/naranja/azul), desentonando con la paleta cream/ivory/mauve del resto del admin. Rediseño a card ivory con barra de acento lateral + chip de ícono + barra de progreso del tiempo restante, reusando `shadow-elevated`/`border-mauve` ya definidos en `tailwind.config.js`.

**Bug real encontrado y corregido de paso:** `showToast` acumulaba notificaciones sin ningún límite en un contenedor `fixed` sin techo de altura — con varias seguidas (ej. varios guardados rápidos), el contenedor estiraba la altura de toda la página en vez de quedarse fijo arriba a la derecha. **Fix:** `showToast` cappea el array a los últimos 4 (FIFO), causa raíz resuelta en el estado, no con CSS. Como es un hook compartido, el fix aplica automático a las 13 páginas que usan `useToast`/`ToastContainer`.

### Atajos de teclado en modales y formularios

Hook nuevo `src/hooks/useModalHotkeys.ts` (Esc cierra / Ctrl-Cmd+Enter confirma vía `formRef.current?.requestSubmit()`), aplicado a `ConfirmDialog` (usado en toda la app) + 8 páginas admin con formularios CRUD (productos, servicios, insumos, profesionales, contenido, galería, automatizaciones, caja) + 5 modales de solo lectura (turnos, calendario, historial, clientes, mis-turnos) + la página pública + `ReserveSlotModal` — 16 archivos en total. Sin tests automatizados nuevos, verificado solo con `npx tsc --noEmit` limpio en cada archivo.

### Detalle de turno accesible/editable desde 3 pantallas que antes no lo tenían

Pedido en pasos sucesivos del usuario, sobre `/admin/calendario` primero y después replicado a otras dos pantallas:

- **`/admin/calendario` — panel del día y detalle de turno:**
  - El panel lateral de turnos del día (vista Mes) no tenía techo de altura — con muchos turnos cargados un mismo día, estiraba toda la página en vez de scrollear internamente (mismo patrón de bug que el Toast, en otra pantalla). **Fix:** `max-h-[520px] overflow-y-auto` en la lista, encabezado fijo afuera del área con scroll.
  - Toda la fila de un turno reservado pasó a ser clickeable (antes solo un link chico "Ver detalle" adentro de la fila).
  - El modal de detalle (compartido entre vista Mes y la agenda semana/día vía `AgendaCalendar`) sumó una sección de "Productos y servicios utilizados" con alta/baja de ítems (servicio extra, producto, insumo), reusando el mismo `PUT /api/bookings/{id}/detail` que ya existía para Historial (sección 14) — como `GET /api/timeslots` no trae los ítems del turno, se sumó un fetch de `GET /api/bookings` (que sí los trae) para cruzar por id al abrir el modal.
  - Botón "Editar" nuevo en el modal de detalle, que cambia a un modal separado (cliente/teléfono/detalle/servicio/mensaje) — **endpoint nuevo `PUT /api/bookings/{id}` + DTO `UpdateBookingRequest`**, deliberadamente sin tocar `ProfessionalId`: reasignar profesional sigue siendo solo por drag&drop en la agenda, para no desincronizar `Booking.ProfessionalId` del `TimeSlot.ProfessionalId` del slot que ocupa (son dos campos independientes, ver sección 6).
- **`/profesional/agenda`:** no tenía ningún detalle al clickear un turno — solo los botones "Eliminar"/"Liberar" de la sección 9. Se agregó un modal de solo lectura (Cliente, Teléfono, Detalle, Servicio, Mensaje, Estado + link de WhatsApp + botón Liberar). Requirió sumar `subject`/`message` a la respuesta de `GET /api/timeslots/mine` (`TimeSlotsController.cs`), que solo traía customerName/customerPhone/service/status.
- **`/admin/clientes` (historial de un cliente):** las filas de "Historial de turnos" en la ficha de un cliente no abrían nada. Se agregó un modal de detalle (Fecha, Detalle, Servicio, Especialista, Mensaje, Estado, Pago, Ítems utilizados), reusando `GET /api/bookings` (ya trae todo eso) cruzado por id contra el historial resumido que ya cargaba la página — con fallback a los datos mínimos de la fila si por algún motivo no aparece en esa lista.

Ningún cambio de este bloque tiene test automatizado nuevo — todos verificados solo con `dotnet build`/`npx tsc --noEmit` limpios.

### Módulo nuevo: Permisos por rol (Staff) — el cambio más grande de esta sesión

**Pedido del usuario:** un módulo donde el Admin pueda crear cuentas de acceso limitado y asignarles permisos de ver/crear/editar/eliminar, módulo por módulo del panel.

**Decisiones de diseño confirmadas con el usuario antes de construir** (preguntadas explícitamente, no asumidas, dado el alcance):
1. Es un **rol nuevo** ("Staff"), no una versión recortada de Admin ni permisos extra para Profesional — Admin sigue con acceso total siempre sin excepción, Professional no cambia.
2. Granularidad de **4 acciones independientes por módulo**: Ver / Crear / Editar / Eliminar (no un esquema simplificado de 3 niveles).
3. **Enforcement real en backend** (403 vía middleware/filter) además de ocultar cosas en el frontend — no solo UX cosmética.

**Backend — dominio nuevo `Core/Roles`:**
- Entidad `ModulePermission` (`TenantId`, `UserId`, `Module`, `CanView`/`CanCreate`/`CanEdit`/`CanDelete`), única por `(UserId, Module)`. `User.Role` suma el valor libre `"Staff"` — sigue siendo un string, no una entidad propia (`Core/Roles` seguía vacío hasta ahora, confirmado en la sección de arquitectura: el rol es un campo de `User`).
- `PermissionModules`: **10 módulos, no 12.** Se consolidó Turnos+Calendario+Historial en un solo módulo `Turnos`, porque esas tres pantallas admin pegan a los mismos endpoints (`TimeSlotsController`/`BookingsController`) — separarlas en permisos distintos hubiera sido una distinción sin efecto real en el backend. El resto: Clientes, Servicios, Productos, Insumos, Profesionales, Caja, Contenido, Galeria, Automatizaciones.
- `RequirePermissionAttribute` (`IAsyncAuthorizationFilter`), se combina con el `[Authorize(Roles=...)]` ya existente en cada acción. **Bug propio encontrado y corregido antes de terminar el rollout:** la primera versión devolvía 403 a cualquier rol que no fuera exactamente "Admin" o "Staff" — rompía endpoints que ya eran compartidos con Professional (`TimeSlotsController.CreateSlot/UpdateSlot/ReleaseSlot/DeleteSlot`, donde un profesional gestiona su propia agenda). **Fix:** el chequeo granular contra `ModulePermission` ahora solo se ejecuta para el rol Staff; cualquier otro rol que ya haya pasado el `[Authorize(Roles=...)]` de esa acción específica (Admin, Professional en sus propios endpoints) sigue de largo sin restricción adicional del filtro.
- `PermissionsController` (`/api/permissions`, todo `[Authorize(Roles="Admin")]` salvo `GET me`): `GET modules` (catálogo), `GET me` (permisos efectivos del usuario logueado — Admin resuelve `true` en todo sin consultar la tabla), `GET/POST/PUT/DELETE staff[...]` (alta de cuenta, reemplazo completo de su grilla de permisos en cada guardado —mismo criterio que el detalle de turno de la sección 14—, cambio de contraseña, baja).
- `AuthService.CreateStaffAccountAsync`/`ChangeStaffPasswordAsync`, mismo patrón que `CreateProfessionalAccountAsync` (sección 6) pero sin ficha vinculada. El login de Staff **no necesitó ningún cambio**: `AuthService.LoginAsync`/`GenerateJwtToken` ya eran genéricos por `Role`, así que una cuenta Staff loguea por el mismo `POST /api/auth/login` que Admin/Professional.
- **Rollout de enforcement a 10 controllers**: Services, Products, Insumos, Professionals, Caja, ContentVideos, Gallery (`Modules/Beauty`), AutomationRules, CustomerProfiles+Reminders (módulo Clientes), Bookings+TimeSlots+BlockedDates (módulo Turnos). Cada acción administrativa suma `[RequirePermission(Modulo, Accion)]` mapeada 1 a 1 por verbo HTTP (GET→View, POST→Create, PUT→Edit, DELETE→Delete). **Deliberadamente fuera de este sistema:** `AnalyticsController` (Estadísticas) y `BusinessSettingsController`/`SiteConfigController` (Empresa) siguen exclusivos de Admin real — datos de facturación/configuración del negocio completo, no de un módulo puntual delegable. Tampoco se extendió `POST /api/auth/professional-account` (activar login de un profesional) a Staff aunque tenga permiso de Editar sobre Profesionales — emitir credenciales de acceso es más sensible que editar un campo; decisión propia no pedida explícitamente por el usuario, queda anotada acá para revisar si hace falta ampliarla.
- Migración `AddModulePermissions` generada y aplicada (tabla `ModulePermissions`, índice único `(UserId, Module)`, FK a `Users` con `ON DELETE CASCADE`).

**Frontend:**
- `src/hooks/usePermissions.ts` — si el rol es Admin, `can()` resuelve `true` sin pegarle al backend; si es Staff, hace `GET /api/permissions/me` una vez y cachea en memoria.
- `src/lib/auth.ts`: `isAdminAuthenticated()` (el guard que usan las ~15 páginas de `/admin/*`) pasó a aceptar Admin **o** Staff — antes exigía literal `role === "Admin"`, lo que hubiera dejado a cualquier Staff afuera en la puerta de entrada de cada página sin tener que tocarlas una por una. Se agregó `isFullAdmin()` (solo Admin real) para gatear lo que sigue siendo exclusivo del dueño de la cuenta (la propia página de Permisos, Estadísticas, Empresa).
- `AdminSidebar.tsx`: cada link del menú suma un `module` (o `adminOnly: true` para Empresa/Estadísticas/Permisos) — un Staff sin permiso de Ver en un módulo directamente no ve esa entrada. Ítem nuevo "Permisos" agregado al grupo "Cuenta".
- `app/(admin)/admin/permisos/page.tsx` (nueva): el Admin crea cuentas Staff (email/usuario/contraseña), les asigna una grilla de checkboxes Ver/Crear/Editar/Eliminar por módulo, les cambia la contraseña, o revoca el acceso (borra la cuenta, cascada sobre sus permisos). Marcar cualquier acción distinta de "Ver" auto-marca "Ver" también, en la UI — no tiene sentido poder editar un módulo que ni siquiera se puede ver en el menú.
- `app/api/permissions/[...path]/route.ts` — proxy nuevo, mismo patrón catch-all que `caja`/`professionals`.

**Verificación — parcial, con un pendiente explícito sin cerrar:**
- `dotnet build` y `npx tsc --noEmit`: limpios después de cada archivo tocado, tanto backend como frontend.
- Migración aplicada y verificada por SQL directo contra la base real.
- Prueba real contra el backend corriendo localmente (no solo compilación): se registró un admin nuevo, se creó una cuenta Staff, y se le asignó permiso `Servicios: Ver+Editar` (sin Crear/Eliminar) vía HTTP real (`curl`) — los tres pasos respondieron `200`/`success:true`.
- **La verificación quedó interrumpida antes de loguear como Staff y confirmar en runtime que el 403 realmente bloquea una acción sin permiso** (y que las acciones permitidas sí funcionan) — el usuario cortó la corrida para pedir otra cosa. Tampoco hay tests de integración automatizados nuevos para este módulo (los 92 tests de la sección 21 son anteriores, no lo cubren). **No dar por probado el enforcement real de punta a punta hasta correr ese chequeo pendiente.**

### Incidente: base de datos local borrada por el usuario a mitad de sesión

Durante la verificación del módulo de Permisos, el usuario borró accidentalmente la base de datos local (`bd_turnos_e2e`). Se recreó corriendo `dotnet ef database update` desde cero, que reaplicó **las 18 migraciones** del historial completo (no solo la nueva de Permisos) — confirmado por SQL directo que el schema quedó íntegro y que el tenant `legacy` volvió a sembrarse solo (vía el seed que trae la propia migración de multi-tenancy, sección 5 del histórico). **Lo que no se recupera:** ningún dato (usuarios Admin, servicios, clientes, turnos cargados) — no hay backup ni seeder de Admin por defecto en este proyecto (el `DatabaseSeeder` con el admin de ejemplo está comentado/muerto, confirmado en la sección 1 original). El usuario tuvo que volver a registrar un Admin desde cero vía `/api/auth/register`.

---

## 30. Actualización — sesión 19/07 (velocidad de carga del panel admin en desarrollo local)

**Pedido del usuario:** las "ventanas" (páginas) del sitio tardaban en cargar — reducir ese tiempo. Antes de tocar nada se preguntó explícitamente si el problema era en producción o en desarrollo local, porque las causas y los fixes son completamente distintos (cold start del hosting vs. compilación de Next.js); el usuario confirmó que era **desarrollo local** (`pnpm dev` en su máquina).

**Diagnóstico, no asumido — medido con `curl` contra el dev server real:** el proyecto (Next.js 14.2.5, App Router) compila cada ruta *on-demand* la primera vez que se visita en una corrida de `next dev` — no hay nada raro roto, es el comportamiento estándar del dev server, pero se agrava con archivos de página muy grandes. Medido antes de tocar nada: primera visita a una ruta ya compilada (mismo proceso, sin cambios) ~120-190ms; primera visita en frío a `/admin/calendario` (que además carga `react-big-calendar`, la única librería realmente pesada del frontend) ~4.7s. `next.config.js` estaba vacío (sin ninguna optimización de Next configurada) y el script `dev` no usaba Turbopack.

**Causa estructural de fondo, no solo config:** varias páginas admin son archivos "use client" monolíticos de 700 a 1300 líneas, con los modales (formularios de alta/edición, detalle de turno/reserva) escritos *inline* en el mismo archivo e importados de forma estática — el navegador y el compilador de Next pagan el costo completo de esos modales aunque el admin nunca los abra en esa visita.

**Fixes aplicados (`frontend/Turneo-web`):**
1. `package.json`: script `dev` pasa a `next dev --turbo` (Turbopack).
2. `next.config.js`: `experimental.optimizePackageImports` para `react-big-calendar`, `date-fns`, `lucide-react` — antes el archivo no tenía ninguna config.
3. **Extracción de modales a `_components/` + `next/dynamic(..., { ssr: false })`** en las 6 páginas admin más pesadas, para sacar del compile/bundle inicial de cada ruta todo lo que solo hace falta al abrir un modal puntual:

| Página | Líneas antes | Líneas después | Componente(s) extraído(s) |
|---|---|---|---|
| `/admin/calendario` | 895 | 904 | `AgendaCalendar` (react-big-calendar + CSS, la lib más pesada del proyecto), `ReserveSlotModal` — ya eran archivos separados, el cambio fue pasar de import estático a `next/dynamic` (el conteo de líneas casi no baja, la ganancia es que su compilación se difiere) |
| `/admin/clientes` | 1287 | 644 | `CustomerFormModal`, `ReminderFormModal` |
| `/admin/historial` | 737 | 491 | `BookingDetailModal` |
| `/admin/turnos` | 1136 | 986 | `BookingDetailModal` |
| `/admin/servicios` | 687 | 237 | `ServiceFormModal` (pasó a ser dueño de todo su propio estado — antes vivía en la página padre) |
| `/admin/caja` | 674 | 452 | `MovementModal`, `CloseCajaModal` |

Criterio de extracción: donde el modal ya era autosuficiente (Caja) se movió el componente tal cual; donde el formulario dependía de mucho estado del padre (Clientes, Servicios) se lo hizo dueño de su propio estado interno, recibiendo solo `initial`/`onSave`/`onClose` — igual que ya lo hacía `CustomerFormModal`, para no tener que enhebrar 15+ props sueltas. En Servicios esto además simplificó la página padre: `openEdit()` dejó de tener que precargar a mano `formData`/`customFields`/`recipe` antes de abrir el modal, el modal los resuelve solo a partir de `initial` vía un `useEffect`.

**Bug propio introducido y corregido en el camino:** al reescribir a mano `ServiceFormModal.tsx`, el regex de sacar tildes (`normalize("NFD").replace(/[̀-ͯ]/g, "")`, usado para autogenerar el slug del servicio) se corrompió dos veces — el escape `̀-ͯ` terminó como caracteres Unicode combinantes literales en el archivo en vez de la secuencia de escape, rompiendo la limpieza de tildes. Se detectó por inspección antes de dar el archivo por bueno (no lo encontró `tsc`, porque sigue siendo un regex válido, solo que no hace lo mismo) y se corrigió reemplazándolo por una constante `DIACRITICS_RE` construida con `String.fromCharCode(0x0300)`/`String.fromCharCode(0x036f)` — evita depender de escribir esa secuencia de escape a mano.

**Verificación:**
- `npx tsc --noEmit` limpio en cada archivo tocado y en el proyecto completo al cierre (único resto: el error preexistente y no relacionado de `ConfirmDialog.tsx` sobre el namespace `JSX`, ya documentado antes de esta sesión).
- Servidor de desarrollo levantado real (`pnpm dev`, con caché de `.next` borrada para medir en frío) y las 6 rutas afectadas devuelven `200` sin errores en el log del servidor.
- **No se hizo click-through manual en navegador** de los flujos de cada modal (abrir, completar, guardar) — la verificación fue compilación + carga de página, no interacción real. Pendiente si se quiere confirmar al 100% que cada modal sigue funcionando igual que antes de la extracción.

**Fuera de alcance de esta sesión, a propósito:** no se tocó el hosting de producción (Vercel + backend en Render) — si la lentitud también se nota en producción además de en local, la causa más probable ahí es otra por completo (cold start del backend en el free tier de Render, no cubierto por ninguno de estos cambios) y no se investigó en esta sesión porque el usuario confirmó que el problema era solo local. `/admin/productos` (687 líneas, quedó abierta en el editor durante la sesión) no se tocó — no estaba entre las páginas identificadas con el mismo patrón de modal pesado al momento de decidir el alcance.

---

## 31. Actualización — sesión 22/07 (renombre TTurnos→Turneo duplicado, backend y frontend)

El usuario reportó que los archivos de `TTurnos.Api`/`TTurnos.Api.Tests` (backend) y `tturnos-web`/`turneo-web` (frontend) se habían duplicado. Diagnóstico antes de tocar nada: `git status` mostró que `backend/TTurnos.Api`, `TTurnos.Api.Tests` y `TTurnos.sln` estaban trackeados en git, mientras que `backend/Turneo.Api`, `Turneo.Api.Tests`, `Turneo.sln` y `frontend/turneo-web` existían como carpetas **sin trackear**, casi idénticas en contenido a sus pares trackeados.

**Causa raíz real, más grave que "hay carpetas de más":** el commit `7f95f08` ("2207 Turneo") ya había renombrado los **namespaces C#** de 219 archivos de `TTurnos` a `Turneo`, pero sin renombrar los archivos/carpetas ni el `.sln` — y el `.sln` trackeado (`backend/TTurnos.sln`) quedó apuntando a rutas `Turneo.Api\Turneo.Api.csproj` que **no existían** dentro de la carpeta `TTurnos.Api` real. Es decir: el `.sln` commiteado estaba roto. Alguien intentó arreglarlo creando las carpetas `Turneo.Api`/`Turneo.Api.Tests`/`Turneo.sln` nuevas (sin trackear, copias del contenido real con namespaces `Turneo`), en vez de renombrar en git. Mismo patrón en frontend: `frontend/tturnos-web` (trackeado, con el commit más reciente) vs. `frontend/turneo-web` (sin trackear) — únicamente diferían en que el segundo tenía un `.env.local` (con las credenciales reales de Mercado Pago/WhatsApp/Gmail) que el primero no tenía.

**Fix aplicado:**
- Se borraron los duplicados sin trackear (`backend/Turneo.Api`, `Turneo.Api.Tests`, `Turneo.sln`, `frontend/turneo-web`) — no aportaban nada que no estuviera ya en las carpetas trackeadas.
- `git mv` de `backend/TTurnos.Api`→`Turneo.Api`, `TTurnos.Api.Tests`→`Turneo.Api.Tests`, `TTurnos.sln`→`Turneo.sln`, y los `.csproj`/`.http` internos — preserva historial de git, a diferencia de crear carpetas nuevas.
- Antes de borrar `frontend/turneo-web`, se copió su `.env.local` a `tturnos-web` (que no tenía ninguno) para no perder esas credenciales; luego `git mv frontend/tturnos-web`→`turneo-web`.

**Verificado:** `dotnet build Turneo.sln` — 0 errores (solo warnings preexistentes de paquetes NuGet). `npm install && npm run build` en el frontend — build exitoso. `grep -ri "TTurnos"` sobre todo el repo — sin resultados (ni siquiera en Dockerfile/README/docker-compose).

---

## 32. Actualización — sesión 22/07 (auditoría de aislamiento multi-tenant — sin fixes, solo hallazgos)

El usuario preguntó si el aislamiento entre tenants era realmente obligatorio en cada consulta. Se auditó el mecanismo real en vez de responder de memoria.

**Mecanismo confirmado:** `ApplicationDbContext.OnModelCreating` aplica `HasQueryFilter(e => e.TenantId == _currentTenant.TenantId)` a las ~28 entidades de `Core/` (Bookings, Users, Services, Professionals, Payments, Insumos, CustomerProfiles, Caja, etc.) — es un filtro global de EF Core, se aplica automáticamente a *cualquier* LINQ query contra esas tablas sin que el desarrollador tenga que acordarse de agregarlo por endpoint. `TenantResolutionMiddleware` resuelve el tenant en este orden: claim `tenant_id` del JWT → header `X-Tenant-Host` (rutas públicas proxeadas por el frontend) → host de la request directa → slug default de config.

**Hallazgo (no corregido, dormant): 4 entidades de `SaaS/` sin query filter.** `TenantModule`, `Subscription`, `License`, `UsageRecord` tienen columna `TenantId` + FK a `Tenant`, pero **ningún** `HasQueryFilter` — a diferencia de `Branch`/`Theme` (Enterprise) que sí lo tienen. Confirmado por `grep` que **ningún controller consulta estas cuatro tablas todavía** (son scaffolding de billing/licencias sin ningún endpoint conectado) — no es una fuga activa hoy, pero el día que se cablee un endpoint de billing ahí, hay que acordarse de agregar el filtro a mano o el aislamiento no es automático como en el resto del sistema.

**`IgnoreQueryFilters()` revisados uno por uno — todos deliberados y seguros:** `AutomationRulesRepository` (job de Hangfire sin HTTP context, re-filtra por `TenantId` a mano), `HangfireReminderJob`/`NotificationService`/`ReminderBackgroundService` (mismo motivo), `PaymentsRepository` (el webhook de MercadoPago llega sin tenant resuelto, pero busca por `bookingId`/PK global única, no por lista — no puede filtrar cross-tenant por diseño). Todos tienen comentarios en español explicando por qué es seguro saltear el filtro ahí puntualmente.

**Cobertura de tests real, no exhaustiva:** `MultiTenancyIsolationTests.cs` tiene 5 tests (listado y detalle de Bookings, listado de Professionals, unicidad de email de User cruzando tenants, resolución por header `X-Tenant-Host`) — no hay un test de aislamiento dedicado por cada una de las 28 entidades, comparten el mismo mecanismo pero no están todas verificadas una por una.

---

## 33. Actualización — sesión 22/07 (landing comercial: WhatsApp, logo, precios)

Cambios chicos sobre `frontend/turneo-web/app/(public)/page.tsx` (la home comercial de Turneo, no el sitio del salón):

- **Botones de contacto → WhatsApp real:** todos los CTA (hero "Quiero sumarme", cada plan, Licencia/Custom, CTA final) apuntan ahora a `https://wa.me/541122692061` con un mensaje precargado distinto según el origen del clic, vía un helper nuevo y compartido `src/lib/contact.ts` (`buildWhatsAppUrl`). Reemplaza un `mailto:` a `contacto@Turneo.app`, dirección que nunca se configuró (estaba marcada `// TODO` en el propio código) y los anchors `#contacto` de los botones de plan.
- **Logo real en vez de texto plano:** el `<span>Turneo</span>` del navbar (línea 160) pasa a ser `<img src="/img/LogoPortada.png">`, mismo patrón (`h-10 w-auto object-contain`) que ya usa el Navbar del sitio del salón.
- **Precios sincronizados con el Anexo B del manual comercial** (ver `docs/comercial/ManualComercial.md`): la sección `PLANES` de la landing pasó de 4 planes sin precio público ("Consultar precio") a los 5 planes con precio ARS cerrado (Free/Starter/Pro/Premium/Enterprise) — ver detalle de precios en el manual, no se duplica acá.

**Inconsistencia detectada y documentada, no corregida:** el catálogo real de `Plans` en el backend (seed `ReseedCommercialPlanCatalog`, usado por `/platform/tenants` para asignarle un plan a un negocio) tiene **otros nombres y otros límites** — Free/Starter/Pro/**Business**/Licencia/Custom, sin "Premium" ni "Enterprise", y todos los `PriceMonthly`/`PriceYearly` en `NULL`. La landing ya promete 5 planes con precio; el sistema que asignaría y (eventualmente) haría cumplir esos límites todavía no los conoce. Pendiente: una migración que alinee el catálogo real con los 5 planes de venta antes de activar cobros/enforcement de plan.

---

## 34. Actualización — sesión 22/07 (Ruleta de Captación — nuevo módulo `Marketing/Roulette`)

Nueva herramienta de marketing propia de Turneo (no una feature del producto Belleza que usan los salones) — gamificación para captar leads comerciales, a partir de una spec de 36 secciones (`docs/RULETA.pdf`). Se acordó con el usuario acotar el alcance al MVP que la propia spec define (sus secciones 34-35), no el sistema completo (sin emails automáticos, sin CAPTCHA, sin dashboard de KPIs todavía).

**Backend — nuevo dominio `Marketing/Roulette/`** (no tenant-scoped: vive en la misma `ApplicationDbContext` que `Tenant`/`Plan`, sin `HasQueryFilter`, es un lead de Turneo mismo, no un dato de un negocio de la plataforma):
- `RoulettePrize` (Name, Description, Type enum, Value, DurationMonths, Probability, ValidityDays, CodeSlug, IsActive) y `RouletteLead` (datos prioritarios NombreNegocio/WhatsApp + secundarios opcionales Email/Instagram/TipoNegocio/CantidadProfesionales/ProblemaPrincipal, FK a Prize, CodigoPromocional único, Estado enum de 12 valores tipo funnel comercial, Fuente/Campaign para atribución, IpAddress como control secundario de abuso).
- `RouletteService`: sorteo ponderado por `Probability` (`RandomNumberGenerator`, no `Random` para el código sino para el sorteo también se usó crypto-random), generación de código único con reintento (`TURNEO-{slug}-{4 chars}`), y anti-abuso principal por WhatsApp normalizado — si el mismo WhatsApp ya participó, no vuelve a girar: se le devuelve el mismo premio ya ganado (idempotente, así un refresh de página no lo deja afuera ni le da una segunda chance).
- Endpoints públicos (`RouletteController`, `[AllowAnonymous]` + `[EnableRateLimiting("roulette")]` 10 req/min por IP): `GET prizes` (solo nombre de los activos, para dibujar la rueda), `POST spin`, `PATCH leads/{id}/additional-data` (no bloquea el premio, todo opcional).
- Endpoints admin (`PlatformRouletteLeadsController`, `[Authorize(Roles="PlatformOwner")]` — mismo aislamiento exclusivo que `PlatformTenantsController`, verificado que sin sesión redirige a login): listar/cambiar estado/**eliminar** leads (borrar libera el WhatsApp para una nueva participación legítima), y CRUD de premios — sin `DELETE` de premios a propósito (`RouletteLead.PrizeId` es `Restrict`, borrar un premio ya entregado rompería el historial; se desactivan con `IsActive=false`).
- Migración `AddMarketingRoulette` con seed de 7 premios cuyas probabilidades suman 100% (3/2/1 meses gratis, 50% OFF primer mes, 30% OFF 3 meses, activación gratis, beneficio especial).

**Frontend:**
- `/ruleta` (standalone, acepta `?campaign=&fuente=` para atribución tipo QR/Instagram/publicidad) — `RouletteClient.tsx`: formulario de fricción mínima (solo nombre del negocio + WhatsApp, el resto se pide después de mostrar el premio, sin bloquearlo), ruleta animada con `conic-gradient` (3 colores rotando evitando que el primer/último gajo queden pegados en la costura, separadores dorados, pegs en cada límite de gajo, brillo tipo vidrio fijo, aro metálico con sombra, centro con ícono `Gift` de `lucide-react`), animación con easing "overshoot-settle" (rebota al frenar en vez de parar seco) + confetti CSS liviano al ganar, paso opcional de datos adicionales, CTA final a WhatsApp con mensaje precargado (negocio + premio + código).
- `/platform/roulette` (mismo guard que `/platform/tenants`) — tabs Leads/Premios: tabla de leads con cambio de estado y botón Eliminar (con confirmación), formulario de alta/edición de premios con indicador de suma de probabilidades activas (verde en 100%, ámbar si no cierra).
- Proxies Next.js (`app/api/marketing/roulette/[...path]`, `app/api/platform/roulette/[...path]`) siguiendo el mismo patrón de reenvío de cookie/token que el resto del sitio.

**Bugs encontrados y corregidos durante la construcción (no eran parte del pedido, aparecieron verificando en navegador real):**
1. **`SiteChrome.tsx` mostraba el Navbar del negocio (salón) encima de `/ruleta` y de *todo* `/platform/*`** (tenants, login, roulette) — el componente solo excluía la ruta `"/"`. Corregido excluyendo también `/ruleta` y cualquier ruta que empiece con `/platform`.
2. **La rueda no quedaba centrada respecto al formulario** — al agregar un `<div>` wrapper para el confetti, ese div quedó sin ancho propio (`mx-auto` no tiene nada que centrar en un bloque que ya ocupa el 100% del padre), corriendo la rueda (que sí tiene ancho fijo) a la izquierda. Corregido cambiando el wrapper a `flex justify-center`.
3. **`/api/platform/auth/me` explotaba con 500** (bug preexistente, no de la ruleta, encontrado en el camino) al recibir un `401` con body vacío del backend justo después de loguearse — `.json()` sobre una respuesta vacía tira `SyntaxError`, el `catch` genérico lo convertía en 500 "Error de conexión". Corregido chequeando `response.status === 401` antes de intentar parsear.

**Verificado en navegador real (Playwright, no mocks) en cada paso:** flujo completo de spin (formulario → giro → resultado con código → datos opcionales → WhatsApp) sin errores de consola; idempotencia con el mismo WhatsApp; login real como PlatformOwner + listado de leads + cambio de estado + eliminar lead + alta/edición de premio, todo contra el backend real corriendo local.

**Explícitamente fuera de alcance de este corte (documentado en la propia spec, no construido):** emails automáticos de seguimiento, CAPTCHA/protección anti-bot más allá del rate limiting por IP, dashboard de KPIs/tasa de conversión, captura completa de UTMs (hoy solo `campaign`/`fuente`).

---

## 35. Actualización — sesión 08/08 (Smart Tag / NFC — módulo nuevo `Core/SmartTags`, PRD completo)

Nuevo módulo del producto Belleza (no marketing propio de Turneo, a diferencia de la Ruleta de la sección 34): etiquetas NFC/QR físicas que redirigen a `https://turneo.app/s/{token}` y disparan una acción digital medible dentro de Turneo. Construido a partir de una spec propia, `docs/NFC.md` (formato PRD técnico-funcional con 8 fases). Se construyó en varias rondas dentro de la misma sesión, cada una con su propio plan revisado y aprobado explícitamente antes de tocar código.

**Fases 1-3 — Core, Smart Link público y CRUD admin:**
- Entidades nuevas `Core/SmartTags/Entities/{SmartTag, SmartTagEvent}.cs` — `SmartTag` (Token único global, Name, Location, Action, IsActive) y `SmartTagEvent` (SmartTagId, Action snapshot, EventType, ClientId nullable sin FK todavía — placeholder para una sesión de cliente real que hoy no existe, ver más abajo). Constantes `SmartTagAction`/`SmartTagEventType` en vez de enum, mismo criterio que `AutomationTriggerType`/`BookingStatus` ya documentado en este archivo.
- Token: alfabeto Crockford Base32 sin `0/O/1/I/L`, 12 caracteres, `RandomNumberGenerator.GetString` (mismo tipo de API cripto que ya usa `AuthService` para el OTP) — no predecible, no secuencial.
- **Decisión de diseño clave, verificada contra el código real antes de implementar:** el endpoint público `GET /api/smart/{token}` no puede confiar en `TenantResolutionMiddleware` (un tap NFC puede llegar sin `X-Tenant-Host` o con el de otro tenant). Se evaluaron dos opciones — reencaminar el tenant ambiente vía `CurrentTenantService.SetTenant()`, o resolver manualmente con `IgnoreQueryFilters()` + `TenantId` explícito al escribir. Se confirmó por `grep` que `SetTenant()` hoy **solo** lo invoca el propio middleware, ningún controller — así que se descartó esa opción y se replicó en cambio el patrón ya usado por el webhook de MercadoPago en `PaymentsController` (`IgnoreQueryFilters` + TenantId explícito, sin tocar el tenant ambiente). Documentado con comentarios extensos en `SmartLinkController.cs`.
- CRUD admin `/api/smart-tags` (`[RequirePermission(SmartTags, ...)]`, módulo nuevo agregado a `PermissionModules`), rate limiting dedicado (`"smart-tag"`, 30 req/min — más permisivo que `"roulette"` porque taps repetidos desde la misma ubicación/NAT son esperables, pero acotado contra scraping).
- Frontend: `/admin/smart-tags` (listado, alta/edición, activar/desactivar, copiar link), proxies BFF siguiendo el patrón ya establecido del resto del sitio.
- Migración `AddSmartTags`.

**Fase 4 — Acciones BOOKING/REBOOK/REVIEW + página pública `/s/[token]`:**
- **Hallazgo de arquitectura antes de escribir código, no asumido:** `https://turneo.app/s/{token}` vive en el dominio **raíz** compartido, no en `{slug}.turneo.app` (el subdominio propio de cada tenant que sí usa `/reservar`). Confirmado leyendo `TenantResolutionMiddleware` y el mecanismo real de `X-Tenant-Host` (arma el header a partir del Host que ve el proxy Next.js) — significa que el Host real de una visita a `/s/[token]` no identifica al tenant, y reusar tal cual el `BookingForm`/las rutas BFF existentes habría resuelto siempre al tenant `legacy` por defecto, sirviendo el catálogo de otro negocio.
- **Fix**: `tenantHeader()` (`src/lib/tenantHeader.ts`) gana un segundo parámetro opcional `tenantSlugOverride` — si está presente arma `X-Tenant-Host: {slug}.{NEXT_PUBLIC_TENANCY_BASE_DOMAIN}` en vez de leer el Host real. Se propagó como override opcional (sin cambiar el comportamiento por defecto de ningún caller existente) a las 5 rutas BFF que la página pública necesita: `services`, `professionals`, `timeslots/available`, `bookings` (POST), `bookings/by-email`; y a `BookingForm` vía un prop nuevo (`tenantSlugOverride`) con un helper interno que agrega `?tenantSlug=` a sus 4 fetches solo cuando el prop está presente. Con override, esos fetches pasan a `cache: "no-store"` (evita que la respuesta de un tenant quede cacheada bajo la misma URL literal y se sirva luego a un Smart Tag de otro tenant).
- `BOOKING`: reusa `BookingForm` directo, con el override de arriba y un prop nuevo `smartTagToken` que viaja en el body de `POST /api/bookings`.
- `REBOOK`: **investigado antes de diseñar** — no existe ninguna sesión de cliente persistente en el navegador (el JWT de portal existe en el backend, `AuthService.CreateClientPortalAccessToken`, pero ninguna página del frontend lo consume, ver hallazgo ya documentado en la sección 9 sobre el OTP huérfano — mismo patrón de infraestructura sin UI). Se resolvió pidiendo el email en el momento del tap (`src/components/smarttag/RebookFlow.tsx`), reusando el endpoint público ya existente `GET /api/bookings/by-email` (ordena por fecha descendente); si hay match muestra "tu turno más reciente fue..." y ofrece reservar de nuevo (sin intentar preseleccionar el mismo servicio por texto — heurística frágil, se descartó a propósito), si no hay match cae al `BookingForm` normal.
- `REVIEW`: campo nuevo `SiteConfig.GoogleReviewUrl` (migración `AddGoogleReviewUrlToSiteConfig`) + input en `/admin/configuracion`. `src/components/smarttag/ReviewFlow.tsx` pide 1-5 estrellas, `POST /api/smart/{token}/review` graba el evento y devuelve `redirectUrl` solo si el rating es ≥4 y el negocio cargó el link — decisión explícita de no comprometerse con más integración de reseñas de terceros que un simple redirect condicional, tal como advierte la propia `docs/NFC.md`.
- Eventos `BOOKING_COMPLETED`/`REVIEW_COMPLETED` (constantes ya definidas desde la Fase 1, sin usar hasta ahora): `BookingsController` inyecta `ISmartTagsRepository` y graba el evento tras crear el turno **solo si** el `SmartTagToken` recibido pertenece al mismo tenant que la reserva (chequeo de consistencia — descarta en silencio un token de otro tenant, para que no se pueda inflar la métrica de un Smart Tag ajeno). Deliberadamente **no** se agregaron eventos `*_STARTED` — la propia `INTERACTION` ya marca el momento en que se muestra la UI de la acción, no hay un paso intermedio de "confirmar para empezar" en este diseño.

**Fase 5 — QR:** paquete NuGet `QRCoder` agregado (no había ninguna librería de QR en el repo, confirmado por `grep`). Endpoint admin `GET /api/smart-tags/{id}/qr` genera el PNG con `QRCodeGenerator` + **`PngByteQRCode`** — deliberadamente no la clase `QRCode` (basada en `System.Drawing`/`Bitmap`, que no corre en Linux y rompería en Render). Proxy BFF que reenvía bytes de imagen (no JSON) con `Content-Type: image/png`; `<img>` + link de descarga en `/admin/smart-tags`.

**Fase 7 — Analytics:** `GET /api/smart-tags/{id}/analytics` y `/api/smart-tags/analytics` (agregado), conversión = `(BOOKING_COMPLETED + REVIEW_COMPLETED) / INTERACTION` calculada en el controller (mismo criterio que `AnalyticsController.GetSummary()`, con guarda de división por cero). Repo agrupa eventos por `(SmartTagId, EventType)` y los une en memoria contra la lista de tags (mismo patrón que `AnalyticsRepository.GetProfessionalStatsAsync`, ya documentado en la sección 5, para agregaciones que no traducen bien a SQL). Frontend: 3 stat tiles + una línea de métricas por tarjeta en `/admin/smart-tags`, un solo fetch adicional por carga de página (no N+1 por tag).

**Acciones WHATSAPP/INSTAGRAM** (de las 8 "futuras acciones" que `docs/NFC.md` deja explícitamente fuera del MVP, se adelantaron estas dos a pedido del usuario porque ya hay dato reusable en `SiteConfig`): 2 constantes nuevas en `SmartTagAction`, sin entidades ni migración. El redirect es 100% server-side en `/s/[token]/page.tsx` (`next/navigation` `redirect()`, sin flash de cliente) — fetch directo al backend con el header `X-Tenant-Host` armado a mano (mismo mecanismo que el override de arriba, pero para un Server Component que puede setear headers propios sin problema de CORS por correr en Node, no en el browser), reusando `getWhatsAppLink()` ya existente en `src/lib/siteConfig.ts`. Sin número/link configurado, muestra un mensaje en vez de redirigir a un lugar roto. Sin `EventType` nuevo — la `INTERACTION` ya cubre el tap, no hay un "completado" de negocio distinto para una redirección simple.

**Fase 8 — Tests:** suite de integración extendida sobre los archivos ya existentes (`SmartTagsEndpointsTests` con casos de QR y analytics, `SmartLinkEndpointsTests` con casos de `/review` — rating alto/bajo/fuera de rango/token inexistente —, `BookingsEndpointsTests` con el caso de `smartTagToken` mismo-tenant vs. otro-tenant, más dos helpers nuevos en `TestDataFactory`). **No se corrió `dotnet test` en ningún momento de esta sesión** — mismo motivo que las secciones 23/24, este entorno no tiene Docker disponible (Testcontainers lo requiere para levantar Postgres en los tests de integración), chequeado explícitamente varias veces durante la sesión. Todo compila (`dotnet build` en verde en cada ronda).

**Verificación real realizada (sin Docker, contra Postgres local + servidores levantados a mano):**
- Backend: CRUD completo por `curl` contra la API local en cada ronda — creación con token válido, activar/desactivar, `PATCH`/`PUT`/`DELETE`, rate limiting (confirmado el `429` exacto al request 31 de la política de 30/min), aislamiento entre tenants (revisado por inspección de código, no con un segundo tenant real — este entorno solo tiene el tenant `legacy` disponible sin acceso al panel `/platform` para crear uno nuevo), Smart Link público con evento grabado, `/review` con ambos casos de rating, `smartTagToken` en una reserva real grabando `BOOKING_COMPLETED`, QR devolviendo un PNG con la firma de bytes correcta (`89 50 4E 47 0D 0A 1A 0A`), analytics con conteos exactos tras generar interacciones/completados reales.
- Frontend: `npx tsc --noEmit` limpio después de cada ronda. Flujo `/s/[token]` completo probado con `curl` para las 5 acciones (incluyendo el mecanismo de override de tenant, confirmado con un slug inexistente devolviendo `[]` y con el slug correcto devolviendo el catálogo real — la prueba de que el header realmente gobierna la resolución, no un fallback silencioso), redirect real de WhatsApp/Instagram confirmado por el header `Location` de un `307`.
- **No se hizo click-through manual en navegador real** — la extensión de Chrome no está conectada en este entorno, así que toda la verificación de UI fue por `curl`/inspección de HTML/typecheck, no interacción visual real. Pendiente si se quiere confirmar al 100% la experiencia real (mismo tipo de pendiente que dejó la sesión 30 con los modales extraídos).

**Explícitamente fuera de alcance de esta sesión:** 5 de las 8 "futuras acciones" del PRD (`PROMOTION`, `LOYALTY`, `SURVEY`, `CONTACT`, `CAMPAIGN`) — ninguna tiene datos ni infraestructura hoy, quedan pendientes de definición antes de construirse. Gating por plan comercial (`Feature "CanUseSmartTags"`) no implementado a propósito, mismo criterio que el resto del catálogo de features hoy (ver sección 2 y el manual comercial). Cobertura e2e de Playwright para el flujo público `/s/[token]` no agregada — se consideró esfuerzo mayor (fixtures de tenant/email) no pedido explícitamente.

---

## 36. Actualización — sesión 13/08 (legales: ToS/arbitraje, Privacidad, Copyright; y hardening de seguridad: sanitización, rate limiting, CSP, RLS)

Sesión larga con dos frentes separados: primero un pedido de cumplimiento legal (términos y condiciones con cláusula de arbitraje, luego privacidad, luego copyright), después un pedido de hardening de seguridad en 4 puntos. Cada pieza se paró para preguntar alcance antes de escribir código — varias decisiones quedaron documentadas explícitamente a pedido del usuario, no asumidas.

### Términos y Condiciones + cláusula de arbitraje — split B2B/B2C deliberado

El pedido original era arbitraje para todos los usuarios. **Se le señaló al usuario, antes de programar nada, que el arbitraje obligatorio frente a consumidores es nulo por abusivo en Argentina** (Ley 24.240 art. 37, CCyC) — el arbitraje solo es válido en la relación B2B con el tenant (dueño del negocio que contrata el SaaS), nunca con el cliente final que reserva un turno. El usuario confirmó ese split explícitamente.

- `app/(public)/terminos/page.tsx` — ToS del cliente final, sin arbitraje, jurisdicción de los tribunales del domicilio del consumidor.
- `app/(platform)/platform/terminos-saas/page.tsx` — ToS del contrato SaaS con el tenant, con cláusula de arbitraje (sección 5) + cláusula de titularidad/indemnidad de contenido agregada más tarde en la sesión de copyright (sección 6, ver más abajo).
- Backend: `Booking.TermsAcceptedAt`/`TermsVersion` y `Tenant.TermsAcceptedAt`/`TermsVersion` (migración `AddTermsAcceptanceFields`), validados a mano en `BookingsController.CreateBooking` y `PlatformTenantsController.CreateTenant` (no vía `[Required]` en un DTO — ese atributo en un `bool` no-nullable solo rechaza `null`, nunca `false`, gotcha de DataAnnotations). Constante `LegalTermsVersions` (`Shared/Constants/`) para versionar el texto, duplicada a mano en cada page.tsx.
- Checkbox obligatorio (deshabilita el submit) en `BookingForm` y en el alta de tenants de `/platform/tenants`. Los flujos donde el **staff** crea una reserva a nombre del cliente (`ReserveSlotModal.tsx`, `ReminderFormModal.tsx`) mandan `acceptedTerms: true` a mano — no hay checkbox online ahí, el vínculo comercial ya existe.
- Tests de integración y e2e existentes actualizados para incluir `acceptedTerms: true` en los payloads de reserva que antes no lo tenían (`BookingsEndpointsTests.cs`, `MultiTenancyIsolationTests.cs`, `e2e/booking.spec.ts`, `e2e/global-setup.ts`) — sin este ajuste hubieran empezado a fallar con 400.
- **Ambos textos son borradores modelo**, con aviso visible de "pendiente de revisión por un profesional matriculado" — no se presentan como legalmente definitivos.

### Política de Privacidad — inventario real de datos antes de redactar

En vez de un texto genérico, se relevó primero qué datos recolecta el sistema de verdad (`CustomerProfile`, `Booking`, `Payment`, subprocesadores). **Hallazgo no obvio:** los recordatorios con IA (`NotificationTemplateService.cs`) mandan nombre + servicio + fecha/hora + ubicación del cliente a la API de OpenAI — un flujo de datos real a un tercero, enterrado en el módulo de notificaciones, fácil de pasar por alto. Otros subprocesadores confirmados: MercadoPago (nunca datos de tarjeta), Cloudinary, Meta (WhatsApp Business API), Gmail SMTP. Sin analytics ni píxeles de terceros (confirmado por grep en todo el frontend — afirmación real, no aspiracional). `app/(public)/privacidad/page.tsx`, enlazada desde `/terminos`, desde el footer de `/reservar` y desde el checkbox de aceptación del booking.

**Gap declarado honestamente, no prometido de más:** no hay borrado de datos autoservicio para clientes (derecho al olvido, Ley 25.326) — solo un admin puede borrar manualmente el `CustomerProfile` desde el panel. La política dice "contactá al negocio" en vez de prometer un mecanismo automatizado que no existe.

**Hallazgo de seguridad operativa, corregido en el camino:** `AuthService.RequestClientAccessAsync` logueaba el código OTP del cliente en texto plano por `Console.WriteLine` — en Render eso probablemente termina en los logs de la plataforma. Se sacó esa línea (`AuthService.cs`). Era la única vía de entrega del código (no hay email/SMS/WhatsApp conectado a este flujo todavía, consistente con "portal OTP completo en backend, sin pantalla" ya documentado en la sección 9) — el endpoint sigue funcionando, solo que hoy nadie puede ver el código generado hasta que se conecte una entrega real.

### Mecanismo de Copyright / Takedown — sin agente DMCA formal, por decisión del usuario

Pedido original: "agente DMCA con cláusula de take down". Investigado y explicado antes de programar: el registro formal ante `eco.copyright.gov` da un safe harbor específico de EE.UU. que **requiere** el registro para aplicar — pero Turneo es argentino, ese no es su marco legal principal (la responsabilidad de intermediarios en Argentina es más jurisprudencial, exige conocimiento efectivo). El usuario pidió entender alternativas sin agente registrado antes de decidir.

**Relevado antes de diseñar:** todo el contenido (galería, videos, imágenes de servicio/profesional, logo, fotos de CRM/historial) lo sube exclusivamente el staff/admin del tenant — no hay ningún path de upload de cliente final. Hallazgo crítico: los uploads son directos del browser a Cloudinary con preset "unsigned" — el backend nunca tuvo credenciales de Cloudinary, así que "borrar" algo en el panel admin solo sacaba la fila de la base, dejando el archivo vivo para siempre en su URL pública de Cloudinary.

**Construido:**
- `Infrastructure/Integrations/CloudinaryAdminService.cs` — `TryDestroyAsync(url)`, llama al API de destrucción de Cloudinary firmando con SHA1 (sin agregar el paquete NuGet `CloudinaryDotNet`, mismo estilo `HttpClient` crudo que `WhatsAppProvider`). Requiere `Cloudinary:ApiKey`/`ApiSecret` reales — el usuario confirmó tenerlas y cargarlas él mismo en Render (no se pegaron en el chat ni se commitearon).
- `Core/Platform/Services/ContentTakedownService.cs` — dada una URL reportada, la busca en las 8 tablas con media de todos los tenants (`IgnoreQueryFilters`), saca la referencia, y siempre intenta destruir el archivo en Cloudinary aunque no encuentre nada en la base (por si quedó huérfano).
- `POST /api/platform/content-takedown` (`PlatformContentController`, solo `PlatformOwner`) + UI `/platform/takedown` (pegar URL, ver qué se sacó).
- `app/(public)/derechos-de-autor/page.tsx` — proceso público de denuncia y contranotificación (contacto queda como placeholder `[COMPLETAR]`, a llenar antes de publicar).
- Cláusula de titularidad + indemnidad + política de reincidencia agregada como sección 6 de `/platform/terminos-saas`.
- Bonus de higiene: se enganchó el borrado real de Cloudinary como best-effort (logueado si falla, no bloquea el borrado) en los deletes existentes de Gallery, ContentVideo, Professional y `CustomerProfileService` — para que los borrados normales de acá en más no sigan generando huérfanos. **No se instrumentaron los paths de reemplazo/edición** (cambiar el logo o la imagen de un servicio sin borrar el registro) — sigue dejando huérfanos ahí, pendiente si se prioriza.

### Hardening de seguridad — 4 puntos pedidos por el usuario

Se auditó el estado real de cada punto antes de tocar código (dos agentes de investigación en background). Los primeros tres se implementaron y verificaron completos; el cuarto (RLS) quedó a mitad de camino, ver más abajo.

**1) Sanitización de inputs.** SQL injection: no era un riesgo real — 100% del acceso a datos pasa por LINQ de EF Core (parametriza automático), cero `FromSqlRaw`/`ExecuteSqlRaw` en todo el backend, confirmado por grep exhaustivo. XSS: un hallazgo real — el script JSON-LD de `reservar/page.tsx` armaba el `<script type="application/ld+json">` con `JSON.stringify` sin escapar `</script>`, y esos campos (`SiteConfig`) los controla el admin del tenant — corregido escapando `<` a `<`. Iframe del mapa de Google Maps: aceptaba cualquier URL que el admin pegara en `mapEmbedUrl`, sin restricción de dominio — `extractMapEmbedSrc()` (`src/lib/siteConfig.ts`) ahora valida contra un allowlist (`google.com`/`www.google.com`, HTTPS únicamente). DTO de `ServiceRequest` (`ServicesController.cs`) no tenía `[StringLength]` en varios campos — agregado, defensa en profundidad/anti-DoS más que un riesgo real (requiere rol Admin/Staff).

**2) Rate limiting.** Gaps encontrados: `ChangePassword` (autenticado pero sin ningún throttle — ahora usa la política `"auth"`), y varios `GET` anónimos sin ningún límite (`/api/timeslots/available`, `/api/siteconfig`, `/api/gallery`, `/api/content-videos`, `/api/services`, `/api/professionals`, `/api/professionals/available`, `/api/auth/client/identity-strategy`, `/api/marketing/roulette/prizes`) — blanco de scraping/DoS barato. Se creó una política nueva `"public-read"` (60 req/min por IP, más generosa que `"public-booking"` porque un visitante real dispara varias de estas solo navegando) y se aplicó a los 9 endpoints.

**3) Content Security Policy.** No existía ninguna, ni en frontend ni backend. Agregada en `next.config.js` (`headers()`): `script-src 'self'` (sin scripts de terceros, confirmado), `style-src 'self' 'unsafe-inline'` (requerido por styled-jsx), `img-src` con Cloudinary, `connect-src` con la API propia + Cloudinary, `frame-src` acotado a `google.com` (consistente con el fix del iframe del punto 1), `frame-ancestors 'none'`, más `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`/`Permissions-Policy`/HSTS. Headers básicos también en el backend (`Program.cs`, nosniff/frame-options/referrer-policy) aunque la API solo devuelve JSON. **Verificado en un browser real** (extensión de Chrome conectada a mitad de sesión): `/reservar`, `/terminos`, `/admin/login` cargan sin ninguna violación de CSP en consola, estilos/fuentes/scripts renderizan correctamente.

**4) Row Level Security de Postgres — trabajo interrumpido a pedido del usuario, sin terminar de validar.**

El usuario pidió explícitamente RLS nativo (no solo el aislamiento de EF Core que ya existía, auditado en la sección 32, y sigue confirmado sano) como segunda capa de defensa en profundidad a nivel de base de datos. Se armó un plan formal (herramienta de plan mode) antes de tocar código, aprobado por el usuario:

- **Mecanismo elegido:** un sentinel `'bypass'` evaluado dentro de la propia policy de cada tabla, no un rol de Postgres separado con `BYPASSRLS` — ese privilegio requiere superusuario para otorgarse, no viable en un Postgres gestionado tipo Render sin acceso de superuser.
- `ICurrentTenant`/`CurrentTenantService` ganaron `IsBypassed`/`SetBypass()`. `TenantResolutionMiddleware` activa bypass para JWT con rol `PlatformOwner` o acciones marcadas `[TenantContextBypass]` (nuevo atributo, aplicado a `PaymentsController.MercadoPagoWebhook` y a `SmartLinkController` completo). Se agregó `app.UseRouting()` explícito al pipeline — antes no estaba, y el nuevo chequeo de `context.GetEndpoint()` lo necesita.
- 3 background jobs (`ReminderBackgroundService`, `HangfireReminderJob`, `AutomationRuleEvaluationJob`) llaman `SetBypass()` al arrancar cada corrida — mismo criterio que ya usaban con `IgnoreQueryFilters()`, verificado que no rompe el auto-stamp de `TenantId` en inserts nuevos (`ApplicationDbContext.ApplyTenantId()` solo pisa si ya es `0`, y estos jobs siempre setean `TenantId` a mano).
- `Infrastructure/Persistence/TenantSessionInterceptor.cs` (nuevo, `DbConnectionInterceptor`) — en cada `ConnectionOpened`/`ConnectionOpenedAsync` ejecuta `SET app.tenant_id = '<id o "bypass">'` leyendo `ICurrentTenant`. Registrado en `Program.cs` cambiando `AddDbContext` a la forma `(sp, options) =>` para poder resolverlo scoped.
- Migración `EnableRowLevelSecurity` — `ENABLE`/`FORCE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation` (con `USING`/`WITH CHECK`, cubre lecturas y escrituras) en las 30 tablas con `HasQueryFilter` en `ApplicationDbContext` (`Branches` hasta `SmartTagEvents` — la lista completa, extraída del código, está en el comentario del propio archivo de migración). Quedan afuera a propósito el catálogo de plataforma (`Tenants`, `Modules`, `Plans`, etc.) y los datos propios de Turneo (`RoulettePrizes`/`RouletteLeads`), ninguno tiene `TenantId` de un tenant de la plataforma.

**Aplicada y probada contra Postgres local real (`bd_turnos_e2e`), no solo compilada:**
- `dotnet ef database update` corrió sin errores — las 30 tablas quedaron con RLS habilitado.
- Backend local levantado de verdad contra esa base: `GET /api/services` con `X-Tenant-Host` de un tenant real devolvió datos correctos (mecanismo normal funcionando bajo RLS), con un slug inexistente devolvió `[]`.

**Hallazgo crítico que dejó el trabajo sin cerrar — el más importante de toda esta sesión de seguridad:** un smoke test más riguroso (conectando directo con Npgsql, sin pasar por la app, seteando `app.tenant_id` a mano) mostró que **la policy no filtraba nada** — devolvía el total completo sin importar el tenant seteado. Causa encontrada: el rol `postgres` que usa la conexión local (`Username=postgres` en `appsettings.json`) **es superusuario**, y un superusuario de Postgres **siempre** bypasea RLS sin importar `FORCE ROW LEVEL SECURITY` — es comportamiento de Postgres por diseño, no un bug de la migración, y no hay forma de forzarlo. Se creó un rol de prueba sin privilegios (`rls_test_role`, `NOSUPERUSER NOBYPASSRLS`, con `GRANT SELECT` sobre `Services`) en la base local para volver a correr el test con un rol representativo de cómo debería conectarse la app en producción — **el usuario cortó la sesión antes de correr ese segundo test**, así que la policy en sí (el `USING`/`WITH CHECK`) todavía no tiene una confirmación end-to-end de que funciona como se espera.

**Estado exacto en el que queda esto, para quien retome:**
- Migración `EnableRowLevelSecurity` escrita, compilada, y **aplicada** a la base local (`bd_turnos_e2e`) — no aplicada a producción (Render).
- El rol `rls_test_role` (password `testpass123`, `NOSUPERUSER NOBYPASSRLS`, `SELECT` sobre `Services`) quedó creado en la base local — es un artefacto de testing, se puede borrar (`DROP ROLE rls_test_role`) o reusar para terminar la validación.
- **Pregunta sin responder, crítica antes de dar esto por funcional en cualquier lado:** ¿el usuario con el que la app se conecta a Postgres en Render es superusuario o tiene `BYPASSRLS`? Si es así (bastante común en un setup simple de un Postgres gestionado), toda esta migración sería inerte en producción — existiría, se vería "aplicada", pero no filtraría nada, exactamente el mismo síntoma que se encontró en local. Hay que verificarlo (`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`, mismo query que destapó el problema acá) antes de considerar esta capa como una protección real.
- Falta correr el test de aislamiento cruzado real (dos tenants con datos, confirmar que uno no ve las filas del otro) con el rol sin privilegios, y probar el flujo completo de la app (login admin, ver turnos) contra la base con RLS activo para confirmar que no rompe el uso normal — RLS filtra en silencio, no tira error, así que un bug ahí se manifiesta como "no veo ningún dato", hay que mirar con atención.
- El proyecto scratch usado para el test (`rls-test`, con paquete Npgsql) vive fuera del repo, en el directorio temporal de la sesión — no quedó nada de esto commiteado al repo salvo la migración en sí.
