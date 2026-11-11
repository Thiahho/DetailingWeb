# Manual Comercial — Turneo

**Versión:** 1.3 · **Fecha:** noviembre 2026 · **Rama de referencia:** `TurneoDV2-Belleza` (ver "Qué cambió en esta versión" abajo)
**Uso:** documento base para todo el equipo comercial y de marketing — guiones de video, anuncios, copy de landing/web, presentaciones a clientes y respuestas a objeciones. Toda pieza de comunicación nueva debería poder trazarse a algo de este documento.

**Regla de oro de este manual:** todo lo que está en la sección 7 ("HOY") es real, está construido y verificado — se puede vender y mostrar sin miedo. Todo lo marcado como roadmap o "MAÑANA" **no existe en código todavía** — es visión de producto, no una promesa a un cliente. El Anexo A es la referencia rápida para no cruzar esa línea en una llamada de venta.

---

## Qué cambió en esta versión (v1.2 → v1.3)

Revisión hecha contra el código de la rama `TurneoDV2-Belleza` y las auditorías del 01/09 al 07/10/2026.

**Nuevo y vendible:**
- **Servicios a domicilio:** el negocio define en qué localidades atiende (con recargo opcional por zona), el cliente carga su dirección al reservar y el sistema deja tiempo de traslado entre dos turnos a domicilio.
- **Duración real de los servicios:** un servicio de 3 horas bloquea las 3 horas de la agenda del profesional, no solo el horario donde empieza. Abre la puerta a rubros con turnos largos, como el detailing.
- **Promociones por profesional:** cada profesional crea descuentos automáticos (porcentaje o monto fijo, con fechas) sobre sus servicios; el cliente ve el precio tachado y el precio final.
- **Turnos pagos protegidos:** un turno ya pagado no se puede cancelar ni editar desde la web pública; el admin lo cancela con devolución registrada en caja.
- **Reprogramar entre profesionales:** al mover un turno a la agenda de otro profesional, el turno pasa a ser de ese profesional.
- **Modo solo:** un profesional independiente usa el sistema sin tener que darse de alta como "empleado" de su propio negocio.
- **Smart Tags:** ahora se mide si cada interacción vino por NFC o por QR, y cada reserva queda atribuida a la etiqueta y al canal que la originó.
- **Insumos con stock y costo unitario**, vinculados a los servicios (en v1.2 figuraba como "sin construir").
- Redes sociales del negocio configurables desde el panel, acciones masivas (selección múltiple) en los listados del admin, aviso de cookies, y rediseño del detalle de reserva.
- **Permisos por rol (Staff):** ahora tienen tests automatizados que confirman el bloqueo de acciones sin permiso.
- **Recordatorio por email:** confirmado funcionando en producción (antes no llegaba), y se corrigió un bucle que duplicaba emails.
- **Límites de plan:** ahora se controlan muchos más que la cantidad de profesionales (ver Anexo A).

**Pasó de "vendible" a "con matices":**
- **Cobros y señas por Mercado Pago:** el código está listo y endurecido. Valida la firma del webhook, el monto lo decide el servidor y solo se confirma un pago si el importe y la moneda coinciden. Pero los pagos están **desactivados** en la configuración, así que ya no se vende como disponible hoy.
- **Mensajes automáticos por WhatsApp:** no hay ninguna plantilla de WhatsApp aprobada todavía. Hoy, lo que funciona en producción de punta a punta es el **email**.

**Corregido:**
- La cantidad de tests: de "más de 75" a la cifra actual (sección 6).
- El dominio del salón en producción, que ahora es `turneobelleza.com`.
- El detailing automotriz deja de ser "sin código": hoy se puede atender con servicios a domicilio y turnos largos, aunque todavía sin las funciones propias del rubro (sección 7, "Mañana").

**Diferencia con la rama `TurnosP-Belleza`:** allá la landing ya muestra Smart Tags como función disponible. En esta rama todavía aparecen como "Próximamente", hasta que se traiga ese cambio.

**Qué se mantuvo sin cambios:**
- **La grilla de planes y precios del Anexo B**, a pedido explícito: precios, nombres, límites y la promo "Pagá 10, usá 12". Abajo de la grilla se agrega una advertencia, porque el catálogo cargado en el sistema hoy no coincide con ella.
- La identidad de marca, el mensaje central, las audiencias, los perfiles de cliente, el roadmap multi-rubro y la guía de tono.
- El canal de contacto (WhatsApp +54 11 2269-2061) y la decisión de no publicar precios en la landing.

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

La identidad visual de cada negocio que usa Turneo es propia de ese negocio (logo, contenido, redes) — el sistema es white-label por diseño. La identidad de **Turneo como producto/marca comercial** todavía no tiene un sistema visual formal definido — es el primer paso natural después de este manual: paleta, tipografía y logo propios de Turneo, separados de cualquier cliente.

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

- Un panel único para todo: equipo, agenda, servicios, insumos, clientes, caja y estadísticas — sin planillas sueltas ni WhatsApp desordenado.
- Deja de perder tiempo confirmando turnos a mano: el cliente reserva solo, 24/7.
- Ve la facturación, quién vende más, y qué clientes dejaron de venir — sin tener que armar el reporte a mano.
- Cambios del día a día (agregar un servicio, un profesional, ajustar un horario, actualizar sus redes) los hace él mismo, sin llamar a un programador.
- Si trabaja solo, el sistema se adapta: no tiene que armar un "equipo" de una persona para empezar a usarlo.

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

**Salones de belleza, estudios de estética, barberías, spas y negocios similares**, que hoy gestionan turnos por WhatsApp, Excel o agenda de papel. Señales de que es el cliente correcto:

- Tiene más de un profesional trabajando en simultáneo (el dolor de "agendas que se pisan" es real y frecuente) — o es un profesional independiente que pierde turnos por no contestar a tiempo.
- El dueño o un encargado pierde tiempo real todos los días confirmando/reagendando turnos a mano.
- No tiene visibilidad clara de facturación, qué servicio vende más, o qué clientes dejaron de volver.
- Ya usa WhatsApp Business o similar, así que no hay que venderle la idea de "digitalizarse" — hay que venderle dejar de hacerlo a mano.

### Segmentación por tamaño (mapea directo a los planes, ver Anexo B)

| Tamaño del negocio | Plan sugerido | Necesidad dominante |
|---|---|---|
| 1 profesional (independiente) | Starter | Dejar de perder turnos por WhatsApp, agenda simple — hoy con "modo solo" |
| Equipo chico (2-5 profesionales) | Pro | Coordinar varias agendas + notificaciones automáticas |
| Equipo mediano (hasta 15) | Premium | Todo lo anterior + automatizaciones, mayor volumen de turnos |
| Cadena / franquicia / varios locales | Enterprise | Sin límites, identidad de marca propia — **hoy con matices, ver Anexo A** |

### Perfil secundario — negocios en crecimiento

Negocios de un solo local que están por abrir una segunda sucursal o escalar el equipo. Hoy se les puede vender el crecimiento del equipo; la gestión real de **varias sucursales en una sola agenda** todavía no está conectada (ver Anexo A) — no cerrar ese punto sin aclarar que implica desarrollo adicional.

### Perfil en apertura — servicios a domicilio y turnos largos

Negocios que van a la casa del cliente o que tienen servicios de varias horas: **detailing automotriz** (el rubro de donde nació el proyecto), estética o peluquería a domicilio, y servicios similares. Hoy se les puede vender la base completa más servicios a domicilio con zona de cobertura y duración real de cada servicio. Lo que todavía **no** existe para ellos: ficha del vehículo, presupuesto antes de reservar y optimización de recorridos. Si eso es central para el cliente, es un proyecto Custom.

### Perfil futuro — no vender todavía salvo a medida

Gimnasios, clínicas/consultorios, veterinarias y restaurantes. La arquitectura ya está pensada para esto (ver sección 7, "Mañana"), pero hoy no hay código propio de esos rubros — cualquier venta ahí es un proyecto **Custom** sobre la base existente, no un plan que se activa.

---

## 5. Objeciones más comunes y cómo responderlas

**"Ya me arreglo con WhatsApp/Excel, funciona bien."**
Funciona hasta que dos clientes reservan el mismo horario, o hasta que alguien de tu equipo se olvida de anotar un turno en la planilla compartida. El costo no se ve en la planilla — se ve en el tiempo que perdés confirmando a mano y en los turnos que se pisan o se pierden. Turneo hace eso imposible a nivel de sistema: dos reservas para el mismo horario no pueden coexistir, es una regla de la base de datos, no una promesa.

**"Es caro" / "¿Cuánto sale?"**
Los planes se arman según el tamaño real del negocio (desde 1 profesional hasta equipos grandes) — no es un precio único para todos. Arranca en $0 con el plan FREE y escala según cantidad de profesionales y funcionalidades (ver Anexo B). Pagando anual, son 2 meses gratis ("pagá 10, usá 12").

**"Trabajo sola/solo, no tengo equipo."**
No hace falta. Con un solo profesional, el sistema funciona en "modo solo": el dueño agenda y cobra directamente, sin selectores de profesional ni secciones de equipo que no necesita.

**"Mis clientes son grandes, no van a reservar solos por internet."**
Es al revés: sacarles la fricción de tener que llamar o escribir y esperar respuesta es lo que más valoran. El sistema está pensado para que reservar lleve menos de un minuto desde el celular, sin registrarse con contraseña. Y si igual llaman o se acercan al mostrador, el equipo carga el turno en el mismo sistema.

**"¿Qué pasa si se cae el sistema o pierdo mis datos?"**
Los datos de cada negocio están completamente aislados de los demás negocios en la plataforma — ni siquiera a nivel de error un negocio puede ver los datos de otro. Y si el negocio prefiere no depender de que el sistema esté compartido con otros clientes, existe la opción de licencia propia (ver Anexo B) — mismo sistema, corriendo solo para ese negocio.

**"Ya tengo un sistema de turnos."**
La pregunta correcta es qué hace ese sistema además de mostrar un calendario. Turneo además administra el equipo completo con agendas propias, arma la ficha de cada cliente con su historial real, controla la caja del día y los insumos, y manda recordatorios y campañas de reactivación solo. Si el sistema actual solo agenda, cambiar tiene sentido.

**"¿Me avisa a los clientes por WhatsApp?"**
Hoy los recordatorios y las campañas automáticas salen por **email**, confirmado en producción. El envío automático por WhatsApp depende de que Meta apruebe las plantillas de mensaje, y eso todavía está en trámite — no prometerlo como activo (ver Anexo A).

**"¿Puedo cobrar la seña online?"**
La integración con Mercado Pago está construida, pero hoy no está activada para cobros reales. Ofrecerla como "próxima a habilitarse, se coordina con el equipo", nunca como lista para usar (ver Anexo A).

**"¿Puedo pasar mis datos actuales (clientes, turnos)?"**
Hoy no hay un importador automático de otros sistemas — la carga inicial se coordina caso a caso con el equipo. No prometer una migración "automática" que no existe.

**"Necesito manejar varias sucursales."**
Se puede conversar, pero hay que ser honestos: hoy la sucursal existe como concepto en el sistema pero no filtra la agenda todavía — cada sucursal separada real es, hoy, un desarrollo adicional (ver Anexo A). No cerrar esto como "ya funciona".

**"¿Tengo que instalar algo?"**
No. Es 100% web — el dueño, el equipo y los clientes acceden desde el navegador, en la computadora o el celular, sin instalar nada.

**"No quiero que un empleado nuevo vea toda la facturación o pueda borrar cosas."**
No tiene que verlo todo. El dueño le crea una cuenta con acceso limitado y elige exactamente qué módulos puede ver, cargar, editar o eliminar — un empleado de caja puede tener acceso solo a Caja y Turnos, por ejemplo, sin tocar Servicios ni Clientes. El sistema bloquea lo que no tiene permitido.

---

## 6. Argumentos de venta (los diferenciadores reales)

Cada uno de estos está construido y verificado — no es aspiracional. Usar como ganchos de video/ads, cada uno es un mensaje en sí mismo.

1. **Multi-profesional de verdad.** No es un calendario compartido: cada profesional tiene su propia agenda, sus propios horarios y sus propios turnos — visible en una vista semanal/diaria por columnas, con arrastrar y soltar para reprogramar.
2. **Imposible que se pisen dos turnos.** La protección contra doble reserva está a nivel de base de datos, no solo de la pantalla — ni con dos personas reservando al mismo tiempo desde dos celulares distintos puede pasar.
3. **Un panel, no seis herramientas sueltas.** Agenda + equipo + servicios + insumos + clientes + caja + estadísticas + automatizaciones, todo en el mismo lugar, con los mismos datos (nada de exportar de un lado a mano para cargar en otro).
4. **CRM real de clientes.** Ficha completa por cliente: cumpleaños, Instagram, notas, fotos, profesional favorito, e historial completo de lo que se hizo en cada visita (servicios, productos usados, fotos de antes/después, lo que pagó).
5. **Caja con control real de efectivo.** Apertura y cierre de caja diaria, cobros en efectivo/transferencia, señas, devoluciones, y reconciliación automática (si lo contado no coincide con lo esperado, el sistema lo muestra) — más caja mensual con el total agregado de todos los medios de cobro.
6. **Reactivación de clientes sin trabajo manual.** Reglas automáticas que detectan un cliente que dejó de venir o que está por cumplir años, y le mandan un mensaje solo — sin que nadie tenga que acordarse de hacerlo. Hoy por email; WhatsApp cuando se aprueben las plantillas.
7. **Notificaciones que no dependen de que alguien se acuerde.** Recordatorio automático 24hs antes del turno, con reintento si el primer envío falla — confirmado llegando por email en producción.
8. **Sirve igual para el que trabaja solo.** Con "modo solo", un profesional independiente usa el sistema completo sin configurar un equipo que no tiene.
9. **Seguridad de nivel profesional, no de proyecto chico.** Contraseñas encriptadas, sesiones seguras, límites de intentos contra ataques de fuerza bruta, aislamiento total de datos entre negocios, y auditorías de seguridad periódicas.
10. **Probado, no prometido.** El sistema tiene más de 500 pruebas automatizadas de backend contra una base de datos real (532 en la última corrida completa, todas en verde), 175 pruebas de frontend y 20 recorridos end-to-end que simulan a un usuario real navegando el sitio — cada feature de la sección 7 se puede demostrar funcionando, no es una lista de intenciones.
11. **Un mismo sistema, tres formas de comprarlo.** El negocio puede pagar una suscripción mensual (SaaS), comprar el software una vez y correrlo por su cuenta (Licencia), o pedir un desarrollo a medida (Custom) — sin que eso signifique un producto distinto.
12. **Nace de un caso real, no de una idea de escritorio.** El origen automotriz y el salón de belleza que corre en producción hoy son la prueba de que el sistema fue construido resolviendo un negocio real primero.
13. **Acceso del equipo a medida, no todo o nada.** El dueño puede crearle a un empleado una cuenta con permiso solo sobre los módulos que necesita, eligiendo módulo por módulo si puede ver, cargar, editar o eliminar — y el sistema bloquea el resto.
14. **Convierte una etiqueta física en una acción digital medible.** Etiquetas NFC o QR que el negocio pega en el mostrador, el espejo o la salida: un cliente acerca el celular o escanea, y el sistema lo lleva directo a reservar, volver a reservar su último servicio, o dejar una reseña. El dueño mide, etiqueta por etiqueta y canal por canal (NFC vs. QR), cuántas interacciones se convirtieron en reserva o en reseña — y cada reserva queda marcada con la etiqueta que la generó.
15. **La agenda respeta lo que dura cada servicio.** Un servicio de 3 horas ocupa 3 horas: nadie puede reservar encima, ni desde la web ni desde el mostrador, y la base de datos lo impide aunque dos personas reserven al mismo tiempo.
16. **También para los que van a domicilio.** El negocio marca qué servicios son a domicilio, define las localidades que cubre (con recargo opcional) y el sistema deja tiempo de traslado entre turnos.
17. **Promociones sin cupones ni cuentas a mano.** Cada profesional arma sus propios descuentos con fecha de inicio y fin; el cliente ve el precio tachado y el sistema cobra y registra el precio final.

---

## 7. Biblioteca de problemas y soluciones

### HOY — Belleza (implementado, verificado, se puede vender y demostrar)

#### Reservas y agenda

**Problema:** el negocio pierde horas contestando WhatsApp para dar y confirmar turnos, y aun así se pisan reservas cuando hay más de una persona anotando a mano.
**Solución:** el cliente reserva solo desde la web, 24/7, eligiendo servicio, profesional (o "sin preferencia") y horario, con confirmación inmediata. La reserva queda protegida contra doble booking a nivel de base de datos.
**Resultado:** cero llamados para coordinar un turno, cero turnos duplicados.

#### Duración real de los servicios

**Problema:** un servicio largo (un tratamiento de 3 horas, un detailing completo) ocupa en la agenda solo el horario donde empieza, y alguien puede reservar otro turno encima a mitad del trabajo.
**Solución:** cada servicio puede tener una duración en minutos. El turno ocupa ese rango completo en la agenda del profesional: la web solo ofrece horarios donde el servicio entra entero (por ejemplo "10:00 – 13:00"), los horarios del medio aparecen como "Ocupado" en el panel, y la base de datos rechaza cualquier turno superpuesto del mismo profesional.
**Resultado:** cero turnos encimados, aunque los servicios duren distinto.

#### Servicios a domicilio

**Problema:** los negocios que van a la casa del cliente coordinan por WhatsApp la dirección, si la zona les queda cerca y cuánto cobrar de más por traslado, y suelen calcular mal el tiempo entre un turno y otro.
**Solución:** cada servicio se marca como "en el local" o "a domicilio". El negocio arma su lista de localidades cubiertas, con recargo opcional por localidad. El cliente carga su dirección (con autocompletado o un link de Google Maps) al reservar, y el sistema rechaza direcciones fuera de zona y deja el tiempo de traslado configurado entre dos turnos a domicilio del mismo profesional.
**Resultado:** reservas a domicilio con dirección, zona y recargo resueltos antes del turno, sin ida y vuelta por chat.

#### Promociones por profesional

**Problema:** armar una promo hoy implica avisarle a cada cliente y acordarse de cobrar el precio rebajado a mano.
**Solución:** cada profesional crea promociones sobre sus servicios (porcentaje o monto fijo, con fecha de inicio y fin, pausables). La web muestra el precio original tachado y el precio final. Si hay varias promos activas, se aplica la de mayor descuento, sin acumular. El turno guarda el precio final para el cobro.
**Resultado:** promos que se aplican solas y se cobran bien, sin cupones ni cálculos a mano.

#### Turnos pagos protegidos

**Problema:** si un cliente ya pagó o dejó seña, cancelar o cambiar el turno sin control termina en devoluciones mal registradas.
**Solución:** un turno pagado no se puede cancelar desde la web pública, y un turno pagado o confirmado no se puede editar. El cliente pide la cancelación por WhatsApp, y el admin la hace desde el panel con la devolución registrada en caja, sin posibilidad de devolver dos veces.
**Resultado:** la plata cobrada siempre cierra con lo que pasó con el turno.

#### Reservas manuales (mostrador / teléfono)

**Problema:** no todos los clientes reservan solos por la web — muchos llaman o se acercan directo al mostrador, y cargar ese turno a mano no debería significar volver a escribir los datos del cliente si ya está en la ficha, ni que esa reserva quede en un papel aparte del sistema.
**Solución:** el equipo reserva cualquier turno libre directo desde el calendario o desde el panel principal, eligiendo un cliente ya registrado (el sistema autocompleta sus datos) o cargando uno nuevo — que además queda guardado automáticamente en su ficha de cliente.
**Resultado:** un solo lugar para reservar, sea cliente nuevo o de siempre, sin doble carga de datos ni reservas que se escapan del sistema.

#### Modo solo (profesional independiente)

**Problema:** muchos sistemas obligan al que trabaja solo a configurarse como "empleado" de su propio negocio, con pantallas de equipo y selectores de profesional que no usa.
**Solución:** si el negocio no tiene profesionales cargados, el dueño opera directamente: agenda, cobra y ve su día trabajado sin selectores de profesional ni secciones de equipo y permisos.
**Resultado:** un independiente empieza a usar el sistema en minutos, y si después suma gente, activa el equipo sin cambiar de sistema.

#### Equipo / Profesionales

**Problema:** con varios profesionales trabajando a la vez, coordinar quién está libre y cuándo es un caos de agendas separadas (o una sola compartida donde todos escriben encima).
**Solución:** cada profesional se da de alta con su especialidad, color de calendario, horario semanal y comisión; tiene su propio login para ver y gestionar solo su propia agenda.
**Resultado:** el dueño administra el equipo completo desde un solo lugar; cada profesional ve exactamente lo suyo, nada más.

#### Permisos por rol (control de acceso del equipo)

**Problema:** no todo el personal debería ver o poder tocar todo el sistema — un empleado de caja no necesita poder borrar servicios, y el dueño no siempre quiere darle a alguien nuevo el mismo acceso que a un socio.
**Solución:** además del profesional (que solo ve su propia agenda) y del dueño (acceso total), se pueden crear cuentas de acceso limitado a las que el dueño les asigna, módulo por módulo del panel (turnos, clientes, servicios, caja, etc.), si pueden ver, cargar, editar o eliminar. El bloqueo de lo no permitido está cubierto por tests automatizados.
**Resultado:** el dueño delega tareas del día a día sin resignar control sobre el resto del negocio.

#### Agenda visual

**Problema:** ver de un vistazo quién tiene hueco libre hoy, o mover un turno cuando un cliente pide cambiar de horario, es lento si hay que buscarlo a mano en una planilla o cuaderno.
**Solución:** calendario visual con vistas de Mes, Semana y Día, columnas por profesional con colores propios, y reprogramación arrastrando el turno a otro horario. Si se arrastra a la columna de otro profesional, el turno pasa a ser suyo, siempre que tenga libre todo el rango. Incluye un detalle de reserva rediseñado para confirmar o gestionar el turno en un clic.
**Resultado:** reprogramar un turno lleva segundos, no una llamada de ida y vuelta.

#### Servicios

**Problema:** no todos los servicios duran lo mismo ni necesitan el mismo tiempo de preparación entre uno y otro, y eso es difícil de reflejar en una agenda simple.
**Solución:** cada servicio tiene categoría, duración, tiempo de buffer, precio, color, orden de visualización, los profesionales que lo ofrecen y los insumos que usa.
**Resultado:** la agenda respeta los tiempos reales del negocio, no un bloque genérico de "30 minutos" para todo.

#### Insumos (stock y costo)

**Problema:** el negocio no sabe cuánto producto le queda ni cuánto le cuesta cada insumo hasta que se queda sin stock en medio de un turno.
**Solución:** listado de insumos con stock, umbral de stock bajo y costo unitario, vinculados a los servicios que los usan.
**Resultado:** el dueño ve qué insumos están por acabarse y cuánto le cuestan, sin una planilla aparte.

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
**Solución:** apertura y cierre de caja diaria, registro de cobros (efectivo/transferencia), señas, devoluciones y movimientos manuales, con cálculo automático de cuánto efectivo debería haber vs. lo que realmente se contó. Caja mensual con el total agregado de todos los medios de cobro.
**Resultado:** control financiero real del día a día, sin planilla de Excel paralela.

#### Automatizaciones (reactivación de clientes)

**Problema:** los clientes que dejan de venir se pierden en silencio — nadie tiene tiempo de revisar quién no volvió hace 45 días y escribirle.
**Solución:** reglas automáticas que detectan clientes inactivos o próximos a cumplir años, y les mandan un mensaje solas (hoy por email), con un mensaje personalizable y control de que no se les escriba dos veces seguidas.
**Resultado:** recuperación de clientes que se estaban por perder, sin que nadie tenga que acordarse de hacerlo a mano.

#### Notificaciones

**Problema:** los "olvidos" de turno (el cliente que no aparece) cuestan tiempo y plata al negocio.
**Solución:** recordatorio automático por email antes del turno, con reintento si el primer envío falla. Confirmado funcionando en producción.
**Resultado:** menos ausencias, sin que el negocio tenga que mandar el recordatorio a mano.

#### Smart Tag — etiquetas NFC/QR físicas

**Problema:** el negocio depende de que el cliente se acuerde de buscarlo en Google para reservar de nuevo o dejar una reseña — y esa dependencia se pierde apenas el cliente sale del local.
**Solución:** etiquetas NFC/QR físicas (mostrador, espejo, salida) que el dueño da de alta desde el panel, cada una con una acción propia: reservar, volver a reservar el último servicio, o dejar una reseña (con redirect directo a la ficha de Google Maps del negocio; el comentario queda guardado internamente para moderación). La acción se puede cambiar en cualquier momento sin reemplazar la etiqueta física. Cada interacción queda registrada con su canal (NFC o QR) y su conversión, y cada reserva queda atribuida a la etiqueta que la originó.
**Resultado:** un punto físico del local se convierte en un canal medible de reservas y reseñas, sin fricción para el cliente.

#### Reseñas propias

**Problema:** las opiniones de los clientes quedan en chats o en la memoria del dueño, y no ayudan a convencer a clientes nuevos.
**Solución:** el cliente deja una reseña (estrellas + comentario) desde la web o desde un Smart Tag; el dueño la aprueba en el panel antes de que se publique. Nada se publica sin revisión.
**Resultado:** prueba social en la propia web del negocio, con control total de lo que se muestra.

#### Sitio público del negocio

**Problema:** muchos negocios no tienen una web propia, o la tienen desconectada de su agenda.
**Solución:** cada negocio tiene su sitio con reserva online, equipo, local, reseñas y sus redes sociales (configurables desde el panel), con aviso de cookies incluido.
**Resultado:** una web que vende y agenda al mismo tiempo, que el dueño actualiza sin programador.

#### Estadísticas

**Problema:** el dueño no sabe, sin sentarse a calcular a mano, cuánto facturó el mes, qué servicio vende más, o qué profesional está más ocupado.
**Solución:** dashboards de facturación, clientes nuevos vs. recurrentes, servicios más vendidos, y por cada profesional: ventas, horas ocupadas/libres, % de ocupación y ausencias.
**Resultado:** decisiones de negocio (a quién darle más turnos, qué servicio empujar) basadas en datos reales, no en percepción.

#### Panel ágil para el día a día

**Problema:** limpiar o actualizar muchos registros uno por uno (clientes, servicios, turnos viejos) es tedioso.
**Solución:** selección múltiple con acciones masivas en los listados del panel.
**Resultado:** tareas de mantenimiento que antes llevaban minutos se resuelven en un par de clics.

---

### MAÑANA — Multi-rubro (visión de producto, roadmap, no vender como disponible)

Turneo está **construido para expandirse a cualquier rubro con lógica de turnos** sin reescribir el sistema — es una decisión de arquitectura, no una promesa de marketing: el núcleo del sistema (turnos, agenda, profesionales, servicios, pagos) es agnóstico de rubro, y cada rubro se agrega como una extensión sin tocar esa base. Esto es un argumento de venta legítimo para negocios que preguntan por escalabilidad futura, siempre y cuando se comunique como lo que es: **arquitectura lista, módulos sin construir todavía.**

| Rubro | Problema típico que resolvería | Estado |
|---|---|---|
| Detailing automotriz (origen del proyecto) | Coordinar turnos de servicios de duración variable, en el local o a domicilio | **Parcial** — ya hay servicios a domicilio y duración real; falta ficha del vehículo, presupuestos y boxes de trabajo |
| Gimnasios | Turnos de clases con cupo limitado, control de asistencia | Roadmap — carpeta reservada, sin código |
| Consultorios / salud | Turnos por profesional con historia clínica asociada | Roadmap — carpeta reservada, sin código |
| Veterinarias | Turnos con ficha de la mascota, no solo del dueño | Roadmap — carpeta reservada, sin código |
| Restaurantes | Reserva de mesas con franjas horarias, no turnos 1 a 1 | Roadmap — carpeta reservada, sin código |

**Cómo hablar de esto en una venta:** es correcto decir *"el sistema está preparado para crecer a otros rubros sin tener que empezar de cero"*. No es correcto decir *"tenemos una versión para gimnasios/veterinarias"* — no existe. Un pedido en cualquiera de estos rubros hoy es un proyecto Custom que se cotiza aparte.

---

## Anexo A — Estado real del producto (guía interna, no para el cliente)

Tabla de referencia rápida para no prometer de más en una llamada de venta. Estado verificado contra el código y las auditorías al 10/11/2026.

### ✅ Se puede prometer y demostrar hoy

Todo lo listado en la sección 7 "HOY": reservas públicas 24/7, anti doble-reserva, duración real de los servicios (sin turnos superpuestos), servicios a domicilio con zonas de cobertura, recargo y tiempo de traslado, promociones por profesional, turnos pagos protegidos con cancelación y devolución desde el admin, reprogramación entre profesionales, reserva manual desde el equipo con alta automática en el CRM, modo solo, multi-profesional con agenda propia, agenda visual (mes/semana/día, drag&drop), servicios con categorías/buffer/precio/insumos, insumos con stock y costo unitario, CRM de clientes, historial por turno, caja diaria y mensual con reconciliación, automatizaciones de reactivación/cumpleaños por email, recordatorio automático por email, estadísticas generales y por profesional, Smart Tags NFC/QR con medición por canal y atribución de reservas, reseñas propias con moderación, sitio público con redes configurables, acciones masivas, aislamiento total de datos entre negocios, roles (Admin, Profesional, Staff con permisos por módulo, Cliente), panel 100% web sin instalación.

### 🟡 Con matices — aclarar antes de cerrar

- **WhatsApp automático (recordatorios y campañas):** el envío está construido y el plan lo controla, pero **no hay plantillas de WhatsApp aprobadas por Meta todavía**. La landing, a propósito, no promete WhatsApp automático. Vender "recordatorios automáticos por email; WhatsApp en proceso de habilitación".
- **Cobros y señas con Mercado Pago:** el código está completo y con tests. Valida la firma del webhook, el monto lo decide el servidor (con el precio final de la promo si hay) y solo confirma un pago si el importe y la moneda coinciden. Pero los pagos están **desactivados en la configuración**, y faltan dos pasos: cargar el secreto del webhook en producción y hacer una prueba con un pago real. Hasta entonces, nada de "cobrá la seña online desde hoy".
- **Límites de plan:** el sistema ya bloquea automáticamente al superar el límite de turnos por mes, de profesionales, de servicios o de clientes. También controla el uso de WhatsApp, Mercado Pago, automatizaciones y la opción de ocultar la marca Turneo según el plan. **No** controla todavía la IA, la cantidad de sucursales ni la cantidad de administradores. No usar "tu plan no incluye IA" como bloqueo técnico. **Además, los límites cargados en el sistema no son los de la grilla de este manual (ver Anexo B).**
- **Varias sucursales:** existe el concepto de "sucursal" en el sistema, pero no filtra la agenda ni los turnos. Hoy es, en la práctica, un solo local por negocio. Ofrecerlo como desarrollo adicional, nunca como ya disponible.
- **Colores propios del negocio:** el dato existe en el sistema, pero el sitio público no lo aplica. Hoy la marca del negocio se refleja vía logo, contenido y redes, no con colores propios.
- **Dominio propio por negocio:** el salón en producción hoy funciona en `turneobelleza.com`. Los subdominios por negocio (`negocio.turneobelleza.com`) ya tienen reglas de seguridad: nombres válidos, nombres reservados bloqueados, y un subdominio que no corresponde a ningún negocio da error en vez de mostrar otro. Según el equipo, el DNS comodín de producción está configurado. Igual, hoy hay un solo negocio real en producción, así que hay que confirmar con el equipo técnico antes de prometer un subdominio andando el mismo día.
- **Servicios a domicilio / detailing:** la zona de cobertura se define por lista de localidades, no por radio en kilómetros. No hay presupuesto previo, ficha del vehículo ni optimización de recorridos.
- **Smart Tags en la landing (esta rama):** la función está construida, pero la landing de `TurneoDV2-Belleza` todavía la muestra como "Próximamente". No usar capturas de esta landing como prueba de que está disponible hasta traer el cambio de `TurnosP-Belleza`.
- **Permisos por rol (Staff):** el bloqueo de acciones sin permiso está cubierto por tests automatizados en los módulos principales. Faltan tests para el resto de los módulos. Se puede vender. Para un cliente que dependa fuerte de ese control (por ejemplo, una franquicia con varios encargados), confirmar antes con el equipo técnico.
- **Reseñas de Google en la web:** mostrar las reseñas reales de Google junto a las propias requiere que el negocio cargue su Place ID **y** que la clave de Google Places esté activa en el servidor. Hoy no está confirmada para ningún negocio real. Las reseñas (propias y de Google) todavía no tienen tests automatizados dedicados.
- **Contenido de ejemplo en reseñas:** el sitio puede mostrar tarjetas estilo Google Maps y "capturas" de WhatsApp/Instagram con **contenido de ejemplo**, marcado como tal. Sirve solo para demos. **Nunca** presentarlo como reseñas reales de un cliente.
- **Smart Tags, analytics:** la medición por canal y la atribución de reservas funcionan. Falta todavía:
  - una vista en el panel de "reservas por etiqueta/canal";
  - medir el canal en las reseñas;
  - una prueba de punta a punta con una etiqueta física real.

  Además, las etiquetas impresas antes de octubre 2026 figuran como "sin canal".

### ⏳ No prometer — es roadmap, no producto

- Gimnasios, salud, veterinarias y restaurantes como producto ya disponible — son carpetas vacías en el código. Se puede ofrecer como proyecto Custom, nunca como "ya lo tenemos".
- Un "Turneo para detailing" completo: hoy existen los servicios a domicilio y los turnos largos, no la ficha del vehículo, los presupuestos ni los boxes de trabajo.
- Membresías y venta de productos al cliente final con stock. Lo que existe hoy es el control de **insumos** de uso interno (ver sección 7), no una tienda.
- Importación automática de datos desde otro sistema (Excel, otro turnero) — se coordina manualmente caso a caso.
- Funciones de IA como producto vendible por plan — el plan no las controla todavía.

---

## Anexo B — Modelos comerciales y planes

Turneo se vende de tres formas distintas, **sobre exactamente el mismo software** — no hay una versión recortada según cómo se compra:

| Modelo | Cómo funciona | Para qué cliente |
|---|---|---|
| **SaaS (suscripción)** | El negocio paga una suscripción mensual/anual y usa una instancia compartida del sistema, con sus datos completamente aislados de otros negocios | La mayoría de los negocios — no quieren manejar infraestructura propia |
| **Licencia perpetua** | El cliente compra el software una vez y lo corre en su propia infraestructura, como si fuera el único negocio en el sistema | Negocios que prefieren no depender de una plataforma compartida, o con requisitos propios de dónde viven sus datos |
| **Desarrollo a medida (Custom)** | Desarrollo específico sobre la misma base, para necesidades que no cubre un plan estándar (ej. un rubro nuevo, una integración puntual) | Clientes grandes o con necesidades muy particulares |

### Planes (según cantidad de profesionales y funcionalidades)

> **Se mantuvo sin cambios desde la v1.2:** esta grilla completa (nombres de planes, precios, límites de profesionales y turnos, columnas de WhatsApp e IA), la promo anual "Pagá 10, usá 12" y la regla de que Enterprise se cotiza "desde". Es la referencia comercial vigente para cotizar.

| Plan | Precio/mes | Profesionales | Turnos/mes | WhatsApp | Automatización/IA |
|---|---|---|---|---|---|
| FREE | $0 | 1 | 35 | Sí | No |
| Starter | $12.900 | 1 | 50 | No | No |
| Pro ⭐ | $24.900 | Hasta 5 | 500 | Sí | No |
| Premium | $39.900 | Hasta 15 | 2.000 | Sí | Sí |
| Enterprise | Desde $69.900 | Sin límite | Sin límite | Sí | Sí |

Precios en pesos argentinos, por mes. Pagando anual: **"Pagá 10 meses y usá 12"** (equivale a ~15% de descuento) en vez de un simple 15% off — se comunica mejor porque es concreto y fácil de calcular para el dueño del negocio.

*Enterprise es "desde" porque se cotiza según el caso (sucursales, volumen, integraciones a medida) — no es un número cerrado como los otros cuatro planes.*

**⚠️ Advertencia interna: la grilla comercial no coincide con lo que está cargado en el sistema.** El catálogo de planes en el código es otro, y sin precios cargados:

| Plan en el sistema | Profesionales | Turnos/mes | WhatsApp | IA |
|---|---|---|---|---|
| Free | 1 | 50 | No | No |
| Starter | 2 | Sin límite | No | No |
| Pro | 10 | Sin límite | Sí | No |
| Business | Sin límite | Sin límite | Sí | No |
| Licencia | Sin límite | Sin límite | Sí | Sí |
| Custom | Sin límite | Sin límite | Sí | Sí |

Como el sistema bloquea automáticamente según **sus** límites (Anexo A), lo que se le venda a un cliente tiene que coincidir con el plan que se le asigne en el panel. En concreto:
- El FREE comercial incluye WhatsApp y 35 turnos. En el sistema, Free tiene 50 turnos y **no** tiene WhatsApp.
- "Premium" y "Enterprise" no existen en el sistema. Los equivalentes más cercanos son "Business" y "Custom".

Hasta que el equipo decida alinear los dos catálogos, confirmar con el equipo técnico qué plan del sistema se le asigna a cada venta.

### Costos

- **Costos para el cliente:** son los precios de la grilla de arriba (sin cambios). El costo de las etiquetas físicas NFC/QR no está definido en este manual: definirlo con el equipo antes de cotizarlas.
- **Costo de insumos del negocio:** el sistema registra el costo unitario de cada insumo (sección 7), y eso le sirve al dueño para conocer sus propios costos. Todavía no calcula automáticamente el margen por servicio. No venderlo como "te calcula la ganancia de cada servicio".
- **Costos operativos de Turneo (interno):** la base de datos de producción corre en el plan gratuito de Neon, con un límite mensual de cómputo. El repositorio no documenta los costos del hosting (Render/Vercel) ni del envío de WhatsApp por mensaje. Antes de fijar precios nuevos o de cotizar un Enterprise grande, relevarlos con el equipo técnico: el costo por mensaje de WhatsApp en particular escala con el volumen de turnos.

**Nota operativa:** la landing pública sigue sin mostrar la grilla de planes ni precios — se sacó a propósito para no publicar precios sin control. El precio y el plan que le conviene a cada negocio los define el equipo comercial en la conversación por WhatsApp, usando esta tabla como referencia interna.

**Contacto comercial:** WhatsApp +54 11 2269-2061 — es el canal real conectado en la landing y en la Ruleta de Captación (Anexo C). Todo botón de contacto de piezas nuevas de marketing debería apuntar a este mismo número, no inventar un email u otro canal.

---

## Anexo C — Herramienta propia: Ruleta de Captación

Es una herramienta **interna del equipo comercial**, no un feature de Turneo para ofrecerle a un salón — sirve para conseguir leads (dueños de salones interesados), no para vender directamente.

**Qué es:** una landing tipo juego (`turneo.app/ruleta`) donde el visitante gira una ruleta y gana un beneficio real (meses gratis, % de descuento, activación gratis, etc.), a cambio de dejar el nombre de su negocio y su WhatsApp. El sistema genera un código promocional único y lo manda a activar por WhatsApp — de ahí en más es un lead comercial como cualquier otro, a seguir por el equipo. En octubre 2026 se rediseñó visualmente.

**Cómo usarla en campañas:** compartir el link con un parámetro de campaña para saber de dónde vino cada lead, por ejemplo:
- `turneo.app/ruleta?campaign=instagram`
- `turneo.app/ruleta?campaign=qr` (para flyers, tarjetas, eventos)
- `turneo.app/ruleta?campaign=publicidad`

**Dónde ver los leads:** panel interno `turneo.app/platform/roulette` — acceso exclusivo del dueño de la plataforma (ningún admin de un negocio cliente puede verlo). Ahí se ve cada lead con su premio, código y WhatsApp, y se le va cambiando el estado a medida que el equipo comercial avanza la conversación (Nuevo → Contactado → Demo → Suscripción, etc.), o se lo elimina si es spam/prueba. Los premios de la ruleta (cuáles hay, con qué probabilidad, si están activos) también se administran ahí, sin tocar código.

**Qué todavía no hace (no prometer, mismo criterio que el resto del manual):** no manda emails de seguimiento automáticos, no tiene protección anti-bot más allá de un límite de intentos por IP, y no tiene un dashboard de tasa de conversión — el seguimiento de cada lead hoy es manual, por el equipo comercial.

---

## Guía de tono para producción de contenido

Para quien use este manual para escribir un guion de video, un anuncio, una landing o una presentación:

1. **Empezar siempre por el dolor real, no por la lista de funcionalidades.** El gancho es "¿todavía confirmás turnos por WhatsApp a mano?", no "Turneo tiene 8 módulos".
2. **Un problema, una solución, un resultado por pieza.** Usar la estructura de la sección 7 — no tratar de mostrar todo el sistema en un solo video de 30 segundos.
3. **Mostrar, no describir, cuando se pueda.** El sistema es visual (agenda con drag&drop, caja, CRM, Smart Tags) — screen recordings reales pesan más que texto sobre fondo de color.
4. **El caso real es el activo más fuerte que hay.** El salón de belleza que corre en producción hoy es prueba de que esto funciona en el mundo real, no en una demo armada — priorizarlo sobre features abstractas.
5. **Nunca mostrar como disponible lo que está en el Anexo A como 🟡 o ⏳.** Ninguna pieza de marketing debería sugerir:
   - multi-sucursal activa;
   - WhatsApp automático o cobro de señas online activos;
   - otros rubros;
   - reseñas de ejemplo como si fueran reales;
   - precios sin haberlos confirmado antes con el equipo.
6. **Hablarle al dueño del negocio, no al programador.** Cero jerga técnica (nada de "API", "multi-tenant", "backend") en cualquier pieza dirigida al cliente final — esos términos son para este manual y para el equipo interno, no para el copy público.
