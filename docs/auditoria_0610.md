# Auditoría del sistema — Turneo (06/10)

Actualiza `auditoria_0510.md` (05/10). El sistema no creció en superficie: esta
pasada cerró **el hueco de verificación más grande que quedaba** (pendiente 2 del
05/10): se corrió `next build` y la suite e2e completa por primera vez desde el
rediseño del sitio público, la reserva y las ruletas. Esta versión **reemplaza
la verificación ejecutada y los pendientes** de la anterior. El estado de
seguridad del 05/10 (`auditoria_0510.md`, sección 4) **sigue vigente**; acá solo
se anota lo que cambió (sección 4).

Esta auditoría cubre **solo el código** (no el estado del repositorio git). Los
cambios de esta pasada quedaron en el árbol de trabajo, sin commitear.

---

## 1. Inventario del sistema

| Métrica | 05/10 | 06/10 (actual) |
|---|---|---|
| Backend (`.cs`, sin migraciones) | ~14.850 líneas | **~14.850 líneas** |
| Frontend (`.ts`/`.tsx`, incluye e2e, sin `landing-capture/`) | ~33.400 líneas | **~33.450 líneas** |
| Controllers (API) | 29 | **29** |
| Páginas Next.js | 48 | **48** |
| Rutas proxy (`app/api/**/route.ts`) | 62 | **62** |
| Migraciones EF Core | 56 | **53 reconocidas por EF** (56 archivos, ver abajo) |
| Tests de integración backend | 159 atributos, 26 archivos — 167 casos | **sin cambios** |
| Tests e2e (Playwright) | 18 specs / 26 tests | **18 specs / 26 tests** |
| Tenants reales en producción | 1 (`legacy`) | **1** (sin cambios) |

**Corrección al inventario del 05/10.** Las 56 migraciones contadas eran
archivos, no migraciones. Tres archivos no tienen `.Designer.cs` ni atributo
`[Migration]`, así que EF Core los ignora y nunca se ejecutan:

- `20260313160000_AddNotificationLogs.cs`
- `20260325120000_AddContentVideos.cs`
- `20260325120000_ReplaceVehicleWithSubjectOnBooking.cs`

`20260325230301_AddCampos.cs` toca las mismas tablas y columnas, y la suite e2e
usa videos de contenido y `Booking.Subject` sin problemas, así que no parece
faltar esquema. No se comparó línea por línea. Son código muerto.

**Migraciones aplicadas.** `dotnet ef migrations list` contra las bases locales
de Development y Testing: 53 de 53 aplicadas, 0 pendientes. Las dos del 05/10
(`AddLocalPhotosToSiteConfig`, `AddLinkUrlToContentVideos`), que figuraban
"generadas y sin aplicar", ya están aplicadas. `has-pending-model-changes`
confirma que el modelo no tiene cambios sin migrar. Producción no se verificó
(sin acceso); el backend ejecuta `Database.Migrate()` al arrancar.

---

## 2. Qué cambió desde el 05/10

Sin trabajo de producto. Todos los cambios salen de la verificación.

**Defectos reales corregidos (código):**

- **`/mis-turnos` mostraba un error como estado vacío.** Si fallaba la carga de
  horarios para reprogramar, el diálogo decía "No hay horarios disponibles por
  ahora". Ahora muestra el error (`app/(client)/mis-turnos/page.tsx`).
- **El proxy de turnos convertía un `429` en `500`.** El rate limiter del
  backend responde `429` con texto plano; la ruta proxy lo parseaba como JSON,
  caía al `catch` y devolvía `500 "Error de conexión con el servidor"`. Ahora
  propaga el `429` con un mensaje propio
  (`app/api/timeslots/[...path]/route.ts`, solo el `GET`).
- **El modal de reserva del calendario podía borrar el servicio elegido.**
  `ReserveSlotModal` reseteaba el servicio cada vez que resolvía la carga de
  datos, aunque el turno no tuviera servicio precargado. En desarrollo el efecto
  corre dos veces (StrictMode) y la segunda respuesta podía llegar con el
  formulario ya visible. Ahora solo limpia el servicio precargado si sigue
  seleccionado. Es la causa más probable del fallo de `admin-calendario`; no se
  aisló de los otros arreglos. No debería ocurrir en producción.

**Infraestructura de tests:**

- **Límite `public-read` configurable.** `Program.cs` lee
  `RateLimiting:PublicReadPermitLimit` (default `60`, el valor anterior).
  `playwright.config.ts` lo sube a `2000` solo para el backend que levanta la
  suite. Motivo: toda la suite sale por el proxy local sin
  `Proxy:SharedSecret`, comparte una única IP y agotaba los 60 por minuto a
  mitad de la corrida. Reproducido a mano: de 70 requests seguidos a
  `/api/timeslots/available`, 13 fallaron.
- **Tests e2e actualizados** (6 specs y un helper nuevo, `e2e/slotForm.ts`). No
  eran defectos de la aplicación:
  - El alta de turnos en `/admin/turnos` usa un calendario
    (`react-day-picker`) en lugar de un `<input type="date">`.
  - `window.confirm()` fue reemplazado en toda la app por `ConfirmDialog`. Solo
    queda un `confirm()` nativo, en `/admin/solicitudes-privacidad`.
  - La opción del selector de ítems de Historial ahora es "Título — precio".
  - En la agenda semanal, el turno destino del arrastre quedaba debajo del
    borde del viewport.

**Documentación de entorno:** `NEXT_PUBLIC_SITE_URL` agregada a
`frontend/turneo-web/.env.example`. Se usaba en `layout.tsx`, `sitemap.ts`,
`robots.ts` y `siteConfig.ts`, pero no estaba documentada.

---

## 3. Verificación ejecutada

- **`next build`**: compila, pasa lint y tipos, y prerenderiza 79 de 79 páginas.
  No apareció ningún error de `useSearchParams` sin `Suspense` ni de límites
  server/client. Único aviso: `metadataBase` sin definir, causado por la falta
  de `NEXT_PUBLIC_SITE_URL` en el entorno local; con la variable cargada
  desaparece. En Vercel, Next.js usa la URL del deploy como respaldo.
- **Suite e2e (Playwright)**: **26 de 26 en verde**. La primera corrida dio 19
  de 26. `/reservar`, la home y el banner de cookies pasaron sin cambios; los 7
  fallos fueron del panel admin, la agenda del profesional y `/mis-turnos`
  (sección 2).
- **Frontend**: `tsc --noEmit` limpio.
- **Suite de integración backend**: `dotnet test Turneo.Api.Tests -c Release` →
  **167 de 167 en verde**, corrida después del cambio en `Program.cs`.
- **No se corrió**: ninguna prueba visual en navegador con datos reales. La
  suite e2e no cubre las ruletas (`/ruleta`, `/beneficios`): el rediseño sigue
  validado solo por compilación.
- **No se probó**: el login con Google de punta a punta ni el webhook de
  MercadoPago contra el servicio real (sin cambios desde el 05/10).

---

## 4. Seguridad — cambios respecto del 05/10

El resto de la sección 4 de `auditoria_0510.md` sigue vigente.

### 🟡 Sube de prioridad — rate limiting compartido sin secreto del proxy

El 05/10 quedó "corregido en código, falta configurar". Esta pasada midió la
consecuencia: sin `PROXY_SHARED_SECRET` / `Proxy__SharedSecret`, todos los
visitantes comparten el cupo de la IP del proxy. Para `public-read` son 60
requests por minuto en total; al agotarse, los `GET` públicos con esa política
(turnos disponibles, profesionales, videos de contenido, reseñas) responden
`429`. La suite e2e lo
alcanzó con 3 workers. No se confirmó si el secreto está cargado en producción.

### 🟡 Nuevo — el `429` del backend llega al cliente como `500` en las rutas proxy

Se corrigió solo en el `GET` de `app/api/timeslots/[...path]/route.ts`. El mismo
patrón (`await response.json()` sin contemplar una respuesta de texto plano)
está en el resto de las rutas proxy; no se relevaron una por una. Efecto: un
límite de tasa se ve como "Error de conexión con el servidor" y no se distingue
de una caída del backend.

### 🟢 Sin riesgo — límite `public-read` configurable

El default sigue en 60. El valor alto solo se inyecta por variable de entorno
desde `playwright.config.ts`. **No debe configurarse en producción.**

---

## 5. Pendientes, por prioridad

1. **Cargar el secreto del proxy** en Vercel y Render, y confirmar que está
   activo. Sin eso el sitio público comparte 60 lecturas por minuto entre todos
   los visitantes (sección 4).
2. **Confirmar `NEXT_PUBLIC_SITE_URL` en Vercel.** Sin ella `sitemap.xml` sale
   vacío y no se emiten URLs canónicas.
3. **Propagar el manejo del `429`** al resto de las rutas proxy.
4. **Revisar en navegador** el sitio público, la reserva y las ruletas con datos
   reales. La suite e2e pasa, pero las ruletas no tienen prueba automatizada.
5. **Borrar las tres migraciones huérfanas** (sección 1), después de confirmar
   que `AddCampos` cubre lo mismo.
6. **Confirmar la rotación del token de WhatsApp** en Meta.
7. Antes de activar pagos: `MercadoPago__WebhookSecret` y una notificación real
   de punta a punta.
8. Crear el cliente OAuth de Google y cargar las variables, si se quiere activar
   ese login.
9. Lo que ya venía: template de WhatsApp, e2e del registro de profesionales y de
   las ruletas, tests de permisos de Staff en el resto de los módulos, "modo
   solo", onboarding self-service, `SaaS/Billing`.

**Cerrado desde el 05/10:** correr la suite e2e y `next build` (pendiente 2).

## 6. Documentación

Actualizados en esta pasada: `frontend/turneo-web/.env.example`
(`NEXT_PUBLIC_SITE_URL`) y el puntero a la auditoría vigente en `README.md`.
`Security.md` y `API.md` no cambiaron: no hubo cambios de contrato ni de
políticas de seguridad.
