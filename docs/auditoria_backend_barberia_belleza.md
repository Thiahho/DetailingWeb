# Auditoría — backend de TurnoP-Barberia pendiente de portar a TurnosD-Belleza

> ✅ **Port completado** (secciones 1-5) en esta rama. `EmailHtmlBuilder.cs` quedó con
> la paleta real de Belleza (`tailwind.config.js`, blush `#D69AA6`) y tipografía neutral,
> no la de Barbería — pendiente de reskinear cuando se arme el frontend propio. El resto
> es funcionalmente equivalente a Barbería. Sin RLS en `LoyaltyPrizes`/`LoyaltySpins`
> a propósito: Barbería tampoco la tiene ahí (gap preexistente, no introducido acá).

Documento compartido entre ramas: vive en `docs/` y se porta tal cual como uno de los
primeros commits al hacer el port, para que ambas ramas lo vean.

Comparación: `git diff origin/TurnosD-Belleza...HEAD` (áreas de backend). `TurnosD-Belleza`
no solo le falta lo de esta sesión — quedó desactualizada respecto de varias etapas
previas del linaje de Barbería. 24 archivos, ~1200 líneas de diferencia en total.

**Alcance:** solo backend (`Turneo.Api`). Ningún archivo de `frontend/` — el frontend de
Belleza mantiene su propio estilo y se construye aparte, adecuado a esa rama.

**Excluido a propósito:** `EmailHtmlBuilder.cs` (plantilla visual del email — banda de
cuero, Bebas Neue, badges bronce/vino) es estilo de Barbería. Portar la *mecánica*
(botones CTA, badge dinámico, plantilla compartida entre providers) pero no el diseño
puntual — Belleza necesita su propia identidad visual acá cuando se haga el frontend.

---

## 1. Base de infraestructura (prerequisito de todo lo demás)

### 1.1 Fix de RLS en resolución de tenant — **crítico**
- **Commit:** `66ca6c3` (Update TenantResolutionMiddleware.cs)
- **Archivo:** `Infrastructure/MultiTenancy/TenantResolutionMiddleware.cs`
- **Qué arregla:** la query que resuelve el tenant por slug/host abre la conexión a
  Postgres antes de llamar a `SetTenant()`. `TenantSessionInterceptor` solo fija
  `app.tenant_id` en `ConnectionOpened`, así que sin este fix queda en `'0'` para el
  resto del request — RLS bloquea todo lo que sigue (inserts, selects) aunque el
  filtro de EF apunte al tenant correcto.
- **Sin esto:** cualquier request anónimo que resuelva tenant por host (no JWT) puede
  devolver datos vacíos/500 de forma intermitente. Ya causó un incidente real en
  Barbería (login/registro rotos en producción).
- **Dependencias:** ninguna. Portar primero.

### 1.2 Setup de Hangfire / Background Jobs
- **Commit:** `44d1fdd` (Update BackgroundJobsSetup.cs)
- **Archivo:** `Infrastructure/BackgroundJobs/BackgroundJobsSetup.cs`
- **Qué agrega:** manejo de la carrera de `duplicate key` cuando dos instancias
  registran el mismo recurring job casi al mismo tiempo (deploy rolling en Render).
- **Dependencias:** Belleza necesita tener Hangfire+Postgres storage ya andando
  (`AddHangfire`/`AddHangfireServer` en `Program.cs`) antes de este fix y antes de
  `BookingNotificationJob` (sección 3).

---

## 2. Providers de notificación

### 2.1 GmailProvider → EmailProvider (Resend) para el canal Email
- **Archivos:** `Infrastructure/Integrations/EmailProvider.cs` (reescrito, habla la
  API real de Resend: `from`/`to[]`/`subject`/`html`/`text`), `GmailProvider.cs`
  (queda sin registrar, con logging agregado por si se retoma), `Program.cs` (swap
  de registro DI + `HttpClient` con timeout de 15s).
- **Por qué:** Google bloquea/throttlea conexiones SMTP salientes desde IPs de
  datacenter (Render) — `GmailProvider` timeoutea siempre a los 30s en producción,
  bloqueando la respuesta del booking (ver 3.1). Confirmado empíricamente en Barbería.
- **Acción del lado de Belleza:** cuenta en resend.com, dominio verificado o sandbox
  (`onboarding@resend.dev`, limitado a la cuenta propia), `Notifications__Email__ApiKey`
  y `Notifications__Email__From` en Render.
- **Dependencias:** ninguna técnica, pero sin la cuenta de Resend el canal Email
  simplemente no envía (falla con error claro, no rompe nada).

### 2.2 TelegramProvider — no existe en Belleza
- **Archivo:** `Infrastructure/Integrations/TelegramProvider.cs` (nuevo, 111 líneas)
- **Qué hace:** aviso al profesional asignado vía bot de Telegram. Requiere que el
  profesional cargue su propio `chat_id` (sección 4).
- **De esta sesión:** `parse_mode: "HTML"` en el payload — permite tachar/negritar
  texto (usado en el aviso de reprogramación, sección 3.3). Como consecuencia, los
  valores dinámicos que se interpolan (nombre del cliente, servicio, teléfono) se
  escapan (`&`/`<`/`>`) antes de mandarlos — si no, un dato con esos caracteres
  rompe el parseo de Telegram y el mensaje entero falla.
- **Dependencias:** `Notifications__Telegram__BotToken` (bot propio de Belleza,
  vía @BotFather — no se puede reusar el bot de Barbería).

### 2.3 EmailHtmlBuilder — mecánica sí, diseño no
- **Archivo:** `Infrastructure/Integrations/EmailHtmlBuilder.cs` (nuevo, 144 líneas)
- **Qué portar:** la estructura (`Build(NotificationMessage)` compartida entre
  providers, botón CTA + botón secundario de cancelar, badge de color según evento).
- **Qué NO portar tal cual:** los colores/tipografía de barbería (bronce/cuero, Bebas
  Neue). Belleza necesita su propia paleta acá — coordinarlo cuando se arme el
  frontend de esa rama, no antes.

---

## 3. Arquitectura de despacho de notificaciones

### 3.1 BookingNotificationJob — despacho asincrónico vía Hangfire
- **Archivo:** `Core/Notifications/Services/BookingNotificationJob.cs` (nuevo)
- **Por qué:** antes, `BookingsController` esperaba (`await`) a que todas las
  notificaciones (email+WhatsApp+Telegram, cliente+profesional+admins) terminaran
  antes de devolver la respuesta HTTP. Con `GmailProvider` bloqueado (2.1), esto
  colgaba el request hasta 30s — el cliente veía el botón de reservar girando
  indefinidamente, o un 504 del proxy de Vercel.
- **Qué hace:** encola el despacho como job de Hangfire (`BackgroundJob.Enqueue`) —
  la respuesta HTTP vuelve apenas se persiste el booking; las notificaciones se
  mandan aparte. Corre con `currentTenant.SetBypass()` porque el job no tiene
  contexto de tenant ambiental (el HTTP request que lo encoló ya terminó).
- **Dependencias:** 1.2 (Hangfire), registrar `BookingNotificationJob` en DI.

### 3.2 BookingsController — encolar en vez de esperar
- **Archivo:** `Core/Bookings/Controllers/BookingsController.cs`
- **Qué cambia:** los 5 puntos donde antes se hacía
  `await _notificationService.DispatchForBookingAsync(...)` pasan a
  `BackgroundJob.Enqueue<BookingNotificationJob>(...)`: crear, cancelar, reprogramar
  (público), reprogramar (admin), confirmar.
- **De esta sesión — `ConfirmBooking`:** ahora acepta rol `Professional` además de
  `Admin,Staff`, con chequeo de que el profesional solo pueda confirmar turnos
  propios (`booking.ProfessionalId` debe coincidir, si no `403`). `RequirePermission`
  no lo bloquea porque ese filtro solo restringe el rol `Staff`.
- **De esta sesión — reprogramación:** ambos endpoints (`reschedule` público y
  `admin-reschedule`) capturan `booking.TimeSlot.StartDateTime` **antes** de pisar
  `TimeSlotId`, y lo pasan al job (`previousStartDateTime`) — es la única forma de
  poder avisar "de tal hora a tal hora", porque para cuando el job corre esa
  información ya no está en la base.

### 3.3 NotificationService — evento de reprogramación + aviso condicional al profesional
- **Archivo:** `Core/Notifications/Services/NotificationService.cs` (+234 líneas,
  el archivo con más cambios)
- **Nuevo evento `BookingRescheduled`** (cliente, email) y
  **`ProfessionalBookingRescheduled`** (profesional, Telegram) — con
  `{{fecha_hora_anterior}}` tachado (`<s>`) y `{{fecha_hora}}` nueva en negrita
  (`<b>`) — Telegram no soporta color, esto es lo más parecido disponible.
- **Regla de negocio explícita:** el profesional solo recibe el aviso de
  reprogramación si el turno **no** estaba ya confirmado (`booking.Status !=
  Confirmed`). En el endpoint público esto siempre se cumple (un turno confirmado no
  se puede reprogramar por ese endpoint), pero en `admin-reschedule` sí importa —
  ahí un admin puede mover un turno ya confirmado.
- **Aviso al profesional: solo Telegram, nunca email** — el sandbox de Resend
  rechaza (403) cualquier destinatario que no sea la cuenta dueña del API key hasta
  verificar un dominio propio. El cliente sí sigue recibiendo por email.
- **`TryNotifyProfessionalAsync`/`SendProfessionalNotificationAsync`** ahora reciben
  el `eventType` como parámetro en vez de tener `ProfessionalBookingCreated`
  hardcodeado — así se puede reusar para `ProfessionalBookingRescheduled`.

### 3.4 NotificationContracts — campos nuevos
- **Archivo:** `Shared/Interfaces/NotificationContracts.cs`
- `NotificationMessage.CancelCtaLabel` / `CancelCtaUrl` — botón secundario outline,
  se completa para todo evento salvo `BookingCancelled` (no aplica) y los avisos a
  admin/profesional (no tiene sentido ahí).
- `NotificationTemplateData.PreviousStartDateTime` — ver 3.2/3.3.

### 3.5 NotificationEventType — constantes nuevas
- **Archivo:** `Core/Notifications/Entities/NotificationEventType.cs`
- `BookingRescheduled`, `ProfessionalBookingRescheduled` (de esta sesión).
- El commit `d19b44e` (previo a esta sesión) ya había agregado el soporte base de
  Telegram para `ProfessionalBookingCreated` — confirmar que esa parte también le
  falta a Belleza antes de portar encima.

### 3.6 Plantillas de texto (`appsettings.json` / `appsettings.Production.json`)
- **Qué portar:** la estructura de tokens (`{{fecha_hora_anterior}}`, etc.) y el
  fix de **sacar el link crudo del cuerpo del mensaje** — antes los templates de
  email al cliente (`BookingCreated`, `BookingConfirmed`, `BookingCancelled`,
  `BookingReminder24h`) embebían `{{link_mis_turnos}}`/`{{link_cancelacion}}` como
  texto plano dentro del párrafo (con el JWT completo visible, feo y filtra el
  token en texto). Ahora el único lugar donde aparece el link es el botón CTA.
- **Qué NO portar tal cual:** la redacción específica de cada mensaje — ajustarla al
  tono de Belleza si es distinto al de Barbería.
- **Nota:** las plantillas de Resend en `Notifications:Email:*` — endpoint fijo
  (`https://api.resend.com/emails`), `ApiKey` y `From` van vacíos en el JSON base,
  se cargan por variable de entorno en Render (2.1).

---

## 4. Self-service del profesional

### 4.1 Cargar el propio Chat ID de Telegram
- **Ya existía desde `d19b44e`** (previo a esta sesión): `User.TelegramChatId`,
  `AuthService.SetTelegramChatIdAsync`, `POST /api/auth/telegram-chat-id`,
  `GET /api/auth/me` devolviendo `telegramChatId`. Confirmar si esto ya está en
  Belleza o también falta.

### 4.2 Cambiar el propio email de acceso — nuevo de esta sesión
- **Archivos:** `AuthService.UpdateOwnEmailAsync`, `AuthController` → `PUT /api/auth/me`
- Valida que el nuevo email no esté en uso por otra cuenta. La sesión actual sigue
  con el email viejo en el JWT hasta el próximo login (mismo criterio que el cambio
  de contraseña, que tampoco reemite token).

### 4.3 Editar nombre/apellido/especialidad — nuevo de esta sesión
- **Archivos:** `ProfessionalsController` → `GET`/`PUT /api/professionals/me`
- Deliberadamente **no** expone comisión, estado activo, orden ni servicios
  asignados — eso sigue siendo config exclusiva del admin.
- Requiere el claim `professional_id` en el JWT (ya existe desde antes en el
  token de login de profesional).

### 4.4 Ver comisiones del mes — nuevo de esta sesión
- **Archivos:** `ProfessionalsController` → `GET /api/professionals/me/earnings`,
  `IProfessionalsRepository`/`ProfessionalsRepository.GetChargedTotalInRangeAsync`
- Suma los movimientos de Caja (`CajaMovement`, Charge+Deposit-Refund) de turnos
  asignados a ese profesional en el rango de fechas, aplica su `Commission` (%).
- **Depende del módulo Caja.** Si Belleza no usa Caja para registrar cobros, esto
  siempre va a devolver $0 — no rompe nada, pero es inútil sin ese dato.

---

## 5. Fuera de alcance de "las mismas funciones" — evaluar aparte

Estos también le faltan a Belleza respecto del linaje de Barbería, pero no son parte
de lo que se armó en esta sesión (notificaciones/reprogramación/self-service). Están acá
para que la decisión de incluirlos o no sea consciente, no porque haya que portarlos sí o sí.

- **`e5e0242`** — Módulo completo de Ruleta de Lealtad (`Core/Loyalty/*`,
  `LoyaltyRouletteController`, `LoyaltyRouletteService`). Feature de marketing
  grande y autocontenida, nada que ver con turnos/notificaciones.
- **`CloudinaryAdminService.cs`** (nuevo, 115 líneas) — usado por
  `ProfessionalsController` para borrar la foto de perfil al eliminar un
  profesional. **Si se portan las secciones 3-4, este archivo es una dependencia
  dura** (`ProfessionalsController` lo inyecta) — hay que portarlo aunque no esté
  en el pedido explícito.
- **`d557fb6`** — `PlatformTenantsController`: endpoint para que Platform Owner cree
  un Admin en un tenant existente sin dar de alta un tenant nuevo. Backoffice interno,
  no producto de cara al cliente final.
- **`7852aaf`** — Tests de integración nuevos (`SmartLinkEndpointsTests`,
  `SmartTagsEndpointsTests`, ajustes a `BookingsEndpointsTests`/
  `MultiTenancyIsolationTests`, `TestDataFactory`) + política de contraseña más
  estricta (mínimo 8 caracteres + mayúscula + número, antes 6) en
  `ChangePasswordRequest`/`RegisterRequest`. Si Belleza tiene Smart Tags/NFC, estos
  tests aplican directo; si no, quedan huérfanos.

---

## 6. Orden sugerido para el port

1. **1.1** (fix RLS) — solo, verificar que no rompe nada en Belleza antes de seguir.
2. **1.2** (Hangfire) — confirmar que Belleza ya tiene el setup base; si no, primero
   eso.
3. **Sección 5 → `CloudinaryAdminService.cs`** — dependencia dura de 4.3/4.4, portarlo
   aunque sea "fuera de alcance".
4. **2.1 + 2.2 + 2.3** (providers) — sin cuenta de Resend/bot de Telegram todavía no
   hace falta, pero el código puede entrar igual (falla limpio si falta config).
5. **3.1 → 3.6** (arquitectura de despacho) — en ese orden, son incrementales.
6. **4.1 → 4.4** (self-service del profesional) — depende de 3 (los endpoints de
   confirmar/reprogramar) y de Caja (4.4).
7. **Sección 5, resto** (Ruleta, PlatformTenantsController, tests, password policy)
   — decisión aparte, no bloquean nada de lo anterior.

Cuando se haga el port real, este archivo es el punto de partida — conviene
copiarlo a Belleza en el primer commit del port para tener la checklist a mano ahí
también.
