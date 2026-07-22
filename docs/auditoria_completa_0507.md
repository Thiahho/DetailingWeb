# Auditoría completa del sistema — DetailingWeb (05/07)

Base para presupuestar el sistema completo: inventario funcional, tamaño, seguridad, validaciones y calidad de código. Hecha cruzando el grafo de conocimiento del proyecto (`graphify-out/graph.json`, 984 nodos / 1568 edges / 114 comunidades) con lectura puntual del código fuente.

---

## 1. Inventario del sistema (tamaño y stack)

| Métrica | Valor |
|---|---|
| Backend (.cs, sin migraciones) | ~4.754 líneas |
| Frontend (.ts/.tsx) | ~9.487 líneas |
| Controllers (API) | 13 |
| Servicios de dominio | 13 |
| Modelos / DTOs | 27 archivos |
| Páginas admin (Next.js) | 16 |
| Rutas proxy API (Next.js) | 23 |
| Migraciones EF Core | 16 |
| Proyectos de test | **0** |

**Stack:** ASP.NET Core (.NET 9) + EF Core + PostgreSQL, Next.js + React + TypeScript + Tailwind, Hangfire (jobs), JWT + cookies HttpOnly, MercadoPago, Cloudinary, Gmail SMTP / WhatsApp (Meta API), Google Calendar API.

**Módulos funcionales identificados** (vía comunidades del grafo): reservas/turnos online, panel admin completo (clientes, servicios, turnos, historial, calendario, estadísticas, contenido, galería), portal de cliente ("Mis Turnos"), pagos con MercadoPago, notificaciones multicanal (email/WhatsApp) con reintento automático, recordatorios 24h automáticos, gestión de contenido multimedia y galería con Cloudinary, bloqueo de fechas, generación automática de time slots, integración con Google Calendar (parcial/legacy — ver hallazgo de seguridad), SEO (sitemap/robots), configuración de sitio.

Es un sistema de tamaño medio-alto para un proyecto de un solo rubro: 13 dominios de API, ~14.000 líneas de código propio, sin contar dependencias. Sirve como referencia de escala para el presupuesto.

---

## 2. Seguridad

### 🔴 Crítico

**a) Webhook de MercadoPago sin validación de firma activa — ⏸️ Diferido (sistema en demo)**
*Decisión del 05/07: el sistema está en etapa de demo, sin procesar pagos reales todavía — este hallazgo queda pendiente a propósito hasta que se active el cobro real con MercadoPago. Retomar antes de salir a producción con pagos habilitados (junto con rate limiting en `PaymentsController`, que tampoco se aplicó aún).*

`Turneo.Api/Controllers/PaymentsController.cs:154-156` — la validación HMAC es condicional a que `MercadoPago:WebhookSecret` esté configurado, y en `appsettings.json:73` está vacío. Cualquiera puede simular una notificación de pago.
Además, `app/api/payments/webhook/mercadopago/route.ts` (proxy Next.js) no reenvía los headers `x-signature`/`x-request-id`, y devuelve `200` incluso si falla el reenvío al backend (silencia errores frente a MercadoPago).

**b) `CalendarController` sin ninguna autenticación — ✅ Resuelto (05/07)**
`Turneo.Api/Controllers/CalendarController.cs` — **ningún endpoint tenía `[Authorize]` ni `[AllowAnonymous]`** explícito, y el proyecto no define una política global de autorización por defecto (`AddAuthorization()` sin fallback policy en `Program.cs:73`), así que ambos endpoints quedaban **públicos sin querer**:
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

**Pendiente:** `PaymentsController` (`create-preference` y el webhook) queda sin política de rate limiting — se abordará junto con el fix de validación de firma de MercadoPago (ver hallazgo a).

**d) Dump de base de datos con datos de clientes sin gitignorear**
`Turneo.Api/bd_turnos.sql` (untracked, 412 líneas) — dump real con sentencias `COPY` (datos de clientes: nombre, teléfono, email según schema de `Bookings`). `.gitignore` no cubre `*.sql`. A un `git add .` de terminar commiteado con PII real.

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

**Pendiente (menor prioridad, no público/anónimo):** `UpdateTimeSlotRequest` y los DTOs de `ReminderModels.cs` quedan sin anotaciones — están detrás de `[Authorize(Roles="Admin")]`, así que el riesgo es mucho menor.

---

## 4. Confiabilidad y manejo de errores

- Los 2 background services (`ReminderBackgroundService`, `NotificationRetryBackgroundService`) capturan excepciones correctamente y no tumban el proceso — buen patrón.
- Migraciones EF se aplican automáticamente al arrancar (`Program.cs:113-118`, `context.Database.Migrate()`). Es cómodo para deploys automáticos, pero significa que no hay ningún gate/revisión manual antes de que un cambio de esquema se aplique en producción — riesgo a tener en cuenta a medida que el sistema crezca.
- Manejo de errores en controllers es mayormente `try/catch` devolviendo `BadRequest(ex.Message)` — funcional, pero expone mensajes de excepción interna al cliente en varios lugares (`CalendarController`, `AuthController.Login`), lo cual es un detalle de information disclosure menor pero recurrente.

---

## 5. Calidad de código y mantenibilidad

- **Cero tests automatizados** en todo el repo (ni backend ni frontend). Cualquier presupuesto de mantenimiento/extensión debería contemplar esto como deuda técnica de base.
- **Acoplamiento alto en el core del backend**: la comunidad "Backend Namespaces & Controllers" (70 nodos) tiene cohesión 0.05 (muy baja) y `ApplicationDbContext` es el nodo con mayor betweenness centrality (0.079) del sistema — toca 15+ áreas funcionales distintas. No es un bug, pero implica que cambios al modelo de datos tienen blast radius amplio.
- Código muerto detectado: `NowArgentina()` sin usar en `ReminderBackgroundService` (ya corregido), y el módulo `CalendarController`/`GoogleCalendarService` que parece un flujo de reservas paralelo/legacy al actual sistema de `TimeSlots` + `BookingsController`.

---

## 6. Resumen para presupuesto

| Ítem | Severidad | Esfuerzo estimado* |
|---|---|---|
| Validar firma webhook MercadoPago (configurar secret + revisar proxy) | Crítico | ⏸️ Diferido — retomar antes de habilitar pagos reales |
| ~~Asegurar/eliminar `CalendarController` (sin auth)~~ — ✅ resuelto | Crítico | Bajo (horas) |
| ~~Rate limiting en endpoints públicos~~ — ✅ resuelto (excepto Payments) | Alto | Medio (1-2 días) |
| Gitignorear y purgar `bd_turnos.sql` | Alto | Bajo (minutos) |
| ~~Agregar Data Annotations a DTOs públicos~~ — ✅ resuelto | Medio | Medio (1-2 días) |
| Suite de tests automatizados (backend + frontend) | Medio-Alto | Alto (para cobertura razonable) |
| Reducir acoplamiento de `ApplicationDbContext` / modularizar controllers | Bajo (no urgente) | Alto (refactor, no crítico a corto plazo) |

*Esfuerzo aproximado en horas/días de desarrollo — ajustar según la tarifa y el criterio de quien arme el presupuesto final.
