# Auditoría del sistema — Turneo (05/10)

Actualiza `auditoria_0410.md` (04/10). Un día después, el sistema casi no creció
en superficie: esta pasada fue de **verificación y corrección**. Por primera vez
desde el 01/09 se corrió la suite de integración, y se corrigieron el hallazgo
crítico y los amarillos que dependían de código. Esta versión **reemplaza el
estado de seguridad y los pendientes** de la anterior. Las secciones de modelo
comercial, panel/UX y la descripción funcional de la sesión del 04/10
(`auditoria_0410.md`, secciones 4, 5 y 6) **siguen vigentes** y no se repiten.

Esta auditoría cubre **solo el código** (no el estado del repositorio git).
Se re-midió el inventario contra el código actual e incluye el rediseño de la
ruleta hecho al final del día (sección 2).

---

## 1. Inventario del sistema

| Métrica | 04/10 | 05/10 (actual) |
|---|---|---|
| Backend (`.cs`, sin migraciones) | ~14.670 líneas | **~14.850 líneas** |
| Frontend (`.ts`/`.tsx`, incluye e2e, sin `landing-capture/`) | ~29.800 líneas | **~33.400 líneas** |
| Controllers (API) | 29 | **29** |
| Páginas Next.js | 48 | **48** |
| Rutas proxy (`app/api/**/route.ts`) | 62 | **62** |
| Migraciones EF Core | 54 | **56** |
| Tests de integración backend | 128 atributos, 22 archivos | **159 atributos, 26 archivos — 167 casos ejecutados** |
| Tests e2e (Playwright) | 17 specs / 21 tests | **18 specs / 26 tests** |
| Tenants reales en producción | 1 (`legacy`) | **1** (sin cambios) |

**Migraciones nuevas** (2, del 05/10, generadas y sin aplicar):
`AddLocalPhotosToSiteConfig` y `AddLinkUrlToContentVideos`.

---

## 2. Qué cambió desde el 04/10

Trabajo de producto del 05/10:

- **Fotos del local** (`SiteConfig.LocalPhotos`): bloque "El local" del sitio
  público. El backend solo guarda URLs `https` absolutas, sin duplicados, hasta 8.
- **Link al posteo original en los videos** (`ContentVideo.LinkUrl`): la card
  del sitio público enlaza al reel o post. El backend solo acepta `https` y los
  hosts de Instagram y TikTok.
- **Sitio público y reserva**: componentes nuevos (`HeroSection`,
  `ServicesSection`, `WorkSection`, `LocalShowcase`, `FeaturedContent`,
  `MobileBookBar`, `BookingWizard`, `useBookingFlow`).

Ambas entradas nuevas se validan en el servidor; no agregan superficie de riesgo.

Rediseño de las ruletas (solo frontend, sin cambios de backend ni de API):

- **Componente compartido** `src/components/public/roulette/RouletteShared.tsx`
  (rueda, marco, encabezado, tarjeta/input/botón, confetti, cálculo del ángulo
  de frenado). `/ruleta` (captación de leads de Turneo, `/api/marketing/roulette`)
  y `/beneficios` (fidelización del negocio, `/api/loyalty-roulette`) lo usan;
  cada una conserva su flujo y su backend. Se eliminó el código duplicado entre
  `RouletteClient.tsx` y `BeneficiosClient.tsx`.
- **Rueda nueva** en SVG: gajos con volumen, aro dorado con 20 luces animadas,
  puntero y centro metálicos, etiquetas a lo largo del gajo. Estilos de las luces
  en `globals.css`, atenuados con "reducir movimiento".
- Estilo alineado con el rediseño de `/reservar` y la home (fondo `ink`, acento
  `accent-serif`).
- No se tocaron `RouletteFloat`, `/admin/ruleta` ni `/platform/roulette`.

---

## 3. Verificación ejecutada

- **Suite de integración backend**: `dotnet test Turneo.Api.Tests -c Release` →
  **167 de 167 en verde**. Antes de las correcciones eran 134 de 134, incluidos
  los 15 tests de auto-registro de profesionales que nunca se habían ejecutado.
- **Frontend**: `tsc --noEmit` limpio.
- **No se corrió**: la suite e2e de Playwright, `next build`, ni ninguna prueba
  en navegador. Es el hueco de verificación más grande que queda; incluye el
  rediseño de las ruletas, que solo se validó con `tsc` y no se vio renderizado
  con premios reales.
- **No se probó**: el login con Google de punta a punta (faltan credenciales de
  Google Cloud) ni el webhook de MercadoPago contra el servicio real (pagos
  apagados).

Un test resultó inestable y se corrigió: `SmartTagsEndpointsTests` fallaba
aproximadamente una de cada tres corridas porque su expresión regular omitía la
`U`, que el generador de tokens sí usa. El defecto estaba en el test, no en el
generador.

---

## 4. Seguridad — estado actual

### ✅ Corregido — `POST /api/auth/register` creaba un Admin sin autenticación

El hallazgo 🔴 del 04/10. Ahora el endpoint solo es anónimo con
`Auth:AllowOpenRegistration=true`, que está únicamente en el entorno de tests
(seed de e2e e integración). Sin ese flag responde `401`, o `403` si el usuario
autenticado no es Admin. **No debe configurarse en producción.**

Además, `AuthController` quedó con `[Authorize]` a nivel de clase: cada endpoint
público lleva su `[AllowAnonymous]` explícito, así que un endpoint nuevo sin
atributo queda cerrado por defecto.

### ✅ Corregido — tokens que no son de sesión aceptados como autenticación

El 04/10 se anotó para el token de registro de profesional. Al corregirlo
apareció un caso peor: el token del link "Mis turnos" (`booking_access`, 7 días,
viaja en una URL) autenticaba `GET /api/auth/me` con `200` si el email
correspondía a un Admin. `JwtAuthenticationSetup` ahora rechaza como bearer
ambos tipos (`professional_registration` y `booking_access`); los de sesión
(`admin_access`, `client_access`, `platform_access`) no cambian.

### ✅ Corregido en código, falta configurar — rate limiting compartido

Confirmado por lectura de código: ninguna ruta proxy reenviaba la IP del
visitante, así que la API particionaba por la IP de salida del proxy. Ahora el
proxy envía `X-Client-IP` y `X-Proxy-Secret`, y la API (`ClientIpResolver`) usa
esa IP en las 7 políticas solo si el secreto coincide. Cubre también las rutas
sin tenant con límite (ruleta de captación, login de plataforma, webhook de
pagos) y la IP que se guarda en cada lead de la ruleta.

**No tiene efecto hasta cargar el mismo valor** en `PROXY_SHARED_SECRET`
(Vercel) y `Proxy__SharedSecret` (Render). Sin eso el comportamiento es el
anterior. Sigue sin medirse en producción.

### ✅ Corregido — webhook de MercadoPago

- Una sola clave, `MercadoPago:AccessToken`, en ambos endpoints; la vieja
  (`MP_ACCESS_TOKEN:AccessToken`) queda como respaldo.
- Sin `MercadoPago:WebhookSecret` el webhook responde `503` en lugar de procesar
  la notificación sin validar la firma.
- La ruta proxy del frontend reenvía `x-signature` y `x-request-id`; antes toda
  notificación que entrara por el proxy habría sido rechazada.

Con `Payments:Enabled=false` nada de esto se ejecuta. Antes de activar pagos hay
que cargar el secreto y probar una notificación real.

### ✅ Corregido — permisos de Staff sin tests

Nueve casos de integración sobre Insumos y Productos: sin el permiso del módulo
responde `403`, con el permiso responde `2xx`, y el Admin no se ve afectado. No
apareció ningún defecto de enforcement. Los otros módulos siguen sin test
dedicado.

### 🟡 Sin cambios — WhatsApp automático sin template aprobado

`Notifications:WhatsApp:TemplateName` sigue vacío. Depende de la aprobación del
template en Meta, no de código.

### 🟡 Sin confirmar — rotación del token de WhatsApp

No se puede verificar desde el código; hay que confirmarlo en Meta.

### 🟡 Sin cambios — registro de profesionales sin e2e

El alta por código y por Google sigue sin test de punta a punta. El código viaja
hasheado y por correo; cubrirlo exigiría un atajo de test en el backend. Lo
cubren los 15 tests de integración.

### 🟢 Menor — contraseña de Postgres local en archivos trackeados

`appsettings.json` y `appsettings.Testing.json` incluyen la contraseña de la
base local de desarrollo. No se encontraron tokens ni credenciales de servicios
externos en archivos trackeados.

---

## 5. Pendientes, por prioridad

1. **Cargar el secreto del proxy** en Vercel y Render (sección 4); sin eso el
   arreglo del rate limiting no se activa.
2. **Correr la suite e2e, `next build` y revisar en navegador** el sitio público,
   la reserva y las ruletas: tres sesiones de cambios sin prueba visual.
3. **Confirmar la rotación del token de WhatsApp** en Meta.
4. Antes de activar pagos: `MercadoPago__WebhookSecret` y una notificación real
   de punta a punta.
5. Crear el cliente OAuth de Google y cargar las variables, si se quiere activar
   ese login.
6. Sin e2e para las ruletas (`/ruleta`, `/beneficios`): el flujo de giro no
   tiene prueba automatizada.
7. Lo que ya venía: template de WhatsApp, e2e del registro de profesionales,
   tests de permisos de Staff en el resto de los módulos, "modo solo",
   onboarding self-service, `SaaS/Billing`.

## 6. Documentación

Actualizados en esta pasada: `Security.md` y `API.md` (cierre de `register`,
tokens rechazados como bearer, encabezados de IP del proxy, MercadoPago),
`frontend/turneo-web/.env.example` (`PROXY_SHARED_SECRET`) y el puntero a la
auditoría vigente en `README.md`. El detalle por tarea y la evidencia de cada
test están en `odd/tasks/audit-0510-security-fixes.md`.
