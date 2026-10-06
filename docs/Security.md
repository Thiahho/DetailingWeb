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
- Contraseñas con BCrypt, mínimo 6 caracteres (8 en el auto-registro de profesionales).
- Cambio de contraseña exige verificar la contraseña actual y que la nueva sea distinta.
- Cookies de sesión `HttpOnly` + `Secure`, JWT firmado (HMAC-SHA256) con expiración validada sin margen de tolerancia. El JWT incluye el claim `tenant_id` (ver [MultiTenancy](MultiTenancy.md)).
- Acceso de clientes por link mágico / OTP de 6 dígitos, hasheado, de un solo uso, vence a los 15 minutos.
- **Auto-registro de profesionales, solo invitados**: el Admin carga el correo en la ficha (`Professional.Email`, único por tenant) y únicamente ese correo puede crear la cuenta, que queda ligada a esa ficha. Dos caminos:
  - **Código por correo**: código de 6 dígitos (mismas reglas que el OTP de clientes, más invalidación tras 5 intentos fallidos) → token de registro de 10 minutos → contraseña elegida por el profesional, mínimo 8 caracteres. El pedido de código responde igual esté o no invitado el correo, para no revelar cuáles lo están.
  - **Google**: el backend valida el ID token por su cuenta (firma, audiencia `Google:ClientId`, `email_verified`). Entra si ya existe una cuenta de profesional con ese correo, la crea si está invitado, y rechaza cualquier otro caso — un Admin o Staff con ese correo no entra por acá. Estas cuentas no tienen contraseña utilizable hasta que el Admin les defina una.
  - Los códigos llevan un propósito (`ClientAccessCode.Purpose`): un OTP de "Mis turnos" no sirve para registrar un profesional, ni al revés.
  - El flujo OAuth del frontend usa `state` firmado (HMAC) con vencimiento y un nonce en cookie `HttpOnly`; el callback central solo reenvía a hosts del dominio base.
- **Alta de administradores cerrada**: `POST /api/auth/register` crea una cuenta `Admin` en el tenant actual y solo puede llamarlo un `Admin` ya autenticado (`401` sin sesión, `403` con sesión de otro rol). El acceso anónimo existe únicamente con `Auth:AllowOpenRegistration=true`, que se define solo en `appsettings.Testing.json` y en la factory de tests de integración (lo necesitan el seed de e2e y la suite). La clave ausente equivale a `false`; no debe definirse en `appsettings.json`, `appsettings.Production.json` ni en las variables de entorno de producción.
- **Tokens que no son de sesión**: el token de registro de profesionales (`token_type=professional_registration`, 10 minutos) y el del link "Mis turnos" del correo (`token_type=booking_access`, 7 días) se firman con la misma clave que los de sesión, pero el pipeline de autenticación los rechaza como bearer o cookie (`401`). Solo sirven en el cuerpo del endpoint que los consume: `professional/register/complete` y `client/session/exchange` respectivamente. Los tokens de sesión (`admin_access`, `client_access`, `platform_access`) no cambian.
- Rate limiting dedicado: **5 intentos por minuto** en login/registro/acceso de clientes, **20 solicitudes por minuto** en creación/cancelación/reprogramación de reservas, **60/min** en el webhook de MercadoPago (tráfico servidor-a-servidor, política separada a propósito), y una política `"public-read"` para lecturas públicas (servicios/profesionales/timeslots) — todas por IP, sin cola de espera (rechazo inmediato con `429`).
- **IP del visitante en el rate limiting**: el navegador llega a la API a través del proxy de Next.js, así que la IP que ve la API es la de salida del proxy. Para que el límite sea por visitante, el proxy envía `X-Client-IP` (primer valor de `x-forwarded-for`, o `x-real-ip`) y `X-Proxy-Secret`; la API usa esa IP como clave del límite solo si el secreto coincide con `Proxy:SharedSecret` (comparación en tiempo constante) y la IP es válida. Configuración necesaria, **con el mismo valor en ambos lados**: `PROXY_SHARED_SECRET` en el frontend (Vercel, variable solo de servidor) y `Proxy__SharedSecret` en la API (Render). Si falta en cualquiera de los dos, o no coinciden, no hay error: el límite sigue siendo por IP del proxy, compartido entre todos los visitantes, igual que antes. El valor debe ser largo y aleatorio y no va en el repositorio. Las rutas proxy sin tenant que llegan a endpoints con límite (`/api/marketing/roulette/*`, `/api/platform/auth/login`, webhook de MercadoPago) no pasan por `tenantHeader()` y envían los mismos dos encabezados con `clientIpHeaders()`; las llamadas directas a la API siguen limitadas por la IP de conexión. La misma regla de confianza (`ClientIpResolver.GetClientIp`) decide la IP que se guarda en cada lead de la ruleta de captación: sin secreto compartido, queda registrada la IP del proxy.

## Multi-tenancy como capa de seguridad

El filtro global de EF Core por `TenantId` (ver [MultiTenancy](MultiTenancy.md)) es, en la práctica, la primera línea de defensa contra que un tenant vea o modifique datos de otro — no depende de que cada endpoint recuerde filtrar manualmente.

**Segunda capa: Row Level Security a nivel Postgres** (migración `EnableRowLevelSecurity`, `Scripts/create_app_role_no_bypass.sql` + `check_rls_role.sql`) — pensada para que un bug de código (un `.IgnoreQueryFilters()` de más, por ejemplo) no alcance a filtrar datos entre negocios. Requiere que el rol de conexión a Postgres **no** tenga `BYPASSRLS`; es configuración operativa además de código — confirmar con `check_rls_role.sql` en cada entorno antes de asumir que está activa.

## Roles y permisos

- Cuatro roles: **Admin** (control total), **Staff** (acceso granular módulo por módulo, ver abajo), **Professional** (acotado a su propia agenda, más los módulos que un Admin le habilite), **Client** (acotado a sus propias reservas).
- Endpoints administrativos (equipo, servicios, galería, contenido, configuración, estadísticas, fechas bloqueadas) exigen rol Admin explícitamente — un profesional autenticado que llega a esas rutas recibe rechazo del backend, además de ser redirigido automáticamente en el frontend.
- **Permisos granulares de Staff** (`ModulePermission`, pantalla `/admin/permisos`): un Admin puede crear cuentas `Staff` y darles acceso Ver/Crear/Editar/Eliminar módulo por módulo (13 módulos: Turnos, Clientes, Servicios, Productos, Insumos, Profesionales, Caja, Contenido, Galería, Automatizaciones, SmartTags, Ruleta, Reseñas). Admin nunca pasa por este chequeo (bypass total). **Sin cerrar del todo**: la verificación de que efectivamente bloquea una acción sin permiso, logueado como esa cuenta, quedó pendiente y no tiene tests de integración dedicados — a diferencia del resto del sistema.

## Reglas de negocio

- Bloquear una fecha puede ser para **todo el negocio** o para **un profesional puntual**; bloquear elimina los turnos disponibles de ese día (no toca los ya reservados).
- Un servicio no puede tener slug duplicado (a nivel de aplicación y de base de datos, único por tenant).
- Pagos: no se puede generar una preferencia de pago para una reserva cancelada o ya pagada; el webhook de MercadoPago exige siempre firma HMAC-SHA256 válida (`x-signature` + `x-request-id`, comparación en tiempo constante) y confirma automáticamente la reserva si el pago es aprobado. Hoy `Payments:Enabled=false` globalmente, así que el webhook devuelve `200` vacío sin procesar nada. Al habilitar pagos:
  - El access token se lee de `MercadoPago:AccessToken` en los dos endpoints (crear preferencia y webhook). La clave anterior `MP_ACCESS_TOKEN:AccessToken` se sigue aceptando como respaldo cuando la primera está vacía.
  - `MercadoPago:WebhookSecret` es obligatorio: sin él, el webhook responde `503` y registra una advertencia en lugar de procesar una notificación sin firma. Con secreto, una firma ausente o inválida responde `401`.
  - La notificación debe llegar a la API con los encabezados `x-signature` y `x-request-id` originales. La ruta proxy del frontend (`app/api/payments/webhook/mercadopago/route.ts`) los reenvía, así que `MercadoPago:WebhookUrl` puede apuntar al proxy o directo a la API. No se probó contra MercadoPago real: verificarlo antes de habilitar pagos.
- Límites de plan: ver [Features](Features.md) — 7 de 11 features tienen enforcement conectado (`MaxProfessionals`, `MaxBookings`, `MaxServices`, `MaxClients`, `CanUseAutomations`, `CanUseMercadoPago`, `CanUseWhatsapp`), pero es **fail-open** por diseño (un tenant sin plan asignado no queda bloqueado por nada).
