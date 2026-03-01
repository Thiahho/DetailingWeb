# Análisis integral del sistema (DetailingWeb + DetailingApi)

## 1) ¿Qué es el sistema?
Es una plataforma web para un negocio de detailing automotriz con dos bloques:

- **Frontend público y panel admin** en **Next.js 14 + React + Tailwind**.
- **Backend API** en **ASP.NET Core 9 + Entity Framework + PostgreSQL + JWT**.

Su objetivo principal es **captar clientes**, **mostrar servicios/packs** y **gestionar turnos** (creación, reserva, edición, liberación) con integración opcional a Google Calendar.

---

## 2) Arquitectura técnica resumida

### Frontend (Next.js)
- Landing comercial con hero, packs, galería y formulario de contacto/reserva.
- Página de servicios y detalle por slug.
- Panel de administración para operar turnos.
- Rutas API internas (`/app/api/...`) que funcionan como **proxy/BFF** al backend para centralizar cookies y seguridad.

### Backend (ASP.NET)
- API REST con controladores para:
  - **Auth**
  - **TimeSlots**
  - **Bookings**
  - **BlockedDates**
  - **BusinessSettings**
  - **Calendar**
- Persistencia con Entity Framework + PostgreSQL.
- Autenticación JWT (header o cookie), CORS y migraciones automáticas.
- Seed automático en desarrollo.

### Integraciones
- **Google Calendar** para registrar eventos de reservas (si está configurado).
- **WhatsApp** como canal comercial para contacto rápido.

---

## 3) Funciones actuales (qué hace hoy)

## 3.1 Sitio comercial
- Muestra propuesta de valor, packs y galería.
- Permite “presupuestar” y seleccionar servicio desde la home.
- Incluye componentes SEO (schema local business, sitemap y robots).

## 3.2 Reserva de turnos para clientes
- El cliente consulta turnos disponibles.
- Envía datos (nombre, WhatsApp, vehículo, servicio, mensaje).
- Se crea la reserva y el turno pasa a no disponible.
- Si está activa la integración, crea evento en Google Calendar sin bloquear la reserva si falla Calendar.

## 3.3 Administración de agenda
- Login admin con cookie HttpOnly.
- Ver listado de turnos con estado y datos de reserva asociados.
- Crear, editar, eliminar y liberar turnos.
- Operaciones masivas para limpieza/normalización de agenda.

## 3.4 Configuración operativa del negocio
- Parámetros de disponibilidad (días, hora inicio, duración, pausas, anticipación).
- Regeneración de turnos en base a configuración.
- Bloqueo de fechas (feriados/cierre operativo).

## 3.5 Seguridad y operación
- JWT con validación de issuer/audience/lifetime.
- Middleware de protección para rutas `/admin`.
- CORS para dominios permitidos.
- Migraciones automáticas al iniciar backend.

---

## 4) Beneficios para el negocio

### Comerciales
- Mejora la captación digital con una landing enfocada en conversión.
- Estandariza oferta de packs y reduce fricción en consultas.
- Acelera respuesta al cliente con disponibilidad visible.

### Operativos
- Menos trabajo manual en agenda.
- Reducción de dobles reservas (slot único, validaciones de disponibilidad).
- Trazabilidad de reservas con datos de cliente/vehículo/servicio.

### Escalabilidad
- Separación frontend/backend facilita evolucionar módulos.
- Se puede sumar pasarela de pagos, CRM o automatizaciones sin rehacer toda la base.

---

## 5) Estado de madurez (visión para presupuesto)

## Fortalezas
- Stack moderno y mantenible.
- Flujo end-to-end de reserva funcional.
- Panel admin útil para operación diaria.
- Integración con calendario existente.

## Riesgos / deuda técnica a considerar en estimación
- Varias URLs base (`NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_API_BASE_URL`) podrían unificarse para reducir errores de entorno.
- Conviene cerrar brechas de observabilidad (logs estructurados, alertas, métricas).
- Falta de pruebas automatizadas visibles (unitarias/integración/e2e) para cambios de alto impacto.
- Endpoints y naming podrían normalizarse para consistencia de mantenimiento.

---

## 6) Propuesta para presupuestar (en fases)

## Fase 1 — Hardening y estabilización (2–4 semanas)
**Objetivo:** dejar base sólida para crecer sin incidentes.

Incluye:
- Unificación de configuración por ambiente (dev/staging/prod).
- Endurecimiento de seguridad (cookies, expiración, rate-limit básico, validaciones).
- Logs y monitoreo mínimo productivo.
- Correcciones de UX/admin detectadas en revisión.
- Set inicial de pruebas críticas (auth, booking, timeslots).

## Fase 2 — Producto y conversión (3–6 semanas)
**Objetivo:** mejorar conversión y eficiencia comercial.

Incluye:
- Mejoras de formulario y embudo de reserva.
- Automatizaciones de recordatorio (WhatsApp/email).
- Reportes básicos (ocupación, servicios más vendidos, no-shows).
- Optimización SEO de páginas de servicios.

## Fase 3 — Escala y automatización (4–8 semanas)
**Objetivo:** crecer volumen y calidad operativa.

Incluye:
- Integración de pagos/seña online.
- Reglas de negocio avanzadas (capacidad por servicio, buffers dinámicos).
- Dashboard de métricas operativas/comerciales.
- Integraciones externas (CRM, campañas, BI).

---

## 7) Presupuesto orientativo (referencial)
> Los valores dependen de alcance cerrado, SLA, urgencia y nivel de QA. Se recomienda cotizar por fase con backlog priorizado.

- **Fase 1:** USD **2.000 – 5.000**
- **Fase 2:** USD **3.000 – 8.000**
- **Fase 3:** USD **5.000 – 12.000**

**Proyecto completo (F1+F2+F3):** USD **10.000 – 25.000** (rango típico PyME para este tipo de plataforma).

### Alternativa de contratación
- **Setup inicial + mantenimiento mensual**
  - Setup (hardening + roadmap): USD **2.000 – 4.000**
  - Mantenimiento/evolución: USD **500 – 2.000 / mes**

---

## 8) Qué pedir al cliente para cerrar presupuesto final
Para pasar de rango a cotización cerrada:

1. Volumen esperado de reservas/mes.
2. Canales obligatorios (solo web, WhatsApp API, email, redes).
3. Reglas operativas exactas por servicio (duración real, buffers, capacidad).
4. Requisitos de pagos (seña, devolución, facturación).
5. Requisitos de analítica/reportes y KPIs de negocio.
6. Nivel de soporte post-lanzamiento (horario, tiempos de respuesta, SLA).

Con esto se puede convertir este análisis en una **propuesta económica formal por alcance**, con cronograma, hitos y entregables.
