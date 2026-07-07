# API

> No hay una referencia OpenAPI/Swagger publicada todavía — este documento describe la forma de la API y qué expone cada grupo de endpoints, no un contrato formal request/response.

## Patrón de acceso

El frontend nunca llama al backend .NET directamente desde el browser. Cada llamada pasa por una ruta proxy de Next.js (`app/api/**/route.ts`, 24 en total), que:
- Reenvía el `Authorization` (token de la cookie `HttpOnly`) hacia el backend.
- Reenvía el host real del navegador como `X-Tenant-Host` para que el backend resuelva el tenant correcto (ver [MultiTenancy](MultiTenancy.md)).
- Devuelve la respuesta del backend tal cual (o la enriquece — ej. dispara el envío de emails de confirmación vía Gmail en el paso de proxy, no en el backend).

Base URL del backend: `NEXT_PUBLIC_API_URL` (env var del frontend).

## Grupos de endpoints (por Controller de `Core`)

| Grupo | Base route | Acceso |
|---|---|---|
| Auth | `/api/auth/*` | Público (login, registro, acceso de cliente por OTP) |
| Bookings | `/api/bookings/*` | Público (crear/cancelar/reprogramar) + Admin (listado completo) |
| Services | `/api/services/*` | Público (lectura) + Admin (CRUD) |
| Professionals | `/api/professionals/*` | Público (lectura, disponibilidad) + Admin (CRUD) |
| Scheduling (TimeSlots, BlockedDates) | `/api/timeslots/*` | Admin/Professional (según turno propio) |
| Payments | `/api/payments/*` | Público (crear preferencia, consultar estado) + webhook de MercadoPago (`/api/payments/webhook/mercadopago`, sin auth, validado por firma HMAC) |
| Notifications (Reminders) | `/api/reminders/*` | Admin |
| Content (ContentVideos) | `/api/content-videos/*` | Público (lectura) + Admin (CRUD) |
| Reports (Analytics) | `/api/analytics/*` | Admin |
| Settings (BusinessSettings, SiteConfig) | `/api/siteconfig/*` | Público (lectura) + Admin (edición) |
| Beauty — BeforeAfter (Gallery) | `/api/gallery/*` | Público (lectura) + Admin (CRUD) |

Cada controller vive junto a su dominio (`Core/<Dominio>/Controllers/`, o `Modules/Beauty/BeforeAfter/` para Gallery) — ver [Architecture](Architecture.md).

## Autenticación

JWT Bearer, ver [Security](Security.md#autenticación-y-sesiones). El token viaja en una cookie `HttpOnly` puesta por el proxy de Next.js tras el login — el frontend nunca maneja el JWT directamente en JS.
