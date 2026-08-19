# DetailingWeb — Documentación Completa del Sistema
 
## Descripción General
 
**DetailingWeb** es una plataforma web full-stack de reservas y gestión diseñada específicamente para negocios de detailing automotriz. Permite a los clientes reservar servicios en línea y a los administradores gestionar todo el negocio desde un panel centralizado.
 
### Stack Tecnológico
 
| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (React 18) + TypeScript + TailwindCSS |
| Backend | C# ASP.NET Core (.NET 9) + Entity Framework Core |
| Base de Datos | PostgreSQL |
| Autenticación | JWT Bearer + Cookies HttpOnly |
| Pagos | MercadoPago (ARS) |
| Imágenes | Cloudinary (CDN) |
| Email | Gmail SMTP (Nodemailer / MailKit) |
| WhatsApp | Meta WhatsApp API |
| Hosting Frontend | Vercel |
| Hosting Backend | Render.com (Docker) |
 
### Arquitectura General
 
```
Cliente (Browser)
      │
      ▼
Next.js Frontend (Vercel)
  - Páginas públicas
  - Panel de administración
  - Portal del cliente
  - API Routes (proxy al backend)
      │
      ▼
C# ASP.NET Core API (Render.com)
  - Lógica de negocio
  - Autenticación JWT
  - Generación de turnos
  - Orquestación de notificaciones
      │
      ▼
PostgreSQL (Render.com)
  - Reservas, servicios, turnos
  - Configuración, galería, pagos
 
Servicios Externos:
  - MercadoPago (cobros)
  - Cloudinary (imágenes)
  - Gmail SMTP (emails)
  - Meta WhatsApp API (mensajes)
```
 
---
 
## Funciones Principales
 
### 1. Sistema de Reservas Online
 
Permite a los clientes reservar turnos de forma autónoma sin necesidad de llamar o escribir por WhatsApp.
 
**Flujo del cliente:**
1. El cliente ingresa al sitio y selecciona el servicio deseado.
2. El sistema muestra los horarios disponibles en tiempo real.
3. El cliente completa el formulario con sus datos (nombre, teléfono, email, patente u otros campos personalizados por servicio).
4. Se crea la reserva y se bloquea el horario automáticamente para evitar doble reserva.
5. El cliente recibe confirmación por email y WhatsApp con su número de turno y links de acceso.
 
**Características técnicas:**
- Verificación de disponibilidad en tiempo real.
- Transacción atómica en la base de datos para evitar conflictos de reserva simultánea.
- Cada servicio puede tener campos de formulario personalizados (texto, select, número, textarea).
- El horario queda bloqueado inmediatamente al confirmar la reserva.
 
---
 
### 2. Panel de Administración
 
Centro de control completo del negocio accesible desde `/admin`. Protegido con autenticación JWT + cookie HttpOnly.
 
#### Secciones del panel:
 
| Sección | Descripción |
|---------|------------|
| **Turnos** | Lista de todas las reservas con estado, datos del cliente y pago |
| **Calendario** | Vista visual mensual/semanal de los turnos agendados |
| **Servicios** | Alta, edición y eliminación de servicios con precios y campos personalizados |
| **Galería** | Gestión del portafolio de trabajos realizados |
| **Contenido** | Administración de videos promocionales |
| **Historial** | Registro completo de reservas con filtros por estado y fecha |
| **Estadísticas** | Dashboard de analytics del negocio |
| **Cuenta** | Cambio de contraseña del administrador |
 
**Acciones disponibles por turno:**
- Ver detalle completo (datos del cliente, servicio, pago).
- Cambiar estado (Pendiente → Confirmado / Cancelado).
- Acceder al historial de notificaciones enviadas.
 
---
 
### 3. Sistema de Pagos con MercadoPago
 
Integración completa con MercadoPago para cobros en línea en pesos argentinos (ARS).
 
**Flujo de pago:**
1. El administrador o el cliente inicia el pago desde el portal.
2. El sistema crea una preferencia de pago en MercadoPago.
3. El cliente es redirigido al checkout de MercadoPago.
4. MercadoPago notifica al sistema vía webhook cuando el pago se aprueba.
5. El sistema actualiza el estado del pago automáticamente.
 
**Estados de pago:** `Pendiente` → `Aprobado` → `Reembolsado`
 
**Datos almacenados:** ID de preferencia, URL de checkout, estado y fecha del pago.
 
---
 
### 4. Portal del Cliente — "Mis Turnos"
 
Sección accesible en `/mis-turnos` donde cada cliente puede ver y gestionar sus propias reservas sin necesidad de registrarse.
 
**Funcionalidades:**
- Ver todas sus reservas con estado actual (Pendiente / Confirmado / Cancelado).
- Ver el estado del pago y acceder al link de pago si está pendiente.
- Cancelar una reserva directamente desde el portal.
- Acceso mediante token único enviado por email (magic link / OTP).
- Diseño responsive optimizado para móvil.
 
---
 
### 5. Gestión de Servicios
 
CRUD completo de servicios que se muestran en el sitio público.
 
**Atributos de cada servicio:**
- Nombre, descripción, precio, duración.
- Imagen (vía Cloudinary).
- Lista de detalles/características.
- Campos de formulario personalizados (esquema JSON dinámico).
- Estado activo/inactivo.
- Orden de aparición en el sitio.
- Slug único para URL (ej: `/servicios/full-detail`).
 
**Ejemplo de campo personalizado:**
```json
{
  "name": "tipo_vehiculo",
  "label": "Tipo de vehículo",
  "type": "select",
  "options": ["Sedán", "SUV", "Camioneta", "Moto"],
  "required": true
}
```
 
---
 
### 6. Generación y Gestión de Turnos (Time Slots)
 
El sistema genera automáticamente los horarios disponibles en base a la configuración del negocio.
 
**Configuración de horarios:**
- Días de la semana habilitados.
- Horario de apertura y cierre.
- Duración de cada turno (configurable en minutos).
- Máximo de días de anticipación para reservar.
 
**Funciones del administrador:**
- Generar turnos para un rango de fechas.
- Bloquear fechas específicas (feriados, vacaciones, etc.).
- Ver en el calendario qué turnos están ocupados o disponibles.
 
---
 
## Funciones Secundarias
 
### 7. Notificaciones Automáticas Multicanal
 
El sistema envía notificaciones automáticas al cliente en los momentos clave del proceso.
 
**Eventos que disparan notificaciones:**
 
| Evento | Email | WhatsApp |
|--------|-------|----------|
| Reserva creada | ✅ | ✅ |
| Reserva confirmada | ✅ | ✅ |
| Recordatorio 24h antes | ✅ | ✅ |
 
**Contenido del email de confirmación:**
- Datos del turno (fecha, hora, servicio).
- Datos del cliente.
- Link a "Mis Turnos" para gestionar la reserva.
- Link de cancelación directa con un clic.
 
**Templates:** Los mensajes utilizan variables dinámicas (`{nombre}`, `{fecha}`, `{servicio}`, etc.) con sustitución automática.
 
---
 
### 8. Recordatorio Automático 24 Horas Antes
 
Un servicio en background escanea periódicamente los turnos próximos y envía un recordatorio automático al cliente exactamente 24 horas antes del turno.
 
- Se ejecuta como `ReminderBackgroundService` en el servidor.
- Previene olvidos y reduce el porcentaje de inasistencias (no-shows).
- El recordatorio incluye los datos del turno y el link para cancelar si el cliente no puede asistir.
 
---
 
### 9. Reintento Automático de Notificaciones
 
Si una notificación falla por error de red o del proveedor, el sistema la reintenta automáticamente.
 
- Hasta **3 intentos** por notificación.
- Registro del estado de cada intento en la base de datos.
- Servicio `NotificationRetryBackgroundService` ejecutándose en background.
- Log completo de notificaciones enviadas visible para el administrador.
 
---
 
### 10. Estadísticas y Analytics
 
Dashboard completo con métricas del negocio disponible en `/admin/estadisticas`.
 
**Métricas disponibles:**
 
| Métrica | Descripción |
|---------|------------|
| Total de reservas | Acumulado histórico |
| Reservas del mes | Conteo mensual actual |
| Tasa de confirmación | % de reservas confirmadas |
| Tasa de cancelación | % de reservas canceladas |
| Top 5 servicios | Servicios más solicitados |
| Tendencia mensual | Reservas por mes (gráfico) |
| Tiempo de anticipación | Con cuántos días reservan los clientes |
| Ocupación de turnos | % de turnos disponibles utilizados |
| Próximos turnos | Lista de turnos próximos confirmados |
 
---
 
### 11. Galería de Trabajos Realizados
 
Portafolio visual de trabajos del negocio para generar confianza en nuevos clientes.
 
- Carga de imágenes vía Cloudinary (CDN).
- Etiquetas por tipo de trabajo.
- Ordenamiento manual de imágenes.
- En el sitio público se muestran las primeras 3 imágenes con opción de "Ver más".
- CRUD completo desde el panel de administración.
 
---
 
### 12. Gestión de Contenido Multimedia
 
Sección para administrar videos promocionales del negocio.
 
- Alta, edición y eliminación de videos.
- Soporte para thumbnail personalizado.
- Integración con plataformas de redes sociales (social media embed).
- Administrado desde `/admin/contenido`.
 
---
 
### 13. Bloqueo de Fechas
 
El administrador puede bloquear días específicos para que no aparezcan turnos disponibles.
 
**Casos de uso:**
- Feriados nacionales.
- Vacaciones del negocio.
- Días con agenda completa por trabajos especiales.
- Días de mantenimiento o imprevistos.
 
Los clientes simplemente no verán esos días como disponibles al intentar reservar.
 
---
 
### 14. Configuración del Sitio
 
El administrador puede personalizar el contenido del sitio público sin tocar código.
 
**Campos configurables:**
 
| Campo | Descripción |
|-------|------------|
| Nombre del negocio | Aparece en el header y metadata |
| Descripción (meta) | Para SEO y buscadores |
| Ubicación | Mostrada en el sitio |
| Teléfono | Número de contacto |
| WhatsApp | Número para el botón flotante |
| Instagram URL | Link al perfil de Instagram |
| Logo | URL del logo del negocio |
| Texto hero | Título principal de la página de inicio |
| Badge hero | Texto del badge/etiqueta del hero |
 
---
 
### 15. SEO Dinámico
 
Cada servicio tiene su propia página con metadata dinámica generada server-side (SSR).
 
**Incluye:**
- Title y description únicos por servicio.
- Open Graph (para compartir en redes sociales).
- Twitter Cards.
- Canonical URLs.
- Generación en el servidor para que los buscadores lo indexen correctamente.
 
---
 
### 16. Botón Flotante de WhatsApp
 
Un botón de contacto rápido por WhatsApp aparece en todas las páginas del sitio.
 
- Configurado con el número de WhatsApp del negocio desde la configuración del sitio.
- Visible en esquina inferior (no invasivo).
- Redirige directamente al chat de WhatsApp con el negocio.
 
---
 
### 17. Gestión de Imágenes con Cloudinary
 
Las imágenes (servicios, galería) se almacenan y sirven a través de Cloudinary.
 
- Upload directo desde el navegador (sin pasar por el servidor propio).
- CDN global para carga rápida de imágenes.
- URL estables para las imágenes de servicios y galería.
- Widget de upload integrado en el panel de administración.
 
---
 
## Beneficios del Sistema
 
### Para el Negocio (Administrador)
 
| Beneficio | Detalle |
|-----------|---------|
| **Automatización completa** | Las reservas, confirmaciones, recordatorios y pagos se gestionan solos, sin intervención manual. |
| **Reducción de no-shows** | Los recordatorios automáticos a 24h reducen las inasistencias. |
| **Control centralizado** | Todo el negocio se gestiona desde un solo panel: turnos, servicios, galería, estadísticas. |
| **Visibilidad del negocio** | Analytics con métricas reales para tomar decisiones (qué servicios vender más, cuándo hay más demanda, etc.). |
| **Imagen profesional** | El sistema transmite profesionalismo y modernidad frente a la competencia. |
| **Sin desarrollo adicional** | El administrador puede cambiar textos, servicios, imágenes y precios sin necesitar un programador. |
| **Cobro en línea** | MercadoPago permite cobrar anticipos o el total del servicio de forma segura. |
| **Escalabilidad** | Arquitectura Docker + Vercel + Render permite crecer sin cambiar la infraestructura. |
 
### Para el Cliente
 
| Beneficio | Detalle |
|-----------|---------|
| **Reserva 24/7** | Puede reservar en cualquier momento, sin esperar a que el negocio esté abierto. |
| **Sin registro requerido** | Accede a sus turnos con magic link enviado al email, sin contraseñas. |
| **Confirmación inmediata** | Recibe confirmación por email y WhatsApp al instante. |
| **Recordatorio automático** | Le avisan 24h antes para que no olvide el turno. |
| **Gestión propia** | Puede ver y cancelar sus turnos desde el portal "Mis Turnos". |
| **Pago seguro online** | Puede pagar cómodamente con tarjeta u otros medios desde MercadoPago. |
| **Transparencia** | Ve el estado de su turno y del pago en tiempo real. |
 
### Beneficios Técnicos
 
| Beneficio | Detalle |
|-----------|---------|
| **Seguridad** | JWT con cookies HttpOnly, BCrypt para contraseñas, HTTPS obligatorio. |
| **Alta disponibilidad** | Desplegado en Vercel (frontend) y Render.com (backend) con SLA de producción. |
| **Base de datos robusta** | PostgreSQL con índices optimizados y transacciones para evitar conflictos. |
| **Código tipado** | TypeScript en frontend + C# en backend reducen bugs en producción. |
| **Notificaciones redundantes** | Si falla email, puede funcionar WhatsApp, y viceversa. Retry automático. |
| **Fácil mantenimiento** | Separación clara frontend/backend, Docker para reproducibilidad. |
| **SEO listo** | SSR con Next.js garantiza indexación correcta por buscadores. |
 
---
 
## Flujos Principales del Sistema
 
### Flujo de Reserva Completo
 
```
1. Cliente visita el sitio
2. Selecciona un servicio
3. Elige fecha y horario disponible
4. Completa el formulario (nombre, email, teléfono, etc.)
5. Sistema bloquea el horario en la base de datos (transacción atómica)
6. Sistema crea la reserva con estado "Pendiente"
7. Sistema genera token de acceso para el cliente
8. Sistema envía Email + WhatsApp de confirmación (asíncrono)
9. Admin ve la nueva reserva en el panel y la confirma
10. Cliente recibe Email + WhatsApp de confirmación
11. 24h antes del turno → recordatorio automático enviado
12. Cliente asiste al turno
```
 
### Flujo de Pago
 
```
1. Cliente accede a "Mis Turnos" con su magic link
2. Ve el turno con estado de pago "Pendiente"
3. Hace clic en "Pagar"
4. Sistema crea preferencia en MercadoPago
5. Cliente es redirigido al checkout de MercadoPago
6. Cliente completa el pago
7. MercadoPago envía webhook al sistema
8. Sistema actualiza el estado del pago a "Aprobado"
9. Cliente ve el turno como pagado en "Mis Turnos"
```
 
### Flujo de Cancelación
 
```
1. Cliente hace clic en link de cancelación (recibido por email)
2. Sistema verifica que el turno no esté ya cancelado
3. Sistema verifica que el turno no haya pasado
4. Cliente confirma la cancelación
5. Sistema actualiza el estado a "Cancelado"
6. Sistema libera el horario para futuras reservas
```
 
---
 
## Estructura de Base de Datos (Resumen)
 
| Tabla | Descripción |
|-------|------------|
| `Users` | Cuentas de administrador |
| `TimeSlots` | Horarios disponibles generados |
| `Bookings` | Reservas de los clientes |
| `Services` | Catálogo de servicios del negocio |
| `Payments` | Pagos asociados a reservas |
| `BlockedDates` | Fechas bloqueadas para reservas |
| `BusinessSettings` | Configuración de horarios del negocio |
| `SiteConfig` | Información y branding del sitio |
| `GalleryItems` | Imágenes del portafolio |
| `ContentVideos` | Videos promocionales |
| `NotificationLogs` | Registro de notificaciones enviadas |
| `ClientAccessCodes` | Tokens de acceso para el portal del cliente |
 
---
 
## Información del Proyecto
 
- **Fecha de documentación:** Marzo 2026
- **Versión Frontend:** Next.js 14.2.5 / React 18.3.1 / TypeScript 5.5.4
- **Versión Backend:** .NET 9.0
- **Base de datos:** PostgreSQL (Render.com)
- **Frontend URL:** https://gestion-turnos-kappa.vercel.app/
- **Backend URL:** https://detailing-api.onrender.com