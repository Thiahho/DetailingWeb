# Auditoría del sistema — Turneo (01/09)

Actualiza `auditoriabelleza_0507.md` (05/07-13/07): en las ~8 semanas transcurridas
el sistema pasó de un proyecto de un solo rubro ("DetailingWeb") a una plataforma
**multi-tenant, multi-módulo, renombrada a Turneo** — el salto de tamaño y
superficie es real, no solo cosmético. Esta versión reemplaza el inventario y el
estado de seguridad de la auditoría anterior; **no repite los hallazgos ya
resueltos ahí** (rate limiting, `CalendarController` eliminado), que siguen
vigentes salvo que se indique lo contrario. Sus dos predecesoras
(`auditoria0507.md`, `auditoria_completa_0507.md`) se borraron el 01/09 —
`auditoriabelleza_0507.md` ya absorbía y resolvía todo su contenido (verificado
antes de borrar); siguen disponibles en el historial de git si hace falta
consultarlas.

---

## 1. Inventario del sistema

| Métrica | 05/07 (auditoría anterior) | 01/09 (actual) |
|---|---|---|
| Backend (`.cs`, sin migraciones) | ~4.904 líneas | **~14.040 líneas** |
| Frontend (`.ts`/`.tsx`) | ~10.172 líneas | **~25.981 líneas** |
| Controllers (API) | 13 | **29** |
| Páginas Next.js | 17 | **47** |
| Rutas proxy (`app/api/**/route.ts`) | 25 | **59** |
| Migraciones EF Core | 17 | **49** |
| Tests de integración backend | 68 | **113** (26 archivos, `[Fact]`/`[Theory]`) |
| Tests e2e (Playwright) | — | **16 specs / 18 tests** |
| Tenants reales en producción | 1 (único negocio) | **1** (sigue siendo el mismo, `legacy`) |

**Nombre del proyecto**: `DetailingWeb` → **`Turneo`** (`backend/Turneo.Api`,
`frontend/turneo-web`, namespace `Turneo.Api.*`). El repo (`DetailingWeb`) y
algunos defaults residuales (dominio de API `detailing-api.onrender.com`, carpeta
Cloudinary `detailing/content`) no se renombraron — cosmético, sin impacto
funcional.

**Dominios de Core** (antes 13 controllers "planos"; hoy organizados por
feature en `Core/<Dominio>/{Entities,DTOs,Controllers,Services,Repositories}`):
Auth, Users, Roles (permisos granulares Staff), Bookings, Scheduling, Professionals,
Services, Settings, Clients, Notifications, Payments, Caja, Products, Insumos,
Content, Reviews, Reports, Automations, SmartTags, Loyalty, Platform.

**Módulos nuevos desde 05/07** (no existían en la auditoría anterior): **Caja**
(apertura/cierre diario y mensual, cobros/señas/devoluciones), **Insumos**
(inventario + receta por servicio + descuento automático de stock), **Reviews**
(reseñas propias + Google Places), **Automatizaciones** (reactivación de clientes,
motor de reglas), **SmartTags** (NFC/QR físico → reserva/reseña), **Loyalty**
(ruleta de fidelización para clientes del negocio), **Marketing/Roulette** (ruleta
de captación de leads, propia de Turneo), **Platform** (backoffice de
`PlatformOwner`: alta de tenants, takedown de contenido).

**Capas nuevas**: `SaaS/` (Tenants, Plans, Features, Subscriptions, Licenses,
Usage), `Enterprise/` (Branches, WhiteLabel/Theme — sin conectar a Core
todavía), `Modules/Beauty/` (Treatments sin controller, BeforeAfter/Gallery),
`Modules/{Restaurant,Medical,Veterinary,Gym,Automotive}/` (carpetas vacías,
roadmap).

---

## 2. Arquitectura y multi-tenancy

Capas `Core → Modules → Infrastructure/Shared → SaaS → Enterprise`, con regla de
dependencia unidireccional documentada en `docs/Architecture.md` y 5 ADRs
(`docs/adr/ADR-001` a `005`). Aislamiento por `TenantId` (`int`, no `Guid`,
decisión explícita) vía `HasQueryFilter` global de EF Core + auto-stamp en
`SaveChanges` (`Infrastructure/Persistence/ApplicationDbContext.cs`).

**Nuevo desde 05/07: Row Level Security a nivel Postgres** (migración
`EnableRowLevelSecurity`, `Scripts/create_app_role_no_bypass.sql` +
`check_rls_role.sql`) — segunda capa de aislamiento por debajo del query filter de
EF, pensada para que un bug de código no alcance a filtrar datos entre negocios.
Requiere que el rol de conexión a Postgres **no** tenga `BYPASSRLS` — es
configuración operativa, no solo código; confirmar en cada entorno (dev, staging,
producción) con `check_rls_role.sql` antes de asumir que está activa.

Resolución de tenant: claim JWT → header `X-Tenant-Host` (deliberadamente no
estándar, evita colisión con el proxy de Render) → `Host` directo → slug
`"legacy"` de fallback. Documentado en `docs/MultiTenancy.md` y ADR-002/003.

**Alta de negocio: sigue sin ser self-service.** `POST /api/platform/tenants`
(`Core/Platform/Controllers/PlatformTenantsController.cs`) crea Tenant + Admin en
una transacción, pero es exclusivo del rol `PlatformOwner` — credencial única en
config (`PlatformOwner:Email`/`PasswordHash`), no en base. `POST /api/auth/register`
existe y es anónimo, pero crea un `Admin` **dentro de un tenant ya existente**
(el que resuelva el host), no un negocio nuevo — no es el flujo que busca un
emprendedor dándose de alta solo. Hoy hay **1 solo tenant real en producción**.

---

## 3. Seguridad — estado actual

### 🔴 Nuevo hallazgo — credencial real de WhatsApp (Meta) commiteada en el repo

`backend/Turneo.Api/appsettings.json:52` y `appsettings.Development.json:6`
(ambos **trackeados por git**, no en `.gitignore`) contienen el `ApiKey` real de la
integración de WhatsApp Business (Meta Graph API) en texto plano, en el
historial de commits del repo. `appsettings.Production.json` sí usa un placeholder
(`REEMPLAZAR_CON_TOKEN_WHATSAPP_ROTADO` — el propio nombre del placeholder sugiere
que ya hubo o se sabe que hace falta una rotación), correcto ahí, pero el token de
desarrollo queda expuesto a cualquiera con acceso de lectura al repo (y a quien
tenga el historial de git, aunque se borre del archivo hoy). **Acción recomendada:
rotar el token en Meta Business y sacarlo de ambos archivos hacia variables de
entorno/secret manager**, igual que ya se hace correctamente en Production.

### 🟡 Confirmado, matiz nuevo — webhook de MercadoPago

La validación HMAC de firma (`PaymentsController.cs`, `MercadoPagoWebhook`) sigue
siendo **condicional**: solo valida si `MercadoPago:WebhookSecret` está
configurado; si está vacío, no rechaza nada. Hoy es de bajo riesgo real porque
`Payments:Enabled=false` en `appsettings.json` y `appsettings.Production.json` —
el endpoint devuelve `200` vacío sin procesar nada mientras los pagos estén
apagados globalmente (`ManualComercial.md` Anexo A ya lo documenta como pendiente
consciente, no olvidado). **Antes de poner `Payments:Enabled=true` en
producción**, cargar `WebhookSecret` es un prerequisito, no un nice-to-have.

Se detectó además una **inconsistencia de nombre de config** entre los dos
endpoints de pago: `CreateMercadoPagoPreference` lee `MercadoPago:AccessToken`,
pero `MercadoPagoWebhook` lee `MP_ACCESS_TOKEN:AccessToken` — una clave distinta,
que no existe en ningún `appsettings*.json` del repo. Con los pagos apagados no
tiene efecto hoy, pero si se activan sin corregir esto, el webhook devolvería
`500` (`return StatusCode(500)` cuando el access token viene vacío) para toda
notificación real de pago.

### ✅ Vigente — rate limiting, RLS, autenticación

Las políticas de rate limiting (`"auth"` 5/min, `"public-booking"` 20/min,
`"payments-webhook"` 60/min) siguen activas y ahora cubren también los endpoints
nuevos con el mismo criterio (`public-read` para lecturas públicas de
servicios/profesionales/timeslots). JWT + cookies HttpOnly, BCrypt para
contraseñas, OTP de 6 dígitos para el portal de cliente. Roles como string libre
(`User.Role`), no enum — se mantiene como en la auditoría anterior, sigue sin ser
un problema real porque los valores están centralizados en
`Core/Roles/PermissionModules.cs` y `RequirePermissionAttribute`.

### 🟡 Nuevo hallazgo — aviso automático al cliente por WhatsApp, sin template aprobado

`Infrastructure/Integrations/WhatsAppProvider.cs:75-83`: ningún `appsettings*.json`
del repo tiene `Notifications:WhatsApp:TemplateName` cargado, así que
`SendToPhoneAsync` **siempre** arma un mensaje de texto libre (`type: "text"`),
nunca un template aprobado por Meta. Esto aplica a los 5 eventos automáticos al
cliente (`BookingCreated/Confirmed/Cancelled/Rescheduled/Reminder24h`,
`NotificationService.DispatchForBookingAsync`) y al recordatorio 24h
(`HangfireReminderJob`). La API de WhatsApp Cloud de Meta **solo entrega texto
libre iniciado por el negocio dentro de la ventana de 24hs desde que el cliente
le escribió primero** — si un cliente nuevo reserva sin haberle escrito antes al
número de WhatsApp del negocio, es probable que Meta rechace el envío
automático. El canal paralelo (Email vía Resend) no tiene esa restricción, así
que hoy es el más confiable de los dos para avisos al cliente. No se verificó
contra la API real de Meta (sin credenciales de producción a mano) — el hallazgo
es de lectura de código, no de una prueba end-to-end.

### 🟡 Permisos de Staff — enforcement sin cerrar del todo

Confirmado por `docs/comercial/ManualComercial.md` Anexo A: el control de acceso
granular por módulo (`ModulePermission`, pantalla `/admin/permisos`, 13 módulos ×
4 acciones) está construido y responde a llamadas reales de alta/asignación, pero
**la verificación de que efectivamente bloquea una acción sin permiso, logueado
como esa cuenta, quedó pendiente de cerrar** y no tiene tests de integración
dedicados — a diferencia del resto del sistema. No bloquea uso normal, pero no
está al mismo nivel de confianza que el resto de lo ya "probado, no prometido".

---

## 4. Modelo comercial / SaaS

Catálogo real vigente (`SaaSCatalogSeeder.cs`, migración
`ReseedCommercialPlanCatalog`, 21/07): **Free, Starter, Pro, Business, Licencia,
Custom** — reemplazó al catálogo anterior (Starter/Pro/Premium/Enterprise/
License/Custom) que `docs/Plans.md` todavía documenta sin actualizar.

| Plan | Profesionales | Sucursales | Reservas/mes | WhatsApp | IA |
|---|---|---|---|---|---|
| Free | 1 | 1 | 50 | ❌ | ❌ |
| Starter | 2 | 1 | ∞ | ❌ | ❌ |
| Pro | 10 | 1 | ∞ | ✅ | ❌ |
| Business | ∞ | ∞ | ∞ | ✅ | ❌ |
| Licencia | ∞ | ∞ | ∞ | ✅ | ✅ |
| Custom | ∞ | ∞ | ∞ | ✅ | ✅ |

**Precios en `NULL` para los 6 planes** — decisión de negocio pendiente, no un
olvido técnico. **Enforcement real** conectado en 7 puntos (`MaxProfessionals`,
`MaxBookings`, `MaxServices`, `MaxClients`, `CanUseAutomations`,
`CanUseMercadoPago`, `CanUseWhatsapp`), más avanzado de lo que documentan
`docs/Roadmap.md`/`Features.md`/`Security.md` (desactualizados, dicen que solo
`MaxProfessionals` está conectado) — pero **fail-open por diseño**
(`IsWithinLimitAsync` devuelve `true` si el tenant no tiene plan asignado), y el
único tenant real hoy no tenía `PlanId` al momento de escribir la migración. En la
práctica, el enforcement no bloquea a nadie todavía.

**`SaaS/Billing/` sigue vacía.** `Subscription`, `License`, `UsageRecord` son
tablas con `DbSet` y configuración de EF pero **cero líneas de código que las
escriban** — no hay ninguna forma de cobrarle la suscripción al dueño del
negocio dentro del sistema. Todo el modelo comercial depende hoy de una
conversación por WhatsApp y un alta manual por `PlatformOwner`.

---

## 5. Panel de administración y UX

47 páginas totales (22 pantallas de admin + 6 de profesional + 6 de platform + 13
públicas/cliente). El panel admin quedó considerablemente más grande desde 05/07
(sumó Caja, Insumos, Automatizaciones, SmartTags, Ruleta, Reseñas, Permisos,
Solicitudes de privacidad). Sin wizard ni onboarding guiado — confirmado por
búsqueda de texto (`onboarding|wizard|primer paso|tutorial`) sin resultados reales
en `app/`/`src/`.

Cobertura e2e: 16 specs / 18 tests contra un backend real aislado (ver
`e2e/global-setup.ts`), con cobertura de la mayoría de los flujos críticos
(reserva pública, admin de turnos/calendario/agenda con drag&drop, caja,
clientes, historial, configuración, galería/contenido, cuenta, estadísticas,
agenda de profesional). **Sin cobertura e2e**: Permisos, Automatizaciones, Smart
Tags, Ruleta (ni admin ni platform), Insumos/Productos como flujo propio,
Reseñas, Solicitudes de privacidad, panel principal `/admin`, la mayoría del
panel de profesional (tablero, comisiones, cuenta, historial), todo `(platform)`,
y el flujo de pago con MercadoPago.

---

## 6. Segmento de mercado — ¿emprendedor solo o salón con equipo?

Analizado en profundidad esta sesión (01/09) a pedido del usuario. Resumen del
veredicto (detalle completo con evidencia por capa en el plan
`binary-dazzling-crown.md`, sesión de esta fecha):

**El sistema hoy está construido, vendido y operado para un salón con 2+
profesionales — el "profesional independiente" existe en el manual comercial
(`docs/comercial/ManualComercial.md:79-95`) y como fila de la tabla de planes,
pero ninguna decisión real de arquitectura, UX u operación estaba tomada
pensando en un dueño que trabaja solo.** Puntos concretos encontrados:

- El plan `Starter` (pensado para 1-2 profesionales) no incluye WhatsApp —
  contradicción de producto real para el segmento que más lo necesita.
- Sin self-signup ni precios públicos, la venta a un emprendedor solo depende de
  una conversación asistida — no escala para ese volumen.
- El alta manual de un turno puntual exigía profesional obligatorio incluso sin
  ningún `Professional` cargado (corregido esta sesión, ver sección 7).
- El panel expone 21 ítems de menú y formularios de equipo (~30+21 controles en
  "Equipo", 52 checkboxes en "Permisos") sin ninguna simplificación para un
  operador único.
- Credenciales de integración (MercadoPago, WhatsApp, Cloudinary, email) son
  globales del deploy, no por negocio — un dueño solo no puede cobrar a su
  propia cuenta ni mandar WhatsApp con su propio número.

---

## 7. Sesión de hoy (01/09) — cambios aplicados

A partir del análisis de la sección 6, se implementó la **Fase 0** del plan de
adaptación (los dos gaps de mayor prioridad para el usuario, de bajo riesgo):

**1. Turno puntual sin profesional, cuando el tenant no tiene ninguno activo.**
- `Core/Scheduling/Repositories/ITimeSlotsRepository.cs` /
  `TimeSlotsRepository.cs`: nuevo `AnyActiveProfessionalExistsAsync()`.
- `Core/Scheduling/Controllers/TimeSlotsController.cs` (`CreateSlot`): ya no
  exige `professionalId` si el tenant no tiene ningún `Professional` activo
  cargado (mismo criterio que ya usaba la generación automática de
  disponibilidad, `TimeSlotGeneratorService`). Si el negocio sí tiene equipo, la
  exigencia se mantiene sin cambios.
- `frontend/turneo-web/app/(admin)/admin/turnos/page.tsx`: el formulario de
  "Turno puntual" y "Generar disponibilidad" deja de bloquear el submit por
  falta de profesional cuando `professionals.length === 0`; envía
  `professionalId: null` en ese caso.

**2. Aviso de turno nuevo al dueño por Telegram, autogestionado.**
- El backend ya soportaba esto end-to-end sin cambios: `NotificationService.
  TryNotifyAdminsAsync` manda Email + Telegram a todos los `User.Role ==
  "Admin"` del tenant en cada evento de reserva, y `POST
  /api/auth/telegram-chat-id` ya aceptaba cualquier usuario autenticado. Solo
  faltaba la pantalla.
- `frontend/turneo-web/app/(admin)/admin/cuenta/page.tsx`: se agregó la sección
  "Avisos por Telegram" (mismo patrón que ya existía en
  `profesional/cuenta/page.tsx`) — carga/borra el propio `TelegramChatId`.

**Verificación:** `dotnet build` del backend y `tsc --noEmit` del frontend, ambos
limpios. Los tests de integración de backend (`TimeSlotsEndpointsTests`) no se
pudieron correr en este entorno por falta de Docker (Testcontainers + Postgres) —
limitación del entorno, no del cambio; ningún test existente dependía del
comportamiento modificado. Pendiente correrlos en un entorno con Docker antes de
mergear, junto con la suite e2e de Playwright.

**Pendiente (fuera de esta sesión)**: Fases 1 a 3 del plan — "modo solo" en el
sidebar y en el flujo de reserva pública (ocultar Equipo/Permisos/selector de
especialista cuando hay ≤1 profesional), onboarding self-service (signup público,
wizard de primer login, defaults de `BusinessSettings`), y credenciales/cobro por
negocio (MercadoPago, WhatsApp, `SaaS/Billing`). Detalle completo en el plan
`binary-dazzling-crown.md` de esta sesión.

### UX pública de `/reservar` — inspirada en attbarber.com (misma sesión, 01/09)

A pedido del usuario, se incorporaron 4 patrones de UX/estructura (no de estilo
visual — se mantuvo la paleta blush/mauve/lavender/cream) tomados de
`attbarber.com`, sobre `frontend/turneo-web/app/(public)/reservar/page.tsx`:

- **Nav sticky con anclas** — ya existía (`src/components/shared/Navbar.tsx` es
  `fixed` con scroll suave a anclas); se agregaron dos links nuevos ("Nosotros",
  "Preguntas") en desktop y mobile.
- **Galería como carrusel** — nuevo `src/components/public/GalleryCarousel.tsx`,
  scroll horizontal nativo con `snap-mandatory` (sin librería nueva), flechas y
  contador "N / total", reemplaza la grilla paginada de a 3.
- **Sección "Sobre nosotros"** — nuevo `src/components/public/AboutSection.tsx`:
  Historia (copy estático, sin campo propio en `SiteConfig` todavía), Formas de
  pago (lista estática), Equipo (**datos reales** vía `GET /api/professionals`,
  agregado al agregador `app/api/public-data/route.ts`), Ubicación (reusa
  `siteConfig.location`).
- **FAQ en acordeón** — nuevo `src/components/public/FaqSection.tsx`, con
  `<details>/<summary>` nativo (mismo patrón que ya usaba `BookingForms.tsx` para
  el pago opcional), 5 preguntas genéricas de reserva/cancelación/seña.

Verificado con `tsc --noEmit` y `next build` limpios (`/reservar` 11.1 kB). Sin
prueba visual en navegador — no hay herramienta de screenshot/browser disponible
en este entorno.

**Nota de contenido pendiente**: "Historia" y "Formas de pago" son copy estático
hardcodeado (no hay campo en `SiteConfig` para que el dueño los edite desde
`/admin/configuracion`) — si se pide que sean editables, es un cambio de backend
aparte (nuevo campo + migración + UI de admin), no incluido acá.

### Aviso manual por Email en el detalle de turno (misma sesión, 01/09)

El modal de detalle de turno en `/admin` (Panel principal) ya tenía un botón de
aviso manual por WhatsApp (`buildBookingWhatsAppUrl`), pero no el equivalente de
Email — solo existía Email para "Avisos programados" (`ScheduledReminder`,
atados a un `CustomerProfile` ya creado). Se agregó paridad:

- `app/(admin)/admin/page.tsx`: campo `email` en la interfaz `Booking`, nuevo
  helper `buildBookingMailtoUrl(slot)`, y botón "Email" en el footer del modal
  (visible solo si el turno tiene email cargado).
- **Sin cambios de backend**: `GET /api/timeslots`
  (`TimeSlotsController.GetAllSlots`) ya devolvía `email = b.Email` en el objeto
  `booking` — el dato viajaba del servidor pero el frontend no lo declaraba ni
  usaba.

Investigación previa (vía subagente Explore) confirmó, y quedó fuera de alcance
a pedido explícito del usuario: no existe hoy ningún botón de aviso inline por
fila (sin abrir el modal), y **no existe ningún endpoint de reenvío server-side**
de una notificación automática de `Booking` — `NotificationService` no está
expuesto por HTTP en ningún controller, así que si el email/WhatsApp automático
de "reserva confirmada" falla de forma no transitoria, hoy no hay forma de
reintentarlo desde el panel (el `NotificationLog` es invisible para el admin).

### Nota operativa — hallazgo ajeno a esta sesión, no corregido

Durante esta sesión se detectó que `docs/RULETA.pdf` figura borrado del disco
(`git status` lo marca `D`, sin que ningún cambio de esta sesión lo haya
tocado) y que el repositorio tiene **corrupción de git preexistente**:
`git fsck --full` reporta un link roto entre el commit `c900f0c9` y un commit
faltante (`46dc1ccd`) en el historial de la rama `main-gedemo`, además de varios
objetos "dangling". No se intentó reparar ni restaurar nada — queda para que el
usuario decida (`git fsck`/recuperar el PDF desde otra copia o el remoto).

---

## 8. Documentación desactualizada — pendiente de sincronizar

No se tocó en esta sesión (fuera de alcance de "actualizar la auditoría"), pero
queda registrado para la próxima pasada de docs:

- `docs/Plans.md` — todavía documenta el catálogo de planes viejo
  (Starter/Pro/Premium/Enterprise/License/Custom).
- `docs/Roadmap.md`, `docs/Features.md`, `docs/Security.md` — dicen que solo
  `MaxProfessionals` tiene enforcement conectado; hoy son 7 puntos (sección 4).
- `docs/Roadmap.md:3` referencia `TurneoRoadmap.md`, el archivo real es
  `docs/TTurnosRoadmap.md` (link roto).
