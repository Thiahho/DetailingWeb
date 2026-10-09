# Auditoría del sistema — Turneo (07/10)

Actualiza `auditoria_0610.md` (06/10). Esta pasada sí tuvo trabajo de producto:
el módulo Smart Tags ahora **mide el canal de cada interacción (NFC o QR) y deja
cada reserva atribuida a la etiqueta que la originó**. Es lo que faltaba para
poder evaluar un piloto de placas de mostrador con datos de reservas y no solo
de toques. También se corrigió un defecto de la suite e2e que dependía de la
fecha y se dejó operativo el workflow de promoción a producción.

Esta versión **reemplaza el inventario, la verificación ejecutada y los
pendientes** de la anterior. El estado de seguridad de `auditoria_0510.md`
(sección 4) y los cambios de `auditoria_0610.md` (sección 4) **siguen vigentes**;
acá solo se anota lo nuevo (sección 4).

A diferencia de las dos anteriores, esta pasada **sí quedó commiteada y
desplegada**: `TurnosD-Belleza` y `TurnosP-Belleza` están en `ce5bce0`.

---

## 1. Inventario del sistema

Solo se anota lo que cambió. Las líneas de código, controllers, páginas y rutas
proxy no se recontaron.

| Métrica | 06/10 | 07/10 (actual) |
|---|---|---|
| Controllers (API) | 29 | **29** (sin controllers nuevos) |
| Páginas Next.js | 48 | **48** |
| Migraciones EF Core (archivos, sin `.Designer.cs`) | 56 | **60** (2 de esta pasada) |
| Tests de integración backend | 167 casos | **196 casos** |
| Tests e2e (Playwright) | 18 specs / 26 tests | **20 specs / 42 tests** |
| Tenants reales en producción | 1 (`legacy`) | **1** (sin cambios) |

Parte del crecimiento en tests y migraciones viene de trabajo previo a esta
pasada (redes sociales del sitio, acciones masivas del admin). De esta pasada
son 2 migraciones y los casos nuevos de Smart Tags y reservas.

**Migraciones nuevas:**

- `20261007230833_AddSourceToSmartTagEvents`: columna `SmartTagEvents.Source`,
  `varchar(8)` nula.
- `20261007231232_AddSmartTagAttributionToBookings`: columnas
  `Bookings.SmartTagId` (FK nula a `SmartTags`, `ON DELETE SET NULL`) y
  `Bookings.Source` (`varchar(8)` nula).

Las dos se generaron con `dotnet ef migrations add`. Según el responsable del
proyecto, están aplicadas en la base local y en la de Render; esta auditoría no
lo verificó contra esas bases. Sí corrieron contra el Postgres descartable de la
suite de integración.

---

## 2. Qué cambió desde el 06/10

### Smart Tags: canal de origen (commit `957c580`)

- **`GET /api/smart/{token}` acepta `?src=`.** Solo se guardan `nfc` y `qr`
  (sin distinguir mayúsculas). Cualquier otro valor, o su ausencia, se guarda
  como nulo y la respuesta sigue siendo `200`. La normalización vive en
  `Core/SmartTags/Entities/SmartTagSource.cs`.
- **Cada evento guarda el canal** en `SmartTagEvent.Source`.
- **El QR generado incluye `?src=qr`.** La URL para grabar en el chip es la
  misma con `?src=nfc`.
- **Analytics por canal.** Las respuestas de `/api/smart-tags/{id}/analytics` y
  `/api/smart-tags/analytics` suman desgloses `{ nfc, qr, unknown }` para
  interacciones y completadas. `SmartTagResponse` suma `nfcUrl` y `qrUrl`.
  Ningún campo existente se renombró ni se quitó.
- **Frontend.** `/s/[token]` lee `src`, lo valida y lo pasa al backend y al
  formulario de reserva (`BookingForms`, `useBookingFlow`, la ruta proxy de
  reservas y `RebookFlow`). En `/admin/smart-tags` cada etiqueta tiene un botón
  "Link para el chip NFC" y muestra "NFC n · QR n · sin canal n".

### Reservas: atribución persistente (commit `47536be`)

- **El turno guarda de dónde vino.** `Booking.SmartTagId` y `Booking.Source` se
  escriben en la misma fila y transacción que la reserva. Antes la atribución
  existía solo como evento `BOOKING_COMPLETED`.
- **La etiqueta se resuelve antes de guardar**, y la comparación de tenant usa
  `ICurrentTenant.TenantId`. Un token inexistente, inactivo o de otro negocio
  crea la reserva normalmente, con ambos campos nulos.
- **El canal solo se guarda si hubo etiqueta válida.** Un `smartTagSource`
  suelto no atribuye nada.
- **Sin propiedad de navegación `Booking.SmartTag`**, a propósito: `GET
  /api/bookings` (admin) serializa la entidad y una navegación arrastraría la
  etiqueta y su token a esa respuesta.

### Suite e2e: defecto dependiente de la fecha (commit `ce5bce0`)

`e2e/slotForm.ts` busca un día en el calendario de alta de turnos avanzando de
mes hasta encontrarlo. El día 1 del mes siguiente también existe, oculto, como
relleno en la grilla del mes anterior; el helper lo daba por encontrado, dejaba
de avanzar y fallaba esperando que fuera visible. `admin-agenda` usa hoy + 55
días, que el 07/10 cae el 1 de diciembre. Ahora el helper ignora las celdas de
relleno. No era un defecto de la aplicación ni de los cambios de Smart Tags.

### Entrega

- **Rama por defecto del repositorio: `TurnosD-Belleza`** (antes `main`).
  `main` no tiene `.github/workflows`, y GitHub solo muestra un workflow manual
  si su archivo está en la rama por defecto: "Promover a producción" no
  aparecía.
- **Primera promoción con `promover.yml`.** `TurnosP-Belleza` avanzó de
  `e4f3c2b` a `ce5bce0` por fast-forward.

---

## 3. Verificación ejecutada

- **Suite de integración backend**: `dotnet test backend/Turneo.Api.Tests` →
  **196 de 196 en verde** con Docker levantado. Incluye los casos nuevos de
  canal, QR, analytics por canal y atribución de reservas (mismo tenant, canal
  desconocido, token inexistente, etiqueta inactiva, otro tenant, sin token).
- **Sin ciclo rojo/verde real para esos tests.** Se escribieron antes que la
  implementación, pero Docker no estaba disponible y corrieron por primera vez
  con el código ya hecho. Solo se observó el rojo de compilación en los de
  reservas.
- **`dotnet build backend/Turneo.Api`**: 0 errores.
- **Frontend**: `tsc --noEmit` limpio.
- **Suite e2e local**: 39 en verde, 1 fallo y 2 salteados antes del arreglo del
  helper; después se corrieron solo `admin-agenda` y `admin-timeslots`, ambos en
  verde. La suite completa no se volvió a correr en local.
- **CI en GitHub**: en verde sobre `ce5bce0` (backend, tipos y build de
  producción, e2e), informado por el responsable del proyecto. La corrida
  anterior había fallado solo en e2e, por el defecto del helper.
- **No se hizo**: revisión independiente del código. El diff completo lo
  escribió y verificó un único agente; solo se releyó el de
  `BookingsController`.
- **No se probó**: ningún recorrido en navegador con una etiqueta real (toque o
  escaneo, reserva, conteo en `/admin/smart-tags`). La suite e2e no cubre Smart
  Tags.

---

## 4. Seguridad — cambios respecto del 06/10

### 🟢 Sin riesgo — `src` es entrada pública no confiable

Lista blanca de dos valores. Nunca rechaza el pedido ni una reserva: un valor
desconocido o demasiado largo se descarta. `CreateBookingRequest.SmartTagSource`
no tiene `[StringLength]` por ese motivo (un `400` bloquearía la reserva).

### 🟢 Sin riesgo — aislamiento entre negocios en la atribución

Una reserva solo se atribuye a una etiqueta activa del mismo tenant. Un token
ajeno no infla métricas de otro negocio. Cubierto por tests de integración.

### 🟡 A tener presente — `GET /api/bookings` expone dos campos nuevos

El listado de reservas del admin devuelve la entidad, así que ahora incluye
`smartTagId` y `source`. No son datos sensibles y el endpoint exige permisos,
pero es un cambio de contrato que nadie pidió explícitamente. Las respuestas
públicas usan DTOs y no cambiaron.

### 🟡 A tener presente — la búsqueda de la etiqueta entró a la transacción

Si la consulta de la etiqueta falla, la reserva hace rollback. Antes la reserva
ya estaba commiteada y el error llegaba como `500` posterior. Es un
comportamiento más consistente, pero ahora una falla en esa lectura impide
reservar.

### 🟢 Sin cambios — datos personales

Los eventos siguen sin guardar IP ni datos del visitante. En el chip solo va la
URL corta.

### 🟡 Preexistente, sin tocar — `SmartTagToken` con `[StringLength(16)]`

Un token de más de 16 caracteres devuelve `400` en vez de ignorarse, lo que
contradice la regla de que un token inválido nunca bloquea una reserva. Los
tokens reales tienen 12 caracteres, así que solo afecta a un pedido armado a
mano.

---

## 5. Pendientes, por prioridad

1. **Probar una etiqueta real de punta a punta** en navegador: abrir
   `/s/{token}?src=nfc`, reservar y confirmar que el conteo NFC sube en
   `/admin/smart-tags` y que el turno queda con etiqueta y canal.
2. **Confirmar que las dos migraciones están aplicadas en producción.** El
   backend ejecuta `Database.Migrate()` al arrancar, pero no se verificó.
3. **Decidir qué hacer con las etiquetas ya impresas o grabadas.** No llevan
   `src` y cuentan como "sin canal"; para medirlas como QR hay que reimprimir.
4. **Canal en el flujo de reseñas.** `REVIEW_COMPLETED` sigue guardando el canal
   como nulo, así que las reseñas siempre caen en "sin canal".
5. **Vista de turnos por etiqueta o canal.** Los datos están; no hay pantalla ni
   filtro en el admin.
6. **Revisión independiente** de los commits `957c580` y `47536be`.
7. **Agregar `promover.yml` a `main`, o dejar documentado** que la rama por
   defecto es `TurnosD-Belleza` y por qué.
8. Lo que venía del 06/10 y sigue abierto: secreto del proxy en Vercel y Render,
   `NEXT_PUBLIC_SITE_URL` en Vercel, propagar el manejo del `429` al resto de
   las rutas proxy, revisar las ruletas en navegador, borrar las tres
   migraciones huérfanas, rotación del token de WhatsApp, webhook de MercadoPago
   y login con Google.

**Postergado a propósito, hasta tener datos de un piloto:** generación de lotes
de tokens con exportación CSV para grabar chips, y un destino alternativo para
las etiquetas de negocios que cancelan (requiere validar la URL para no abrir un
redirect abierto, y definir la regla comercial).

**Cerrado desde el 06/10:** ninguno de los pendientes listados ese día.

## 6. Documentación

Actualizados en esta pasada: `docs/NFC.md` y `docs/API.md` (parámetro `src`,
campos nuevos de las respuestas y de la reserva), el documento de seguimiento
`odd/tasks/smart-tag-source-attribution.md` y el puntero a la auditoría vigente
en `README.md`. `Security.md` no cambió.
