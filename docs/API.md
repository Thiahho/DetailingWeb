# API

> No hay una referencia OpenAPI/Swagger publicada todavía — este documento describe la forma de la API y qué expone cada grupo de endpoints, no un contrato formal request/response.

## Patrón de acceso

El frontend nunca llama al backend .NET directamente desde el browser. Cada llamada pasa por una ruta proxy de Next.js (`app/api/**/route.ts`, 62 en total), que:
- Reenvía el `Authorization` (token de la cookie `HttpOnly`) hacia el backend.
- Reenvía el host real del navegador como `X-Tenant-Host` para que el backend resuelva el tenant correcto (ver [MultiTenancy](MultiTenancy.md)).
- Reenvía la IP del visitante como `X-Client-IP`, junto con `X-Proxy-Secret`, para que el rate limiting sea por visitante y no por IP del proxy. Solo se envían si `PROXY_SHARED_SECRET` está definido en el frontend, y el backend solo los usa si coincide con su `Proxy:SharedSecret` (ver [Security](Security.md#autenticación-y-sesiones)). Las rutas sin tenant (`/api/marketing/roulette/*`, `/api/platform/auth/login`, webhook de MercadoPago) envían esos dos encabezados sin `X-Tenant-Host`.
- El webhook de MercadoPago (`/api/payments/webhook/mercadopago`) reenvía además `x-signature` y `x-request-id`, que el backend necesita para validar la firma.
- Devuelve la respuesta del backend tal cual (o la enriquece — ej. el envío por Gmail de los códigos de acceso se hace en el paso de proxy, no en el backend).

Base URL del backend: `NEXT_PUBLIC_API_URL` (env var del frontend).

## Grupos de endpoints (29 controllers)

La columna "Acceso" es un resumen; la regla exacta de cada endpoint está en sus atributos (`[Authorize]`, `[RequirePermission]`, `[AllowAnonymous]`). "Admin / Staff" significa Admin siempre, y Staff o Professional solo con el permiso del módulo otorgado desde `/admin/permisos` (ver [Security](Security.md#roles-y-permisos)).

| Grupo | Base route | Acceso |
|---|---|---|
| Auth | `/api/auth/*` | Público (login, acceso de cliente por OTP, auto-registro de profesionales) + autenticado (cuenta propia) — ver abajo |
| Permissions (Roles) | `/api/permissions/*` | Admin (gestión) + cualquier cuenta del panel (leer sus propios permisos) |
| Bookings | `/api/bookings/*` | Público (crear/cancelar/reprogramar) + Admin / Staff (listado, detalle, confirmación) |
| Scheduling — TimeSlots | `/api/timeslots/*` | Público (`/available`) + Admin / Staff + Professional (sus propios turnos) |
| Scheduling — BlockedDates | `/api/blockeddates/*` | Admin / Staff |
| Professionals | `/api/professionals/*` | Público (lectura, disponibilidad) + Admin / Staff (CRUD) + Professional (`/me`) |
| Services | `/api/services/*` | Público (lectura) + Admin / Staff (CRUD, receta de insumos) |
| Products | `/api/products/*` | Admin / Staff |
| Insumos | `/api/insumos/*` | Admin / Staff |
| Caja | `/api/caja/*` | Admin / Staff |
| Payments | `/api/payments/*` | Público (crear preferencia, consultar estado) + webhook de MercadoPago (`/api/payments/webhook/mercadopago`, sin auth, firma HMAC obligatoria: `503` si falta `MercadoPago:WebhookSecret`, `401` si la firma falta o es inválida, `200` vacío con `Payments:Enabled=false`) |
| Notifications — Reminders | `/api/reminders/*` | Admin / Staff |
| Notifications — CustomerProfiles | `/api/reminders/customers/*` | Admin / Staff |
| Clients — DataDeletion | `/api/data-deletion-requests/*` | Público (solicitar) + Admin / Staff (gestionar) |
| Automations | `/api/automationrules/*` | Admin / Staff |
| SmartTags | `/api/smart-tags/*` | Admin / Staff. El QR (`/{id}/qr`) codifica el link con `?src=qr`; analytics desglosa por canal (`nfc` / `qr` / `unknown`) |
| SmartTags — SmartLink | `/api/smart/*` | Público (resolución por token, ver [NFC](NFC.md)). `GET /api/smart/{token}` acepta `?src=nfc\|qr` opcional para registrar el canal |
| Loyalty | `/api/loyalty-roulette/*` | Público (jugar) + Admin / Staff (premios) |
| Reviews | `/api/reviews/*` | Público (lectura, alta) + Admin / Staff (moderación) |
| Content (ContentVideos) | `/api/content-videos/*` | Público (lectura) + Admin / Staff (CRUD) |
| Beauty — BeforeAfter (Gallery) | `/api/gallery/*` | Público (lectura) + Admin / Staff (CRUD) |
| Reports (Analytics) | `/api/analytics/*` | Admin |
| Settings — SiteConfig | `/api/siteconfig/*` | Público (lectura) + Admin (edición) |
| Settings — BusinessSettings | `/api/businesssettings/*` | Admin |
| Marketing — Roulette | `/api/marketing/roulette/*` | Público (captación de leads de Turneo) |
| Platform | `/api/platform/*`, `/api/platform/auth/*`, `/api/platform/roulette/*` | `PlatformOwner` (alta de tenants, takedown de contenido, leads) |

Cada controller vive junto a su dominio (`Core/<Dominio>/Controllers/`, `Marketing/Roulette/Controllers/`, o `Modules/Beauty/BeforeAfter/` para Gallery) — ver [Architecture](Architecture.md).

### Cambios recientes de contrato (04/10)

- `POST /api/timeslots` acepta `serviceId` opcional (servicio precargado en el turno). `GET /api/timeslots` y `GET /api/timeslots/available` devuelven `serviceId`, `serviceTitle` y `serviceSlug`.
- `POST` / `PUT /api/professionals` aceptan `email` opcional (correo invitado a registrarse); `GET /api/professionals/all` lo devuelve.
- `GET /api/auth/me` devuelve además `professionalId` y `hasPanelAccess`.

## Autenticación

JWT Bearer, ver [Security](Security.md#autenticación-y-sesiones). El token viaja en una cookie `HttpOnly` puesta por el proxy de Next.js tras el login — el frontend nunca maneja el JWT directamente en JS. Hay tres cookies según quién entra: `admin_token` (Admin y Staff), `token` (profesionales) y `client_token` (clientes). Solo los tokens de sesión autentican: el token de registro de profesionales y el del link "Mis turnos" se rechazan como bearer (`401`) y únicamente valen en el cuerpo de `professional/register/complete` y `client/session/exchange`.

Endpoints de `/api/auth`:

| Endpoint | Para qué |
|---|---|
| `POST login` | Email o usuario + contraseña (Admin, Staff, Professional) |
| `POST register` | Crea un Admin en el tenant actual. Requiere sesión de `Admin` (`401` sin sesión, `403` con otro rol); anónimo solo con `Auth:AllowOpenRegistration=true`, reservado al entorno `Testing` |
| `GET me`, `PUT me`, `POST change-password`, `POST telegram-chat-id`, `POST logout` | Cuenta del usuario logueado |
| `POST professional-account`, `POST professional-account/{id}/telegram-chat-id` | El Admin crea o actualiza el acceso de un profesional |
| `POST professional/register/request` → `verify` → `complete` | Auto-registro de un profesional invitado: código por correo y contraseña propia |
| `POST professional/google` | Login de profesional con un ID token de Google (crea la cuenta si el correo está invitado) |
| `POST client/access/request` → `client/access/verify`, `POST client/session/exchange`, `GET client/identity-strategy` | Acceso de clientes a "Mis turnos" por OTP o link del email |

El login con Google no llama a `professional/google` desde el navegador: pasa por tres rutas propias del frontend (`app/api/auth/google/start`, `callback`, `finish`) que hacen el flujo OAuth por redirección, con una sola URL de callback en el dominio central porque cada negocio vive en un subdominio. Variables necesarias en `frontend/turneo-web/.env.example`; el backend necesita `Google:ClientId`.
