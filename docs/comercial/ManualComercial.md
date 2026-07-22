# Manual Comercial — Turneo

**Versión:** 1.0 · **Fecha:** julio 2026
**Uso:** documento base para todo el equipo comercial y de marketing — guiones de video, anuncios, copy de landing/web, presentaciones a clientes y respuestas a objeciones. Toda pieza de comunicación nueva debería poder trazarse a algo de este documento.

**Regla de oro de este manual:** todo lo que está en la sección 7 ("HOY") es real, está construido y probado con tests automatizados — se puede vender y mostrar sin miedo. Todo lo marcado como roadmap o "MAÑANA" **no existe en código todavía** — es visión de producto, no una promesa a un cliente. El Anexo A es la referencia rápida para no cruzar esa línea en una llamada de venta.

---

## 1. Identidad de marca

### Nombre y origen

**Turneo** — de "turnos" (el término que usa cualquier negocio de servicios en Argentina/LatAm para una cita reservada). El nombre es literal a propósito: no hay que explicar qué hace el producto para entender para qué sirve.

**La historia real es el mejor argumento de venta:** Turneo no nació como una idea de escritorio. Nació como un sistema de gestión de turnos para un **detailing automotriz real**, se reorientó a un **salón de belleza que hoy corre en producción real** (no es una demo ni un mockup), y de esa experiencia concreta con un negocio real se extrajo una plataforma pensada para cualquier rubro con turnos. Es un producto que se construyó resolviendo un problema real antes de intentar generalizarlo — no al revés.

Esto da pie a un ángulo narrativo fuerte para video/contenido: *"Empezamos resolviendo la agenda de un negocio real. Todavía la resolvemos — para el tuyo también."*

### Qué es y qué no es

- **Es:** una plataforma de gestión operativa para negocios con turnos — agenda, equipo, clientes, caja y estadísticas en un solo panel.
- **No es:** un calendario compartido genérico, un link de Calendly con un formulario, ni una planilla con esteroides. La diferencia central de Turneo frente a un "turnero" simple es que administra el **negocio completo alrededor del turno** (quién lo atendió, qué se usó, cuánto se cobró, si ese cliente hay que reactivarlo) — no solo la hora.

### Personalidad de marca

- **Directa, sin relleno.** El dueño de un salón no tiene tiempo para jerga de software — se habla en los términos de su día a día (agenda, caja, clientes que no vuelven), no en términos técnicos (API, backend, multi-tenant).
- **Rigurosa por dentro, simple por fuera.** Adentro hay una arquitectura seria (aislamiento de datos por negocio, seguridad probada, tests automatizados) — pero eso se traduce hacia afuera en una sola promesa simple: *"tus datos están seguros y el sistema no se cae."* El rigor técnico es argumento de venta, no un tema para la cara pública.
- **Construida con casos reales, no con specs.** Cada feature del sistema (ver sección 7) nació de un problema real de un negocio real, no de una lista de funcionalidades "porque quedan bien".

### Territorio visual

La identidad visual de cada negocio que usa Turneo es propia de ese negocio (logo, colores de marca) — el sistema es white-label por diseño (cada tenant puede tener su propio branding). La identidad de **Turneo como producto/marca comercial** (la que este manual sirve para comunicar) todavía no tiene un sistema visual formal definido — es el primer paso natural después de este manual: paleta, tipografía y logo propios de Turneo, separados de cualquier cliente.

### Tagline (propuesta, a validar)

Principal: **"Tu negocio, un solo panel."**

Alternativas según pieza de comunicación:
- *"Turnos, equipo y caja. Todo en un lugar."* (más funcional, sirve para ads de conversión)
- *"El sistema que crece con tu negocio."* (más narrativo, sirve para institucional/about)

---

## 2. Mensaje central

> **Turneo es la plataforma de reservas y gestión para negocios con turnos — salones, estudios y equipos de profesionales — que reemplaza el WhatsApp, el Excel y la agenda de papel por un sistema único: el cliente reserva solo las 24 horas, cada profesional tiene su propia agenda, y el dueño ve y controla todo el negocio (equipo, caja, clientes, estadísticas) desde un solo panel, sin depender de un programador para el día a día.**

Versión de 10 segundos (para video/ads): *"¿Seguís confirmando turnos por WhatsApp y cerrando la caja a mano? Turneo lo hace todo desde un panel — vos manejás el negocio, no la agenda."*

---

## 3. Propuesta de valor por audiencia

Todo negocio con turnos tiene tres usuarios distintos con necesidades distintas. La propuesta de valor cambia según a quién se le habla — usar esto para segmentar guiones de video y copy.

### Para el dueño del negocio (quien decide comprar)

- Un panel único para todo: equipo, agenda, servicios, clientes, caja y estadísticas — sin planillas sueltas ni WhatsApp desordenado.
- Deja de perder tiempo confirmando turnos a mano: el cliente reserva solo, 24/7.
- Ve la facturación, quién vende más, y qué clientes dejaron de venir — sin tener que armar el reporte a mano.
- Cambios del día a día (agregar un servicio, un profesional, ajustar un horario) los hace él mismo, sin llamar a un programador.

### Para el equipo / los profesionales

- Cada profesional tiene su propia agenda — ve sus turnos, sus horarios, y solo lo que le corresponde (no la agenda entera del negocio).
- Menos fricción operativa: el sistema avisa, reprograma y recuerda — no hay que estar pendiente del teléfono.

### Para el cliente final

- Reserva un turno sin llamar ni escribir por WhatsApp — a cualquier hora.
- Elige servicio, profesional (o "sin preferencia") y horario, con confirmación inmediata.
- Gestiona sus propios turnos (cancelar, reprogramar) sin depender de que alguien le conteste.

---

## 4. Perfiles de cliente (a quién le vendemos)

### Perfil primario — hoy

**Salones de belleza, estudios de estética, barberías, spas y negocios similares con 2 o más profesionales**, que hoy gestionan turnos por WhatsApp, Excel o agenda de papel. Señales de que es el cliente correcto:

- Tiene más de un profesional trabajando en simultáneo (el dolor de "agendas que se pisan" es real y frecuente).
- El dueño o un encargado pierde tiempo real todos los días confirmando/reagendando turnos a mano.
- No tiene visibilidad clara de facturación, qué servicio vende más, o qué clientes dejaron de volver.
- Ya usa WhatsApp Business o similar, así que no hay que venderle la idea de "digitalizarse" — hay que venderle dejar de hacerlo a mano.

### Segmentación por tamaño (mapea directo a los planes, ver Anexo B)

| Tamaño del negocio | Plan sugerido | Necesidad dominante |
|---|---|---|
| 1 profesional (independiente) | Starter | Dejar de perder turnos por WhatsApp, agenda simple |
| Equipo chico (2-5 profesionales) | Pro | Coordinar varias agendas + notificaciones automáticas |
| Equipo mediano (hasta 15) | Premium | Todo lo anterior + WhatsApp/IA, mayor volumen de turnos |
| Cadena / franquicia / varios locales | Enterprise | Sin límites, identidad de marca propia — **hoy con matices, ver Anexo A** |

### Perfil secundario — negocios en crecimiento

Negocios de un solo local que están por abrir una segunda sucursal o escalar el equipo. Hoy se les puede vender el crecimiento del equipo (sin límite real en Enterprise); la gestión real de **varias sucursales en una sola agenda** todavía no está conectada (ver Anexo A) — no cerrar ese punto sin aclarar que implica desarrollo adicional.

### Perfil futuro — no vender todavía salvo a medida

Cualquier rubro fuera de belleza (gimnasios, clínicas/consultorios, veterinarias, restaurantes, y el detailing automotriz de donde nació el proyecto). La arquitectura ya está pensada para esto (ver sección 7, "Mañana"), pero hoy no hay una sola línea de código de esos módulos — cualquier venta ahí es un proyecto **Custom** desde cero sobre la base existente, no un plan que se activa.

---

## 5. Objeciones más comunes y cómo responderlas

**"Ya me arreglo con WhatsApp/Excel, funciona bien."**
Funciona hasta que dos clientes reservan el mismo horario, o hasta que alguien de tu equipo se olvida de anotar un turno en la planilla compartida. El costo no se ve en la planilla — se ve en el tiempo que perdés confirmando a mano y en los turnos que se pisan o se pierden. Turneo hace eso imposible a nivel de sistema: dos reservas para el mismo horario no pueden coexistir, es una regla de la base de datos, no una promesa.

**"Es caro" / "¿Cuánto sale?"**
Los planes se arman según el tamaño real del negocio (desde 1 profesional hasta equipos grandes) — no es un precio único para todos. *(Nota interna: el precio final de cada plan todavía no está definido formalmente — ver Anexo A. No cotizar un número fijo sin confirmarlo antes con el equipo comercial.)*

**"Mis clientes son grandes, no van a reservar solos por internet."**
Es al revés: sacarles la fricción de tener que llamar o escribir y esperar respuesta es lo que más valoran. El sistema está pensado para que reservar lleve menos de un minuto desde el celular, sin registrarse con contraseña.

**"¿Qué pasa si se cae el sistema o pierdo mis datos?"**
Los datos de cada negocio están completamente aislados de los demás negocios en la plataforma — ni siquiera a nivel de error un negocio puede ver los datos de otro. Y si el negocio prefiere no depender de que el sistema esté compartido con otros clientes, existe la opción de licencia propia (ver Anexo B) — mismo sistema, corriendo solo para ese negocio.

**"Ya tengo un sistema de turnos."**
La pregunta correcta es qué hace ese sistema además de mostrar un calendario. Turneo además administra el equipo completo con agendas propias, arma la ficha de cada cliente con su historial real, controla la caja del día, y manda recordatorios y campañas de reactivación solo. Si el sistema actual solo agenda, cambiar tiene sentido.

**"¿Puedo pasar mis datos actuales (clientes, turnos)?"**
Hoy no hay un importador automático de otros sistemas — la carga inicial se coordina caso a caso con el equipo. No prometer una migración "automática" que no existe.

**"Necesito manejar varias sucursales."**
Se puede conversar, pero hay que ser honestos: hoy la sucursal existe como concepto en el sistema pero no filtra la agenda todavía — cada sucursal separada real es, hoy, un desarrollo adicional (ver Anexo A). No cerrar esto como "ya funciona".

**"¿Tengo que instalar algo?"**
No. Es 100% web — el dueño, el equipo y los clientes acceden desde el navegador, en la computadora o el celular, sin instalar nada.

**"No quiero que un empleado nuevo vea toda la facturación o pueda borrar cosas."**
No tiene que verlo todo. El dueño le crea una cuenta con acceso limitado y elige exactamente qué módulos puede ver, cargar, editar o eliminar — un empleado de caja puede tener acceso solo a Caja y Turnos, por ejemplo, sin tocar Servicios ni Clientes.

---

## 6. Argumentos de venta (los diferenciadores reales)

Cada uno de estos está construido y verificado — no es aspiracional. Usar como ganchos de video/ads, cada uno es un mensaje en sí mismo.

1. **Multi-profesional de verdad.** No es un calendario compartido: cada profesional tiene su propia agenda, sus propios horarios y sus propios turnos — visible en una vista semanal/diaria por columnas, con arrastrar y soltar para reprogramar.
2. **Imposible que se pisen dos turnos.** La protección contra doble reserva está a nivel de base de datos, no solo de la pantalla — ni con dos personas reservando al mismo tiempo desde dos celulares distintos puede pasar.
3. **Un panel, no seis herramientas sueltas.** Agenda + equipo + servicios + clientes + caja + estadísticas + automatizaciones, todo en el mismo lugar, con los mismos datos (nada de exportar de un lado a mano para cargar en otro).
4. **CRM real de clientes.** Ficha completa por cliente: cumpleaños, Instagram, notas, fotos, profesional favorito, e historial completo de lo que se hizo en cada visita (servicios, productos usados, fotos de antes/después, lo que pagó).
5. **Caja con control real de efectivo.** Apertura y cierre de caja diaria, cobros en efectivo/transferencia, señas, devoluciones, y reconciliación automática (si lo contado no coincide con lo esperado, el sistema lo muestra) — más caja mensual con el total agregado de todos los medios de cobro, incluyendo lo cobrado online.
6. **Reactivación de clientes sin trabajo manual.** Reglas automáticas que detectan un cliente que dejó de venir o que está por cumplir años, y le mandan un mensaje por WhatsApp y/o email solo — sin que nadie tenga que acordarse de hacerlo.
7. **Notificaciones que no dependen de que alguien se acuerde.** Recordatorio automático 24hs antes del turno, con reintento si el primer envío falla.
8. **Cobros y señas online.** Integración con Mercado Pago para que el cliente pueda pagar o dejar una seña al reservar, sin que el negocio tenga que perseguirlo.
9. **Seguridad de nivel profesional, no de proyecto chico.** Contraseñas encriptadas, sesiones seguras, límites de intentos contra ataques de fuerza bruta, y aislamiento total de datos entre negocios distintos que usan la plataforma.
10. **Probado, no prometido.** El sistema tiene una suite real de tests automatizados (más de 75 pruebas de integración contra una base de datos real, más pruebas end-to-end que simulan un usuario real navegando el sitio) — cada feature de este manual se puede demostrar funcionando, no es una lista de intenciones.
11. **Un mismo sistema, tres formas de comprarlo.** El negocio puede pagar una suscripción mensual (SaaS), comprar el software una vez y correrlo por su cuenta (Licencia), o pedir un desarrollo a medida (Custom) — sin que eso signifique un producto distinto ni funcionalidades recortadas artificialmente entre una opción y otra.
12. **Nace de un caso real, no de una idea de escritorio.** El origen automotriz y el salón de belleza que corre en producción hoy son la prueba de que el sistema fue construido resolviendo un negocio real primero.
13. **Acceso del equipo a medida, no todo o nada.** El dueño no tiene que elegir entre darle a un empleado el mismo acceso que a un socio o no darle acceso al sistema — puede crearle una cuenta con permiso solo sobre los módulos que necesita (por ejemplo, caja y turnos, sin poder tocar servicios ni eliminar clientes), eligiendo módulo por módulo si puede ver, cargar, editar o eliminar.

---

## 7. Biblioteca de problemas y soluciones

### HOY — Belleza (implementado, probado, se puede vender y demostrar)

#### Reservas y agenda

**Problema:** el negocio pierde horas contestando WhatsApp para dar y confirmar turnos, y aun así se pisan reservas cuando hay más de una persona anotando a mano.
**Solución:** el cliente reserva solo desde la web, 24/7, eligiendo servicio, profesional (o "sin preferencia") y horario, con confirmación inmediata. La reserva queda protegida contra doble booking a nivel de base de datos.
**Resultado:** cero llamados para coordinar un turno, cero turnos duplicados.

#### Reservas manuales (mostrador / teléfono)

**Problema:** no todos los clientes reservan solos por la web — muchos llaman o se acercan directo al mostrador, y cargar ese turno a mano no debería significar volver a escribir los datos del cliente si ya está en la ficha, ni que esa reserva quede en un papel aparte del sistema.
**Solución:** el equipo reserva cualquier turno libre directo desde el calendario o desde el panel principal, eligiendo un cliente ya registrado (el sistema autocompleta sus datos) o cargando uno nuevo — que además queda guardado automáticamente en su ficha de cliente, sin tener que cargarlo dos veces por separado.
**Resultado:** un solo lugar para reservar, sea cliente nuevo o de siempre, sin doble carga de datos ni reservas que se escapan del sistema.

#### Equipo / Profesionales

**Problema:** con varios profesionales trabajando a la vez, coordinar quién está libre y cuándo es un caos de agendas separadas (o una sola compartida donde todos escriben encima).
**Solución:** cada profesional se da de alta con su especialidad, color de calendario, horario semanal y comisión; tiene su propio login para ver y gestionar solo su propia agenda.
**Resultado:** el dueño administra el equipo completo desde un solo lugar; cada profesional ve exactamente lo suyo, nada más.

#### Permisos por rol (control de acceso del equipo)

**Problema:** no todo el personal debería ver o poder tocar todo el sistema — un empleado de caja no necesita poder borrar servicios, y el dueño no siempre quiere darle a alguien nuevo el mismo acceso que a un socio.
**Solución:** además del profesional (que solo ve su propia agenda) y del dueño (acceso total), se pueden crear cuentas de acceso limitado a las que el dueño les asigna, módulo por módulo del panel (turnos, clientes, servicios, caja, etc.), si pueden ver, cargar, editar o eliminar.
**Resultado:** el dueño delega tareas del día a día sin resignar control sobre el resto del negocio.

#### Agenda visual

**Problema:** ver de un vistazo quién tiene hueco libre hoy, o mover un turno cuando un cliente pide cambiar de horario, es lento si hay que buscarlo a mano en una planilla o cuaderno.
**Solución:** calendario visual con vistas de Mes, Semana y Día, columnas por profesional con colores propios, y reprogramación arrastrando el turno a otro horario.
**Resultado:** reprogramar un turno lleva segundos, no una llamada de ida y vuelta.

#### Servicios

**Problema:** no todos los servicios duran lo mismo ni necesitan el mismo tiempo de preparación entre uno y otro, y eso es difícil de reflejar en una agenda simple.
**Solución:** cada servicio tiene categoría, duración, tiempo de buffer, precio, color, orden de visualización, y los profesionales que lo ofrecen.
**Resultado:** la agenda respeta los tiempos reales del negocio, no un bloque genérico de "30 minutos" para todo.

#### Clientes (CRM)

**Problema:** la información de cada cliente vive dispersa — en la cabeza del profesional que lo atiende, en una libreta, en chats de WhatsApp viejos.
**Solución:** ficha completa por cliente (cumpleaños, Instagram, notas, fotos, profesional favorito) con historial real de cada visita.
**Resultado:** cualquier profesional del equipo puede atender a un cliente con contexto completo, no solo quien lo atendió la última vez.

#### Historial por turno

**Problema:** no queda registro de qué productos o servicios se usaron realmente en cada turno, ni fotos de antes/después para mostrar resultados.
**Solución:** cada turno guarda el detalle de servicios y productos utilizados (con precio y cantidad), fotos de antes/después, y el pago asociado.
**Resultado:** trazabilidad real de cada trabajo hecho — útil tanto para el negocio como para mostrarle resultados al cliente.

#### Caja

**Problema:** cerrar la caja del día a mano, sumando papelitos y transferencias, es lento y propenso a error — y es difícil saber si "falta" o "sobra" plata sin un registro ordenado.
**Solución:** apertura y cierre de caja diaria, registro de cobros (efectivo/transferencia), señas, devoluciones y movimientos manuales, con cálculo automático de cuánto efectivo debería haber vs. lo que realmente se contó. Caja mensual con el total agregado, incluyendo lo cobrado online.
**Resultado:** control financiero real del día a día, sin planilla de Excel paralela.

#### Automatizaciones (reactivación de clientes)

**Problema:** los clientes que dejan de venir se pierden en silencio — nadie tiene tiempo de revisar quién no volvió hace 45 días y escribirle.
**Solución:** reglas automáticas que detectan clientes inactivos o próximos a cumplir años, y les mandan un mensaje por WhatsApp y/o email solas, con un mensaje personalizable y control de que no se les escriba dos veces seguidas.
**Resultado:** recuperación de clientes que se estaban por perder, sin que nadie tenga que acordarse de hacerlo a mano.

#### Notificaciones

**Problema:** los "olvidos" de turno (el cliente que no aparece) cuestan tiempo y plata al negocio.
**Solución:** recordatorio automático por WhatsApp/email antes del turno, con reintento si el primer envío falla.
**Resultado:** menos ausencias, sin que el negocio tenga que mandar el recordatorio a mano.

#### Pagos y señas

**Problema:** cobrar una seña para asegurar que el cliente no falte implica coordinar una transferencia a mano, con capturas de pantalla como comprobante.
**Solución:** cobro de seña o pago completo online al momento de reservar, vía Mercado Pago.
**Resultado:** menos ausencias sin aviso, cobro asegurado antes del turno.

#### Estadísticas

**Problema:** el dueño no sabe, sin sentarse a calcular a mano, cuánto facturó el mes, qué servicio vende más, o qué profesional está más ocupado.
**Solución:** dashboards de facturación, clientes nuevos vs. recurrentes, servicios más vendidos, y por cada profesional: ventas, horas ocupadas/libres, % de ocupación y ausencias.
**Resultado:** decisiones de negocio (a quién darle más turnos, qué servicio empujar) basadas en datos reales, no en percepción.

---

### MAÑANA — Multi-rubro (visión de producto, roadmap, no vender como disponible)

Turneo está **construido para expandirse a cualquier rubro con lógica de turnos** sin reescribir el sistema — es una decisión de arquitectura, no una promesa de marketing: el núcleo del sistema (turnos, agenda, profesionales, servicios, pagos) es agnóstico de rubro, y cada rubro se agrega como una extensión sin tocar esa base. Esto es un argumento de venta legítimo para negocios que preguntan por escalabilidad futura, siempre y cuando se comunique como lo que es: **arquitectura lista, módulos sin construir todavía.**

| Rubro | Problema típico que resolvería | Estado |
|---|---|---|
| Detailing automotriz (origen del proyecto) | Coordinar turnos de servicios de duración variable con uno o varios boxes de trabajo | Roadmap — carpeta reservada, sin código |
| Gimnasios | Turnos de clases con cupo limitado, control de asistencia | Roadmap — carpeta reservada, sin código |
| Consultorios / salud | Turnos por profesional con historia clínica asociada | Roadmap — carpeta reservada, sin código |
| Veterinarias | Turnos con ficha de la mascota, no solo del dueño | Roadmap — carpeta reservada, sin código |
| Restaurantes | Reserva de mesas con franjas horarias, no turnos 1 a 1 | Roadmap — carpeta reservada, sin código |

**Cómo hablar de esto en una venta:** es correcto decir *"el sistema está preparado para crecer a otros rubros sin tener que empezar de cero"* — es verdad, es una fortaleza real de la arquitectura. No es correcto decir *"tenemos una versión para gimnasios/veterinarias"* — no existe. Un pedido en cualquiera de estos rubros hoy es un proyecto Custom que se cotiza aparte.

---

## Anexo A — Estado real del producto (guía interna, no para el cliente)

Tabla de referencia rápida para no prometer de más en una llamada de venta.

### ✅ Se puede prometer y demostrar hoy

Todo lo listado en la sección 7 "HOY": reservas públicas 24/7, anti doble-reserva, reserva manual desde el equipo (mostrador/teléfono) con cliente existente o nuevo y alta automática en el CRM, multi-profesional con agenda propia, agenda visual (mes/semana/día, drag&drop), servicios con categorías/buffer/precio, CRM de clientes, historial por turno con productos/fotos/pago, caja diaria y mensual con reconciliación, automatizaciones de reactivación/cumpleaños, recordatorios automáticos multicanal, pagos y señas por Mercado Pago, estadísticas generales y por profesional, aislamiento total de datos entre negocios (multi-tenant), autenticación y roles (Admin, Profesional, Staff con permisos granulares por módulo, Cliente), panel 100% web sin instalación.

### 🟡 Con matices — aclarar antes de cerrar

- **Varias sucursales:** existe el concepto de "sucursal" en el sistema, pero todavía no filtra la agenda ni los turnos por sucursal — hoy es, en la práctica, un solo local por negocio. Ofrecerlo como "en desarrollo, coordinable como proyecto adicional", nunca como ya disponible.
- **Personalización visual de marca (colores propios del negocio):** el dato existe en el sistema pero el sitio público todavía no lo aplica automáticamente — hoy la marca del negocio se refleja principalmente vía logo y contenido, no colores propios.
- **Límites de plan para WhatsApp/IA:** hoy estas banderas no bloquean nada automáticamente aunque el plan no las incluya — el enforcement real de plan solo está activo para la cantidad de profesionales. No usar "tu plan no incluye IA" como argumento técnico de bloqueo todavía.
- **Cobros reales con Mercado Pago:** el flujo funciona para demo y señas; antes de activar cobros reales de producción hay un pendiente de seguridad conocido (validación de firma del webhook) que el equipo técnico tiene identificado y diferido a propósito, no olvidado. Confirmar con el equipo técnico antes de vender "ya está listo para procesar pagos reales en producción" a un cliente que va a facturar en serio.
- **Dominio propio por negocio (subdominio, ej. `salon.Turneo.app`):** el mecanismo está construido y probado, pero falta la configuración final de DNS en producción — hoy en producción se resuelve por otro medio (ver equipo técnico antes de prometer un subdominio propio andando el mismo día).
- **Permisos por rol (Staff):** el control de acceso granular por módulo está construido y compila/corre — se verificó con llamadas reales (crear cuenta, asignar permisos) que responden correctamente, pero la última verificación (loguearse como esa cuenta y confirmar que el sistema efectivamente bloquea una acción sin permiso) quedó pendiente de cerrar, y todavía no tiene tests automatizados dedicados como el resto del sistema. Se puede mostrar la pantalla de gestión de permisos, pero confirmar con el equipo técnico el estado del enforcement antes de venderlo como cerrado a un cliente que dependa fuerte de ese control (ej. franquicias con varios encargados).

### ⏳ No prometer — es roadmap, no producto

- Cualquier rubro que no sea belleza (gimnasios, salud, veterinarias, restaurantes, automotriz) como producto ya disponible — son carpetas vacías en el código, sin una sola funcionalidad construida. Se puede ofrecer como proyecto Custom, nunca como "ya lo tenemos".
- Membresías y catálogo de productos con stock dentro del módulo Belleza (más allá del catálogo simple ya usado por Caja) — sin definir ni construir.
- Precio fijo y público por plan — los límites de cada plan (cantidad de profesionales, turnos, etc.) sí están definidos, pero el precio en pesos de cada plan todavía es una decisión de negocio pendiente. No cotizar un número sin confirmarlo antes.
- Importación automática de datos desde otro sistema (Excel, otro turnero) — se coordina manualmente caso a caso, no hay una herramienta de "subí tu Excel y listo".

---

## Anexo B — Modelos comerciales y planes

Turneo se vende de tres formas distintas, **sobre exactamente el mismo software** — no hay una versión recortada según cómo se compra:

| Modelo | Cómo funciona | Para qué cliente |
|---|---|---|
| **SaaS (suscripción)** | El negocio paga una suscripción mensual/anual y usa una instancia compartida del sistema, con sus datos completamente aislados de otros negocios | La mayoría de los negocios — no quieren manejar infraestructura propia |
| **Licencia perpetua** | El cliente compra el software una vez y lo corre en su propia infraestructura, como si fuera el único negocio en el sistema | Negocios que prefieren no depender de una plataforma compartida, o con requisitos propios de dónde viven sus datos |
| **Desarrollo a medida (Custom)** | Desarrollo específico sobre la misma base, para necesidades que no cubre un plan estándar (ej. un rubro nuevo, una integración puntual) | Clientes grandes o con necesidades muy particulares |

### Planes (según cantidad de profesionales y funcionalidades)

| Plan | Profesionales | Turnos/mes | WhatsApp | Automatización/IA |
|---|---|---|---|---|
| Starter | 1 | 50 | No | No |
| Pro | Hasta 5 | 500 | Sí | No |
| Premium | Hasta 15 | 2.000 | Sí | Sí |
| Enterprise | Sin límite | Sin límite | Sí | Sí |

*Los precios de cada plan todavía no están definidos formalmente — se cotizan hoy caso a caso con el equipo comercial. No usar esta tabla para dar un número en una llamada sin confirmarlo antes.*

---

## Guía de tono para producción de contenido

Para quien use este manual para escribir un guion de video, un anuncio, una landing o una presentación:

1. **Empezar siempre por el dolor real, no por la lista de funcionalidades.** El gancho es "¿todavía confirmás turnos por WhatsApp a mano?", no "Turneo tiene 8 módulos".
2. **Un problema, una solución, un resultado por pieza.** Usar la estructura de la sección 7 — no tratar de mostrar todo el sistema en un solo video de 30 segundos.
3. **Mostrar, no describir, cuando se pueda.** El sistema es visual (agenda con drag&drop, caja, CRM) — screen recordings reales pesan más que texto sobre fondo de color.
4. **El caso real es el activo más fuerte que hay.** El salón de belleza que corre en producción hoy es prueba de que esto funciona en el mundo real, no en una demo armada — priorizarlo sobre features abstractas.
5. **Nunca mostrar como disponible lo que está en el Anexo A como 🟡 o ⏳.** Ninguna pieza de marketing debería sugerir multi-sucursal activa, otros rubros, o precios sin haberlos confirmado antes con el equipo.
6. **Hablarle al dueño del negocio, no al programador.** Cero jerga técnica (nada de "API", "multi-tenant", "backend") en cualquier pieza dirigida al cliente final — esos términos son para este manual y para el equipo interno, no para el copy público.
