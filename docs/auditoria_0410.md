# Auditoría del sistema — Turneo (04/10)

Actualiza `auditoria_0109.md` (01/09). En las ~5 semanas transcurridas no hubo un
salto de tamaño como el anterior: el sistema creció poco en superficie y los
cambios fueron de producto (alta de profesionales, creación de turnos, UX del
panel y de `/reservar`). Esta versión **reemplaza el inventario y el estado de
seguridad** de la anterior y registra qué pasó con cada hallazgo abierto. Las
secciones de modelo comercial y de segmento de mercado de `auditoria_0109.md`
(secciones 4 y 6) **siguen vigentes sin cambios** y no se repiten acá.

Todo lo de la sección 6 ("Sesión de hoy") está **sin commitear y sin probar en
ejecución** al momento de escribir esto — ver la verificación al final de esa
sección antes de darlo por bueno.

---

## 1. Inventario del sistema

| Métrica | 01/09 (auditoría anterior) | 04/10 (actual) |
|---|---|---|
| Backend (`.cs`, sin migraciones) | ~14.040 líneas | **~14.670 líneas** |
| Frontend (`.ts`/`.tsx`, incluye e2e) | ~25.981 líneas | **~29.800 líneas** |
| Controllers (API) | 29 | **29** |
| Páginas Next.js | 47 | **48** |
| Rutas proxy (`app/api/**/route.ts`) | 59 | **62** |
| Migraciones EF Core | 49 | **54** |
| Tests de integración backend | 113 | **128** (`[Fact]`/`[Theory]`, 22 archivos) |
| Tests e2e (Playwright) | 16 specs / 18 tests | **17 specs / 21 tests** |
| Tenants reales en producción | 1 (`legacy`) | **1** (sin cambios) |

Las cifras de 04/10 incluyen el trabajo sin commitear de la sección 6: 1 página
(`/profesional/registro`), 3 rutas proxy (`app/api/auth/google/*`), 2 migraciones
y 15 tests de integración.

**Migraciones desde 01/09** (5): `AddLowStockAlertedSinceToInsumos`,
`AddProfessionalBioSkillsExperience`, `AddInsumoCategory`,
`AddServiceIdToTimeSlots`, `AddProfessionalSelfRegistration` — las dos últimas son
de esta sesión.

**Dominios de Core**: los mismos 21 de la auditoría anterior. No hay módulos ni
controllers nuevos; lo nuevo son endpoints dentro de `Auth`.

---

## 2. Qué cambió entre 01/09 y 04/10 (ya commiteado)

- **Consentimiento de cookies** (02/09, `73d8bd5`): banner propio
  (`src/components/shared/CookieConsent.tsx`, `src/lib/consent.ts`,
  `useConsent`), con spec e2e dedicado (`e2e/cookie-consent.spec.ts`), y cache
  en cliente de los datos públicos (`src/lib/publicDataCache.ts`).
- **Ficha pública del profesional** (02/09, `b0cecc2`): `Bio`, `Skills` y
  `YearsOfExperience` en `Professional`, editables desde `/admin/profesionales` y
  mostrados en la sección "Sobre nosotros" de `/reservar`.
- **Secretos fuera del repo** (02/09, `c1ac73c`): ver sección 3.
- **Estabilidad en Render** (02/09, `09b2507`, `dd50617`): se deshabilitó el
  reload de configuración por `FileSystemWatcher` y se limpian las variables de
  entorno estilo libpq antes de construir la conexión de Npgsql — ambas tras
  caídas reales en producción.
- **Insumos** (03-04/10, `cf02e10`): categoría por insumo (`AddInsumoCategory`) y
  deduplicación del aviso de stock bajo (`LowStockAlertedSince`), que la
  auditoría anterior dejaba anotada como pendiente "si se vuelve ruidoso".
- **Servicios y `/reservar`** (04/10, `cf02e10`): formulario de servicio
  ampliado, página pública por servicio (`/servicios/[slug]`), carrusel de equipo
  (`TeamCarousel`), y componentes de formulario reutilizables (`Autocomplete`,
  `CategoryCombobox`).

---

## 3. Seguridad — estado actual

### ✅ Resuelto — credencial de WhatsApp (Meta) en el repo

El hallazgo 🔴 de 01/09. El commit `c1ac73c` (02/09) sacó el token y la
connection string de los `appsettings*.json` trackeados: hoy
`Notifications:WhatsApp:ApiKey` es un placeholder que indica usar
`dotnet user-secrets` en local. **Lo que este documento no puede confirmar**: que
el token se haya rotado en Meta Business. El valor viejo sigue en el historial de
git, así que sacarlo del archivo no alcanza si no se rotó.

### 🔴 Nuevo hallazgo — `POST /api/auth/register` crea un Admin sin autenticación

`AuthController.Register` no tiene `[Authorize]` y `AuthService.RegisterAsync`
crea un `User` con `Role = "Admin"` en el tenant que resuelva el host. Cualquiera
que conozca la ruta puede crearse una cuenta de administrador de un negocio
existente; el único freno es el rate limiting (`"auth"`, 5/min). El proxy de
Next.js (`app/api/auth/[...path]/route.ts`) reenvía cualquier ruta bajo
`/api/auth/`, así que también es alcanzable desde el dominio público.

La auditoría anterior lo mencionaba en la sección de arquitectura como dato
("existe y es anónimo") sin clasificarlo como riesgo. Lo es. El único uso
encontrado en el repo es el seed de e2e (`e2e/global-setup.ts`). **Acción
recomendada**: exigir rol `Admin` (o `PlatformOwner`) en ese endpoint, o
restringirlo al entorno `Testing`. No se corrigió en esta sesión: no estaba en el
alcance pedido y cambia el seed de e2e.

### 🟡 Sin cambios — webhook de MercadoPago

Igual que el 01/09: la validación HMAC sigue siendo condicional a que
`MercadoPago:WebhookSecret` esté cargado, y sigue la inconsistencia de claves
(`CreateMercadoPagoPreference` lee `MercadoPago:AccessToken`,
`MercadoPagoWebhook` lee `MP_ACCESS_TOKEN:AccessToken`,
`PaymentsController.cs:56` y `:159`). Con `Payments:Enabled=false` no tiene
efecto; sigue siendo prerequisito antes de activar pagos.

### 🟡 Sin cambios — WhatsApp automático sin template aprobado

`Notifications:WhatsApp:TemplateName` sigue vacío en `appsettings.json`, así que
los avisos automáticos al cliente salen como texto libre, sujeto a la ventana de
24 hs de Meta. Email sigue siendo el canal confiable.

### 🟡 Sin cambios — permisos de Staff sin tests dedicados

Sin novedades respecto del 01/09: el enforcement existe, pero sigue sin tests de
integración que prueben el bloqueo logueado como una cuenta sin permiso.

### 🟡 A verificar — el rate limiting `"auth"` podría ser compartido por todos los usuarios

Las políticas particionan por `RemoteIpAddress`, y la API usa
`UseForwardedHeaders` (`X-Forwarded-For`). Pero el navegador nunca le pega a la
API directo: lo hace el proxy de Next.js desde el servidor, y esas rutas no
reenvían la IP del visitante. Si la IP que ve la API es la de salida de Vercel,
**los 5 intentos por minuto de `"auth"` serían un balde común a todos los
usuarios de todos los negocios**, no uno por persona: protege contra fuerza bruta
pero un solo abusador podría dejar a todos sin login. Es lectura de código, no
medido en producción. Pesa más desde esta sesión, porque el registro por código
consume 3 llamadas `"auth"` por alta.

### Nuevo — superficie agregada por el auto-registro de profesionales

Ver sección 6 para el detalle funcional. Decisiones de seguridad tomadas:

- **Solo invitados.** Un correo solo puede registrarse si el admin lo cargó en
  una ficha activa (`Professional.Email`) que todavía no tiene cuenta. No hay
  registro abierto.
- **Sin enumeración de correos.** `professional/register/request` responde lo
  mismo esté o no invitado el email.
- **Código de un solo uso**: 6 dígitos, hasheado con BCrypt, vence a los 15
  minutos, se invalida tras 5 verificaciones fallidas (`FailedAttempts`).
- **Códigos no intercambiables**: `ClientAccessCode.Purpose` separa el OTP de
  "Mis turnos" del de registro de profesional; cada verificación filtra por el
  suyo.
- **Google**: el backend valida el ID token por su cuenta (firma + audiencia
  `Google:ClientId` + `email_verified`), no confía en lo que diga el proxy. El
  flujo es por redirección con `state` firmado (HMAC) y nonce en cookie
  `HttpOnly`; el callback central solo reenvía el `code` a hosts del dominio base.

Puntos débiles conocidos de lo nuevo:

- El token intermedio de registro (10 min) se firma con la misma clave que los
  JWT de sesión. Los endpoints protegidos solo con `[Authorize]` sin rol
  (`/api/auth/me`, `telegram-chat-id`, `PUT me`, `change-password`) lo aceptan
  como autenticado; hoy no hay daño porque buscan un `User` por email que todavía
  no existe, pero conviene que esos endpoints exijan `token_type`.
- Las cuentas creadas con Google quedan con una contraseña aleatoria
  inutilizable: entran solo por Google hasta que el admin les defina una.
- El mail con el código lo manda el proxy de Next.js por Gmail
  (`GMAIL_USER`/`GMAIL_APP_PASSWORD`), no el backend. Si el envío falla, el error
  se descarta y la pantalla avanza igual al paso del código.
- Un negocio con dominio propio (fuera de `*.turneo.app`) no puede usar el login
  con Google hasta ampliar `isAllowedTenantHost` (`src/lib/googleOAuth.ts`).

---

## 4. Modelo comercial / SaaS

Sin cambios desde 01/09 — ver `auditoria_0109.md`, sección 4. Siguen vigentes:
precios en `NULL`, enforcement fail-open, `SaaS/Billing/` vacía, alta de negocio
no self-service.

---

## 5. Panel de administración y UX

48 páginas. Cambios de esta sesión en la sección 6. Cobertura e2e: 17 specs / 21
tests; se sumó el de consentimiento de cookies. **Sin cobertura e2e** siguen los
mismos módulos que el 01/09 (Permisos, Automatizaciones, Smart Tags, Ruleta,
Insumos/Productos, Reseñas, Solicitudes de privacidad, `/admin`, la mayoría del
panel de profesional, todo `(platform)`, pagos), y se suma lo nuevo: el registro
de profesionales (código y Google) no tiene e2e.

Sigue sin wizard ni onboarding guiado para el dueño del negocio.

---

## 6. Sesión de hoy (04/10) — cambios aplicados, sin commitear

### 6.1 Sidebar del panel admin reagrupado

`src/components/dashboard/AdminSidebar.tsx`. El grupo "Negocio" mezclaba 11
módulos; ahora son 7 secciones de 2 a 4 links: **Agenda** (Turnos, Calendario,
Historial), **Clientes** (Clientes, Reseñas, Privacidad), **Catálogo** (Servicios,
Productos, Insumos), **Finanzas** (Caja, Estadísticas), **Marketing**
(Automatizaciones, Smart Tags, Ruleta), **Sitio web** (Galería, Contenido),
**Administración** (Empresa, Equipo, Permisos, Cuenta).

Además: secciones plegables (estado guardado en `localStorage`; la sección de la
página actual nunca se oculta), link activo también en subrutas, y un único árbol
compartido entre el sidebar desktop y el drawer mobile. Los permisos por módulo no
cambiaron.

Relación con el hallazgo de 01/09 (sección 6, "21 ítems de menú sin
simplificación"): esto ordena el menú, **no** implementa el "modo solo" — un
operador único sigue viendo Equipo y Permisos.

### 6.2 Turno disponible con servicio y hora de fin opcionales

- `TimeSlot.ServiceId` (nullable, FK a `Services` con `SetNull`), migración
  `AddServiceIdToTimeSlots`. `POST /api/timeslots` acepta `serviceId` y valida que
  exista; `GET /api/timeslots` y `/available` devuelven `serviceId`,
  `serviceTitle`, `serviceSlug`.
- `/admin/turnos`, formulario "Turno puntual": campos opcionales **Hora fin** y
  **Servicio**. Vacíos, el turno se crea como antes (dura 2 horas, sin servicio).
- El servicio precargado **solo preselecciona**: aparece en la lista de turnos y
  arranca elegido en el modal "Nueva reserva" del Calendario
  (`ReserveSlotModal`), donde se puede cambiar. No restringe qué servicio se
  reserva.

Pendiente: no se preselecciona en la reserva pública (`/reservar`), no está en
"Generar disponibilidad", y editar un turno no permite cambiar servicio ni fin
(al editar, el fin vuelve a inicio + 2 h, comportamiento previo).

### 6.3 Paginación en la agenda del profesional

`app/(professional)/profesional/agenda/page.tsx`: "Próximos turnos" era una lista
sin fin; ahora pagina de a 8 en el cliente. Si se llega desde el link del email
de turno nuevo, abre en la página que contiene ese turno. Sin cambios de backend:
`GET /api/timeslots/mine` sigue devolviendo todos los turnos del profesional, así
que el costo de la consulta no bajó, solo lo que se dibuja.

### 6.4 Cards de video

- `/reservar`, "Contenido destacado": de una card 9:16 a ancho completo por fila
  (más alta que la pantalla en mobile) a una fila con scroll horizontal en mobile
  y grilla de 3 a 5 columnas en desktop, con el título sobre el video.
- `/admin/contenido`: se eliminó el formato de card dentro de card (video a
  sangre arriba, datos debajo, estado como etiqueta) y la grilla pasó a 2-5
  columnas.

### 6.5 Registro y login de profesionales con Google o código por correo

Antes, la única forma de que un profesional entrara era que el admin le creara
email y contraseña desde la ficha ("Activar acceso"). Eso se mantiene y se suma
el alta por cuenta propia, **solo para correos invitados**.

**Modelo** (migración `AddProfessionalSelfRegistration`): `Professional.Email`
(único por tenant) y, en `ClientAccessCode`, `Purpose` y `FailedAttempts`.

**Backend** (`Core/Auth`):

| Endpoint | Función |
|---|---|
| `POST /api/auth/professional/register/request` | Genera el código si el correo está invitado |
| `POST /api/auth/professional/register/verify` | Código correcto → token de registro (10 min) |
| `POST /api/auth/professional/register/complete` | Crea la cuenta con la contraseña elegida (mín. 8) e inicia sesión |
| `POST /api/auth/professional/google` | Login con Google; crea la cuenta si el correo está invitado |

`IGoogleTokenValidator` (`Core/Auth/Services/GoogleTokenValidator.cs`, paquete
`Google.Apis.Auth`) aísla la validación contra Google. `GET /api/auth/me` ahora
devuelve también `professionalId` y `hasPanelAccess`. `ProfessionalsController`
acepta y valida `Email` en alta y edición.

**Frontend**:

- `/profesional/registro` (nueva): email → código → contraseña.
- `/profesional/login`: botón "Continuar con Google" y link "Activá tu cuenta".
- `app/api/auth/google/{start,callback,finish}`: flujo OAuth por redirección con
  una sola URL de callback en el dominio central (Google no acepta comodines y
  cada negocio vive en un subdominio). Helpers en `src/lib/googleOAuth.ts`.
- `/admin/profesionales`: campo Email en la ficha y aviso de invitación pendiente.

**Configuración necesaria** (no está cargada en ningún entorno): en el frontend
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
`AUTH_STATE_SECRET`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`; en el backend
`Google__ClientId`. Sin `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` el botón de Google
no se muestra y el registro por código funciona solo.

**Fuera de alcance**: "olvidé mi contraseña" para profesionales; Google o código
para Admin, Staff y clientes.

### Verificación de la sesión

- Backend: compila (`dotnet build -c Release`, porque la API en ejecución tenía
  bloqueado el binario de Debug). Las dos migraciones se generaron pero **no se
  aplicaron**: se aplican al reiniciar la API (`Database.Migrate()` en el arranque).
- Tests de integración: se escribieron 15 nuevos
  (`ProfessionalSelfRegistrationTests.cs`, a nivel de `AuthService` para no
  consumir el rate limit `"auth"` compartido por la suite). **Ninguno corrió**:
  Docker estaba apagado (Testcontainers), igual que en la sesión del 01/09. La
  suite existente tampoco se corrió después de estos cambios.
- Frontend: `tsc --noEmit` limpio. Sin `next build`, sin e2e, sin prueba en
  navegador.
- Google: no probado de punta a punta; requiere credenciales de Google Cloud que
  no existen todavía.

---

## 7. Pendientes, por prioridad

1. **Cerrar `POST /api/auth/register`** (sección 3).
2. **Confirmar la rotación del token de WhatsApp** en Meta.
3. **Correr la suite de integración y la e2e** con Docker antes de mergear lo de
   la sección 6; son dos sesiones seguidas de cambios de backend sin tests corridos.
4. **Medir el rate limiting `"auth"`** en producción (¿por usuario o global?).
5. Crear el cliente OAuth de Google y cargar las variables, si se quiere activar
   el login con Google.
6. Lo que ya venía del 01/09: `WebhookSecret` y clave de MercadoPago antes de
   activar pagos, template de WhatsApp, tests de permisos de Staff, "modo solo",
   onboarding self-service, `SaaS/Billing`.

## 8. Documentación

Los tres puntos que `auditoria_0109.md` dejaba como desactualizados (`Plans.md`,
enforcement en `Roadmap.md`/`Features.md`/`Security.md`, link roto en
`Roadmap.md`) ya estaban corregidos al 04/10. En esta pasada se actualizaron
`API.md` (grupos de endpoints, cantidad de rutas proxy, autenticación),
`Security.md` (auto-registro de profesionales, `register` abierto) y los
punteros a la auditoría vigente en `README.md` y `Roadmap.md`.

`docs/RULETA.pdf` vuelve a estar en disco. La corrupción de git que se anotó el
01/09 (`git fsck`) no se revisó en esta sesión.
