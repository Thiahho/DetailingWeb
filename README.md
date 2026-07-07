# TTurnos — Sistema de Reservas y Gestión para Salones de Belleza

Plataforma web full-stack de reservas online y administración de negocio, pensada para salones de belleza / estudios de uñas con **varios profesionales trabajando en simultáneo, cada uno con su propia agenda**. Los clientes reservan turno solos desde la web; el salón gestiona todo — turnos, equipo, servicios, contenido y configuración — desde un panel centralizado.

> Nacido como sistema de detailing automotriz, hoy reorientado a "TTurnos — Gestioná tu belleza". La arquitectura es genérica: el rubro es una capa de configuración y contenido, no algo hardcodeado en el modelo de datos.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router, React 18) + TypeScript + TailwindCSS |
| Backend | ASP.NET Core (.NET 9) + Entity Framework Core |
| Base de datos | PostgreSQL |
| Autenticación | JWT Bearer + cookies HttpOnly (roles: Admin, Professional, Client) |
| Pagos | MercadoPago (ARS) — opcional, no bloquea el flujo de reserva |
| Imágenes | Cloudinary (CDN, upload directo desde el navegador) |
| Notificaciones | Email (Gmail SMTP / MailKit) + WhatsApp (Meta API) |
| Jobs en background | Hangfire (recordatorios, reintentos de notificación) |

---

## Lo que ofrece

**Para el dueño del negocio:** un panel único donde administrar el equipo completo, la agenda de cada profesional, los servicios, el contenido del sitio y la configuración de marca — sin depender de un desarrollador para cambios de todos los días.

**Para cada profesional del salón:** su propio login y su propia agenda (`/profesional`), donde carga sus horarios disponibles y ve sus turnos, sin ver ni tocar lo que no le corresponde.

**Para el cliente:** reservar un turno 24/7 sin llamar ni escribir por WhatsApp, eligiendo servicio, profesional (o "sin preferencia") y horario, con confirmación inmediata y gestión propia de sus reservas.

---

## Funciones

### 1. Reserva pública (sitio del cliente)

- Flujo guiado: **Servicio → Profesional → Turno**. Si el cliente no elige profesional, ve los turnos de todos los que ofrecen ese servicio, cada uno identificado con su nombre.
- Cada servicio puede tener **campos de formulario personalizados** (texto, select, número, textarea) definidos por el admin — sin tocar código.
- Confirmación automática por **email + WhatsApp**, con link de acceso a "Mis Turnos" y link de cancelación con un clic.
- El pago (MercadoPago) es **opcional y secundario**: la confirmación real del turno es humana (el salón contacta al cliente), el pago online queda disponible como adelanto opcional, no como paso obligatorio.

### 2. Portal del cliente — "Mis Turnos"

- Acceso sin contraseña: magic link / OTP enviado por email.
- Ver reservas propias (estado, servicio, profesional asignado), estado de pago si corresponde, cancelar directamente.
- Diseño mobile-first.

### 3. Panel de Administración (`/admin`)

Acceso exclusivo para rol **Admin** (los profesionales que intentan entrar son redirigidos automáticamente a su propia agenda).

| Sección | Qué hace |
|---|---|
| **Turnos** | Alta manual de turnos disponibles por profesional, listado con filtro por profesional, edición/liberación/borrado |
| **Calendario** | Vista mensual con un punto de color por profesional con disponibilidad ese día; filtro por profesional |
| **Historial** | Registro completo de reservas con filtros |
| **Clientes** | Listado y ficha de clientes recurrentes |
| **Equipo** | Alta/edición de profesionales: foto, color de calendario, especialidad, servicios que ofrece, horario semanal, comisión, y **activar el acceso al sistema** de ese profesional (email/usuario + contraseña) |
| **Servicios** | CRUD de servicios: precio, duración, imagen, detalles, campos personalizados, slug de URL |
| **Galería** | Portafolio de trabajos realizados (fuente real de la sección pública "Trabajos") |
| **Contenido** | Videos promocionales |
| **Empresa** | Nombre, logo, dirección, WhatsApp, redes sociales y mapa (Google Maps embebido) del sitio público, todo editable sin tocar código |
| **Estadísticas** | Reservas totales/mensuales, tasa de confirmación/cancelación, top servicios, ocupación de turnos, anticipación de reserva |
| **Cuenta** | Cambio de contraseña del admin logueado |

### 4. Área del Profesional (`/profesional`)

- Login propio (email **o usuario** + contraseña).
- Agenda acotada a lo suyo: crea/libera/borra sus propios turnos, ve sus propias reservas — nunca la agenda de otro profesional.
- El admin puede cargar la agenda de cualquier profesional desde `/admin`; el profesional solo ve y edita la propia.

### 5. Notificaciones automáticas multicanal

- Email + WhatsApp en: reserva creada, reserva confirmada, recordatorio 24h antes.
- Reintento automático (hasta 3 intentos) si falla el envío, con log visible para el admin.
- Recordatorio de 24h corre como background job (Hangfire), en huso horario de Argentina.

### 6. Configuración de marca sin código

- Nombre del negocio, logo, dirección (completa y corta), WhatsApp, Instagram, y mapa — todo desde `/admin/configuracion`.
- El mapa acepta pegar el `<iframe>` completo de "Insertar un mapa" de Google Maps o directamente un link; si no se carga nada, se arma un mapa automático a partir de la dirección.
- El logo cargado se muestra completo (sin recortes) tanto en el sitio público como en los paneles de admin y profesional, sea cual sea su proporción original.

### 7. SEO

- Metadata dinámica por servicio (title, description, Open Graph, Twitter Cards, canonical URL), generada server-side.

---

## Validaciones y reglas de negocio

### Reservas y turnos

- **Anti doble-reserva a nivel de base de datos**, no solo de aplicación: la creación de una reserva usa una actualización condicional atómica (`IsAvailable: true → false` en una sola sentencia SQL); si dos personas reservan el mismo turno al mismo tiempo, la segunda recibe `409 Conflict`. Además hay un **índice único filtrado** sobre reservas no canceladas por turno, que hace la doble reserva imposible incluso si algo más fallara.
- Un mismo profesional no puede tener dos turnos con el mismo horario de inicio (índice único compuesto `fecha+profesional`); dos profesionales distintos sí pueden compartir el mismo horario.
- No se pueden crear ni editar turnos con fecha pasada (calculado en huso horario de Argentina, no UTC).
- Un profesional **inactivo** no puede recibir turnos ni reservas nuevas, y desaparece de los listados públicos.
- Un profesional logueado solo puede editar, liberar o borrar **sus propios turnos** — el backend verifica la identidad contra el token, nunca contra un valor mandado por el cliente.
- Cancelar un turno ya vencido o ya cancelado está bloqueado; al cancelar, el horario se libera automáticamente para nuevas reservas.
- Reprogramar una reserva ya confirmada está bloqueado (requiere contacto directo, no reprogramación libre).

### Autenticación y sesiones

- Login admite **email o nombre de usuario** indistintamente.
- Contraseñas con BCrypt, mínimo 6 caracteres.
- Cambio de contraseña exige verificar la contraseña actual y que la nueva sea distinta.
- Cookies de sesión `HttpOnly` + `Secure`, JWT firmado (HMAC-SHA256) con expiración validada sin margen de tolerancia.
- Acceso de clientes por link mágico / OTP de 6 dígitos, hasheado, de un solo uso, vence a los 15 minutos.
- Rate limiting dedicado: **5 intentos por minuto** en login/registro/acceso de clientes, **20 solicitudes por minuto** en creación/cancelación/reprogramación de reservas — por IP, sin cola de espera (rechazo inmediato con `429`).

### Roles y permisos

- Tres roles: **Admin** (control total), **Professional** (acotado a su propia agenda), **Client** (acotado a sus propias reservas).
- Endpoints administrativos (equipo, servicios, galería, contenido, configuración, estadísticas, fechas bloqueadas) exigen rol Admin explícitamente — un profesional autenticado que llega a esas rutas recibe rechazo del backend, además de ser redirigido automáticamente en el frontend.

### Reglas de negocio

- Bloquear una fecha puede ser para **todo el negocio** o para **un profesional puntual**; bloquear elimina los turnos disponibles de ese día (no toca los ya reservados).
- Un servicio no puede tener slug duplicado (a nivel de aplicación y de base de datos).
- Pagos: no se puede generar una preferencia de pago para una reserva cancelada o ya pagada; el webhook de MercadoPago se valida por firma HMAC cuando hay secreto configurado, y confirma automáticamente la reserva si el pago es aprobado.

---

## Beneficios

### Para el negocio

| Beneficio | Detalle |
|---|---|
| **Agenda por profesional real** | Cada integrante del equipo tiene su propio calendario independiente, no un pool compartido con conflictos |
| **Autonomía del equipo** | Los profesionales cargan y gestionan su propia disponibilidad, sin pasar todo por el admin |
| **Control centralizado** | Un solo panel para turnos, equipo, servicios, contenido y marca |
| **Cero fricción de confirmación** | El flujo real de negocio (contacto humano) queda intacto; el sistema no fuerza el pago online como condición |
| **Marca propia sin developer** | Nombre, logo, dirección, redes y mapa se cambian desde el panel |
| **Reducción de inasistencias** | Recordatorio automático 24h antes de cada turno |

### Para los profesionales

| Beneficio | Detalle |
|---|---|
| **Login propio** | Entran a su área sin ver el resto del panel admin |
| **Agenda propia** | Cargan y liberan sus turnos sin depender de que el admin lo haga por ellos |
| **Privacidad entre compañeros** | Nunca ven ni pueden tocar la agenda de otro profesional |

### Para el cliente

| Beneficio | Detalle |
|---|---|
| **Reserva 24/7** | Sin depender del horario de atención telefónica |
| **Elección real de profesional** | Ve exactamente los horarios de quien elija, o de todo el equipo si no tiene preferencia |
| **Sin registro** | Accede a "Mis Turnos" con link mágico, sin crear cuenta |
| **Confirmación inmediata** | Email + WhatsApp al instante |
| **Pago 100% opcional** | Puede adelantar el pago si quiere, no es un paso obligado para reservar |

### Técnicos

| Beneficio | Detalle |
|---|---|
| **Consistencia garantizada por la base de datos** | Los invariantes críticos (no doble reserva, no dos turnos iguales por profesional) están en índices únicos, no solo en código de aplicación |
| **Autorización en dos capas** | Rol a nivel de endpoint + verificación de identidad contra el JWT para operaciones sobre datos propios |
| **Notificaciones resilientes** | Reintento automático si falla un canal, con log auditable |
| **Tipado de punta a punta** | TypeScript en frontend, C# en backend |

---

## Estructura del proyecto

```
app/                    Next.js App Router
  admin/                Panel de administración (rol Admin)
  profesional/          Área del profesional (rol Professional)
  servicios/, api/      Páginas públicas y proxies a la API
src/components/         Componentes compartidos (formularios, sidebars, uploads)
src/lib/                Helpers de auth, configuración del sitio, etc.
DetailingApi/           Backend ASP.NET Core
  Controllers/          Un controller por dominio (Bookings, TimeSlots, Professionals, ...)
  Models/                Entidades EF Core + DTOs
  Services/              Auth, notificaciones, recordatorios
  Migrations/            Historial de migraciones EF Core
```

## Correr en local

```bash
# Frontend
npm install
npm run dev          # http://localhost:3000

# Backend
cd DetailingApi
dotnet run --urls http://localhost:5048
```

Las migraciones de base de datos se generan con `dotnet ef migrations add` y se aplican manualmente contra la base de desarrollo (no de forma automática).
