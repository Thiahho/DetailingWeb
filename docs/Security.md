# Seguridad, validaciones y reglas de negocio

## Reservas y turnos

- **Anti doble-reserva a nivel de base de datos**, no solo de aplicación: la creación de una reserva usa una actualización condicional atómica (`IsAvailable: true → false` en una sola sentencia SQL); si dos personas reservan el mismo turno al mismo tiempo, la segunda recibe `409 Conflict`. Además hay un **índice único filtrado** sobre reservas no canceladas por turno, que hace la doble reserva imposible incluso si algo más fallara.
- Un mismo profesional no puede tener dos turnos con el mismo horario de inicio (índice único compuesto `TenantId+fecha+profesional`); dos profesionales distintos sí pueden compartir el mismo horario.
- No se pueden crear ni editar turnos con fecha pasada (calculado en huso horario de Argentina, no UTC).
- Un profesional **inactivo** no puede recibir turnos ni reservas nuevas, y desaparece de los listados públicos.
- Un profesional logueado solo puede editar, liberar o borrar **sus propios turnos** — el backend verifica la identidad contra el token, nunca contra un valor mandado por el cliente.
- Cancelar un turno ya vencido o ya cancelado está bloqueado; al cancelar, el horario se libera automáticamente para nuevas reservas.
- Reprogramar una reserva ya confirmada está bloqueado (requiere contacto directo, no reprogramación libre).

## Autenticación y sesiones

- Login admite **email o nombre de usuario** indistintamente.
- Contraseñas con BCrypt, mínimo 6 caracteres.
- Cambio de contraseña exige verificar la contraseña actual y que la nueva sea distinta.
- Cookies de sesión `HttpOnly` + `Secure`, JWT firmado (HMAC-SHA256) con expiración validada sin margen de tolerancia. El JWT incluye el claim `tenant_id` (ver [MultiTenancy](MultiTenancy.md)).
- Acceso de clientes por link mágico / OTP de 6 dígitos, hasheado, de un solo uso, vence a los 15 minutos.
- Rate limiting dedicado: **5 intentos por minuto** en login/registro/acceso de clientes, **20 solicitudes por minuto** en creación/cancelación/reprogramación de reservas — por IP, sin cola de espera (rechazo inmediato con `429`).

## Multi-tenancy como capa de seguridad

El filtro global de EF Core por `TenantId` (ver [MultiTenancy](MultiTenancy.md)) es, en la práctica, la primera línea de defensa contra que un tenant vea o modifique datos de otro — no depende de que cada endpoint recuerde filtrar manualmente.

## Roles y permisos

- Tres roles: **Admin** (control total), **Professional** (acotado a su propia agenda), **Client** (acotado a sus propias reservas).
- Endpoints administrativos (equipo, servicios, galería, contenido, configuración, estadísticas, fechas bloqueadas) exigen rol Admin explícitamente — un profesional autenticado que llega a esas rutas recibe rechazo del backend, además de ser redirigido automáticamente en el frontend.

## Reglas de negocio

- Bloquear una fecha puede ser para **todo el negocio** o para **un profesional puntual**; bloquear elimina los turnos disponibles de ese día (no toca los ya reservados).
- Un servicio no puede tener slug duplicado (a nivel de aplicación y de base de datos, único por tenant).
- Pagos: no se puede generar una preferencia de pago para una reserva cancelada o ya pagada; el webhook de MercadoPago se valida por firma HMAC cuando hay secreto configurado, y confirma automáticamente la reserva si el pago es aprobado.
- Límites de plan: ver [Features](Features.md) — hoy solo `MaxProfessionals` bloquea activamente.
