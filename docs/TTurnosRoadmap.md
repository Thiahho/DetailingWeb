📘 PRD — TTURNOS Belleza
1. Introducción
Objetivo del producto
Público objetivo
Problemas que resuelve
Propuesta de valor
Competidores
Diferenciadores
Roadmap general
2. Arquitectura Funcional

Descripción completa del sistema.

Cliente

↓

Reserva Online

↓

Agenda

↓

Profesionales

↓

Servicios

↓

Recordatorios

↓

Pagos

↓

Reportes

↓

Automatizaciones
3. Modelo de Datos

Por ejemplo.

Profesional
Id

Nombre

Apellido

Foto

ColorCalendario

Especialidad

Horario

Estado

Sucursal

Comisión

FechaAlta

Con relaciones.

Profesional

↓

Servicios

↓

Turnos

↓

Comisiones
4. Módulo Profesionales

Aquí comienza la especificación funcional.

Cada módulo tendrá la misma estructura.

Objetivo

Permitir administrar todos los profesionales del salón.

Problema

Actualmente el sistema administra únicamente turnos.

En un salón existen varios profesionales con agendas independientes.

Casos de uso

Administrador crea profesional.

↓

Asigna servicios.

↓

Define horarios.

↓

Cliente reserva.

↓

Selecciona profesional.

↓

Agenda se actualiza.

Reglas de negocio
Un profesional puede ofrecer múltiples servicios.
Un servicio puede pertenecer a muchos profesionales.
El profesional puede tener vacaciones.
Puede tener días libres.
Puede bloquear horarios.
Puede atender en varias sucursales.
Backend

Endpoints.

GET

/api/professionals

POST

/api/professionals

PUT

/api/professionals/{id}

DELETE

/api/professionals/{id}
Base de datos

Nueva tabla.

Professionals

Campos.

Tipos.

Índices.

FK.

Frontend

Pantallas.

Formulario.

Validaciones.

UX.

Estados.

Wireframe
+----------------------+

Foto

Juan Pérez

Color

🟣

Especialidades

✓ Corte

✓ Color

✓ Barba

Horarios

Lunes

08-18

Martes

08-18

Vacaciones

Editar

Eliminar

+----------------------+
Criterios de aceptación

✔ Crear.

✔ Editar.

✔ Desactivar.

✔ Asociar servicios.

✔ Reservar.

✔ Mostrar en agenda.

Riesgos

Superposición.

Vacaciones.

Cambio de horarios.

Tiempo estimado

24 horas

Y así absolutamente cada módulo.

5. Servicios

Todo igual.

Pero específico.

Categorías.

Duración.

Buffer.

Precio.

Foto.

Descripción.

Color.

Orden.

Estado.

Profesionales asociados.

6. Agenda

Muchísimo más completo.

Vista Día.

Vista Semana.

Vista Mes.

Drag & Drop.

Cambio de horario.

Mover turno.

Cancelar.

Reprogramar.

Filtros.

Profesionales.

Colores.

Conflictos.

7. Clientes

Una ficha extremadamente completa.

Foto

Nombre

Teléfono

Email

Cumpleaños

Instagram

Observaciones

Historial

Servicios

Profesional favorito

Próxima visita

Fotos

Notas

Pagos

Cancelaciones

Ausencias
8. Historial

Cada turno genera un registro.

Servicio

Profesional

Precio

Duración

Productos

Notas

Fotos

Pago

Comentarios
9. Automatizaciones

Este módulo merece un documento entero.

Porque puede ser el diferencial de TTURNOS.

Ejemplo.

SI

Cliente no vuelve

45 días

↓

Enviar WhatsApp

↓

Esperar

7 días

↓

Si no responde

↓

Enviar Email

↓

Esperar

3 días

↓

Aplicar cupón

Un constructor visual tipo:

Trigger

↓

Condición

↓

Acción

↓

Espera

↓

Acción

Muy parecido a Zapier o Make.

10. Caja

Todo el flujo.

Cobros.

Devoluciones.

Señas.

Mercado Pago.

Efectivo.

Transferencias.

Caja diaria.

Caja mensual.

11. Estadísticas

Todos los dashboards.

Facturación

Clientes nuevos

Clientes recurrentes

Servicios más vendidos

Profesional con mayores ventas

Horas ocupadas

Horas libres

Cancelaciones

Ausencias

Ingresos

Comparativas
12. UX

Todo el sistema de diseño.

Botones.

Inputs.

Tablas.

Cards.

Colores.

Espaciados.

Tipografía.

Iconografía.

Responsive.

Dark Mode.

13. Roadmap

Con todas las fases.

MVP.

v1.1

v1.2

v2.0

v3.0