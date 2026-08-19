Lo definiría como un **PRD técnico-funcional**, pero manteniendo el MVP pequeño. La idea es que después podamos convertirlo casi directamente en tareas de desarrollo.

# `TTURNEO_SMART_TAG_PRD_v1.md`

## 1. Objetivo

Crear **Turneo Smart Tag**, un módulo integrado en Turneo que permita utilizar etiquetas **NFC y códigos QR** como puntos físicos de interacción entre el negocio y sus clientes.

El objetivo principal es convertir una interacción física —acercar el celular o escanear un QR— en una acción digital medible dentro de Turneo.

### Objetivos específicos

* Facilitar la reserva de turnos.
* Facilitar la re-reserva de un servicio.
* Aumentar la cantidad de reseñas.
* Reducir pasos para el cliente.
* Crear puntos físicos de captación dentro del negocio.
* Medir qué etiquetas generan interacciones y conversiones.
* Permitir modificar la acción de una etiqueta sin reemplazar físicamente el NFC/QR.
* Integrar las interacciones con el ecosistema existente de Turneo.

### Principio fundamental

> **Una etiqueta física debe convertirse en una puerta de entrada rápida a Turneo.**

---

# 2. Problema que resuelve

Actualmente muchas acciones dependen de que el cliente:

```text
recuerde el nombre del negocio
        ↓
busque Instagram / Google / WhatsApp
        ↓
encuentre el negocio
        ↓
entre al perfil
        ↓
busque el enlace
        ↓
reserve
```

Esto genera fricción y pérdida de conversiones.

Smart Tag busca reducirlo a:

```text
Cliente
   ↓
NFC / QR
   ↓
Turneo
   ↓
Acción
```

### Problemas concretos

**Reserva**

El cliente puede necesitar buscar nuevamente cómo reservar.

**Re-reserva**

Después de un servicio, el cliente puede olvidarse de volver a reservar.

**Reseñas**

El negocio depende de que el cliente recuerde buscarlo en Google para dejar una reseña.

**Captación**

Las interacciones físicas dentro del negocio actualmente no necesariamente generan datos o conversiones medibles.

**Medición**

El negocio no sabe qué punto físico genera más interacciones.

---

# 3. Alcance MVP

El MVP incluirá:

### Gestión de Smart Tags

* Crear etiqueta.
* Editar etiqueta.
* Activar/desactivar.
* Eliminar/deshabilitar.
* Asignar nombre.
* Asignar ubicación.
* Seleccionar acción.
* Generar URL única.
* Generar QR.

### Acciones iniciales

1. **Reservar turno**
2. **Volver a reservar**
3. **Dejar reseña**

### Smart Link

Cada etiqueta tendrá una URL única:

```text
https://turneo.app/s/{token}
```

### Analytics

Registrar:

* Interacción.
* Fecha/hora.
* Smart Tag.
* Acción.
* Cliente identificado, cuando corresponda.
* Resultado de la acción.

### Panel administrativo

Nueva sección:

```text
Administración
└── Smart Tags
```

### Compatibilidad

Cada Smart Tag tendrá:

* NFC.
* QR.

Ambos utilizarán el mismo Smart Link.

---

# 4. Casos de uso

## CU-01 — Reservar turno

**Actor:** Cliente.

```text
Cliente acerca celular
        ↓
Smart Tag
        ↓
Turneo
        ↓
Página de reserva
        ↓
Selecciona servicio
        ↓
Selecciona horario
        ↓
Confirma turno
```

### Resultado

Se registra:

```text
Interacción
Reserva iniciada
Reserva completada
```

---

## CU-02 — Volver a reservar

**Actor:** Cliente existente.

Si Turneo puede identificar al cliente:

```text
NFC
 ↓
Turneo
 ↓
Cliente identificado
 ↓
Último servicio
 ↓
"Reservar nuevamente"
```

Ejemplo:

> Tu último servicio fue Corte + Barba.
> ¿Querés reservarlo nuevamente?

Si no puede identificarlo, se muestra el flujo normal de reserva.

---

## CU-03 — Solicitar reseña

```text
NFC
 ↓
Turneo
 ↓
Experiencia
 ↓
Valoración
```

El cliente selecciona una valoración.

Para MVP:

```text
★★★★★
★★★★
★★★
★★
★
```

La experiencia posterior podrá dirigir al usuario al mecanismo de reseña configurado por el negocio.

**Importante:** no se debe diseñar el sistema suponiendo que siempre podremos controlar o intermediar el flujo de reseñas de terceros. La integración concreta con Google deberá definirse técnicamente antes de implementarla.

---

## CU-04 — Administrar Smart Tag

El administrador:

```text
Smart Tags
 ↓
Nueva etiqueta
 ↓
Nombre: Recepción
 ↓
Ubicación: Entrada
 ↓
Acción: Reservar
 ↓
Crear
```

Turneo genera:

```text
URL
QR
Identificador
```

---

## CU-05 — Desactivar etiqueta

Si una etiqueta física se pierde o deja de utilizarse:

```text
Admin
 ↓
Smart Tag
 ↓
Desactivar
```

La URL deja de ejecutar la acción.

---

# 5. Flujo NFC/QR

## Flujo general

```text
                ┌───────────┐
                │ NFC / QR  │
                └─────┬─────┘
                      │
                      ▼
              /s/{token}
                      │
                      ▼
              Validar SmartTag
                      │
               ┌──────┴──────┐
               │             │
            Válida         Inválida
               │             │
               ▼             ▼
            Registrar      Error
            evento
               │
               ▼
             Acción
               │
        ┌──────┼──────┐
        ▼      ▼      ▼
      Reserva Re-   Reseña
              reserva
```

### NFC

El NFC almacenará únicamente la URL.

Ejemplo:

```text
https://turneo.app/s/8Fj29K
```

### QR

El QR contendrá exactamente la misma URL.

Por lo tanto:

```text
NFC ─────┐
         ├──> Smart Link
QR ──────┘
```

No existirán dos sistemas diferentes.

---

# 6. Smart Link

El Smart Link es el núcleo técnico de Smart Tag.

Formato:

```text
https://turneo.app/s/{token}
```

Ejemplo:

```text
https://turneo.app/s/A8k29LmQ
```

### Características

* Token único.
* No debe contener información sensible.
* Asociado a un `Tenant`.
* Asociado a un `SmartTag`.
* Puede estar activo/inactivo.
* Puede cambiar de acción sin cambiar la URL.
* Registra la interacción.
* Redirige/renderiza la experiencia correspondiente.

### Concepto importante

La etiqueta física **no conoce la acción**.

Conoce solamente:

```text
Smart Link
```

Turneo decide:

```text
¿Qué negocio?
¿Qué etiqueta?
¿Qué acción?
¿Qué experiencia?
```

Esto permite:

```text
Hoy:
NFC → Reservar

Mañana:
NFC → Re-reservar
```

sin reemplazar la etiqueta.

---

# 7. Acciones

## MVP

### `BOOKING`

Reservar turno.

```text
/s/{token}
      ↓
Reserva pública
```

### `REBOOK`

Volver a reservar.

```text
/s/{token}
      ↓
Identificar cliente
      ↓
Último servicio
      ↓
Re-reserva
```

Si no se puede identificar:

```text
→ Reserva normal
```

### `REVIEW`

Solicitar reseña.

```text
/s/{token}
      ↓
Experiencia
      ↓
Valoración
      ↓
Acción de reseña
```

---

## Futuras acciones

No forman parte del MVP:

```text
WHATSAPP
INSTAGRAM
PROMOTION
LOYALTY
SURVEY
CONTACT
PRODUCT
CAMPAIGN
```

---

# 8. Modelo de datos

Propongo comenzar con dos entidades principales.

## SmartTag

```text
SmartTag
──────────────
Id
TenantId
Token
Name
Location
Action
IsActive
CreatedAt
UpdatedAt
```

### Descripción

| Campo       | Función               |
| ----------- | --------------------- |
| `Id`        | Identificador interno |
| `TenantId`  | Negocio propietario   |
| `Token`     | Identificador público |
| `Name`      | Nombre administrativo |
| `Location`  | Ubicación física      |
| `Action`    | Acción configurada    |
| `IsActive`  | Estado                |
| `CreatedAt` | Creación              |
| `UpdatedAt` | Última modificación   |

---

## SmartTagEvent

```text
SmartTagEvent
──────────────
Id
TenantId
SmartTagId
Action
ClientId
EventType
CreatedAt
```

### EventType inicial

```text
INTERACTION
BOOKING_STARTED
BOOKING_COMPLETED
REBOOK_STARTED
REVIEW_STARTED
REVIEW_COMPLETED
```

`ClientId` será nullable porque una interacción puede provenir de un visitante no identificado.

---

## Relaciones

```text
Tenant
  │
  └── SmartTags
          │
          └── SmartTagEvents
                   │
                   └── Client
```

Esto mantiene el diseño alineado con la arquitectura multi-tenant existente.

---

# 9. API

La API deberá mantenerse dentro del backend actual de Turneo.

## Administración

```http
GET    /api/smart-tags
GET    /api/smart-tags/{id}
POST   /api/smart-tags
PUT    /api/smart-tags/{id}
DELETE /api/smart-tags/{id}
PATCH  /api/smart-tags/{id}/status
```

## Smart Link

```http
GET /api/smart/{token}
```

Este endpoint será público.

Su responsabilidad será:

1. Validar token.
2. Validar estado.
3. Resolver Tenant.
4. Resolver Smart Tag.
5. Registrar interacción.
6. Determinar acción.
7. Entregar/redirigir a la experiencia correspondiente.

## Analytics

```http
GET /api/smart-tags/{id}/analytics
GET /api/smart-tags/analytics
```

Estos endpoints serán administrativos.

---

# 10. Frontend

## Público

Nueva ruta:

```text
/s/[token]
```

Será la puerta de entrada de NFC/QR.

La experiencia dependerá de la acción.

### BOOKING

```text
Smart Link
 ↓
Reserva
```

### REBOOK

```text
Smart Link
 ↓
Cliente identificado
 ↓
Re-reserva
```

### REVIEW

```text
Smart Link
 ↓
Experiencia
 ↓
Valoración
```

---

## Administración

Nueva sección:

```text
/admin/smart-tags
```

### Listado

```text
Smart Tags

┌─────────────────────────────────────────────┐
│ Recepción     Reservar     ● Activa         │
│ Espejo        Reseña       ● Activa         │
│ Salida        Re-reserva   ○ Inactiva       │
└─────────────────────────────────────────────┘
```

### Crear

```text
Nombre
Ubicación
Acción

[Crear Smart Tag]
```

### Detalle

Mostrar:

```text
Nombre
Acción
Estado
URL
QR
```

Y posteriormente:

```text
Interacciones
Conversiones
```

---

# 11. Seguridad

Este punto es importante porque el Smart Link será público.

### Token

Debe ser:

* Único.
* No predecible.
* No secuencial.
* Sin información sensible.

No utilizar:

```text
/s/1
/s/2
/s/3
```

Preferir:

```text
/s/A8k29LmQ7X
```

o un identificador aleatorio equivalente.

### Multi-tenancy

Nunca confiar únicamente en un `TenantId` enviado por el cliente.

El Tenant debe resolverse a partir del Smart Tag/token almacenado.

### Estado

Una etiqueta desactivada debe dejar de funcionar inmediatamente.

### Rate limiting

El Smart Link será público y deberá tener rate limiting para evitar:

* abuso.
* spam.
* generación masiva de eventos.
* scraping.

Esto es especialmente importante porque el sistema ya utiliza rate limiting para endpoints públicos de reservas. 

### Datos personales

No almacenar datos personales solamente por detectar una visita.

Registrar cliente únicamente cuando:

* ya existe una sesión válida, o
* el cliente se identifica voluntariamente dentro del flujo.

### Analytics

No guardar más información de la necesaria.

---

# 12. Analytics

El objetivo no es solamente contar escaneos.

Queremos medir **conversiones**.

### Métricas MVP

```text
Interacciones
Reservas iniciadas
Reservas completadas
Re-reservas iniciadas
Reseñas iniciadas
```

### Ejemplo

```text
SMART TAG — RECEPCIÓN

Interacciones       184
Reservas iniciadas   71
Reservas completadas 38

Conversión           53,5%
```

### Por etiqueta

```text
Recepción
184 interacciones

Espejo
127 interacciones

Salida
96 interacciones
```

Esto permitirá descubrir qué ubicación funciona mejor.

### Conversión

La métrica más importante será:

```text
conversiones / interacciones
```

No simplemente:

```text
cantidad de escaneos
```

---

# 13. Plan de implementación

Lo dividiría en fases pequeñas.

## Fase 1 — Core

* Entidad `SmartTag`.
* Entidad `SmartTagEvent`.
* Migración.
* Repositorio.
* Servicios.
* Tenant isolation.

## Fase 2 — Smart Link

* Token.
* Endpoint público.
* Resolución de Smart Tag.
* Activación/desactivación.
* Registro de eventos.

## Fase 3 — Administración

* Listado.
* Crear.
* Editar.
* Activar/desactivar.
* Selección de acción.

## Fase 4 — Acciones

Implementar:

```text
BOOKING
REBOOK
REVIEW
```

## Fase 5 — QR

Generación del QR desde Turneo.

## Fase 6 — NFC

Configurar las etiquetas físicas con el Smart Link.

No requiere infraestructura adicional.

## Fase 7 — Analytics

* Eventos.
* Métricas.
* Conversiones.
* Dashboard básico.

## Fase 8 — Tests

### Backend

* Token válido.
* Token inválido.
* Tag desactivado.
* Tenant isolation.
* Registro de eventos.
* Rate limiting.
* Acciones.

### Frontend

* Apertura Smart Link.
* Reserva.
* Re-reserva.
* Reseña.

El proyecto ya cuenta con tests de integración backend y e2e frontend, por lo que Smart Tag debería incorporarse a esa estrategia en lugar de crear una metodología paralela. 

---

# 14. Fuera de alcance

Para evitar que el MVP se convierta en otro sistema grande, dejamos explícitamente fuera:

### NFC avanzado

* Lectura de datos personalizados desde el chip.
* Escritura NFC desde Turneo.
* Aplicación móvil propia.
* NFC bidireccional.
* Automatizaciones mediante NFC.

### Marketing

* Campañas completas.
* Segmentación avanzada.
* Promociones complejas.
* Programa de fidelización.
* Cupones.

### Analytics avanzado

* BI.
* Cohortes.
* Attribution avanzada.
* Machine Learning.
* Predicciones.

### Integraciones

* Google Reviews API avanzada.
* CRM externos.
* Meta.
* WhatsApp automatizado específico para Smart Tags.

### Hardware

Turneo no desarrollará hardware NFC propio en esta fase.

Se utilizarán etiquetas NFC comerciales estándar.

---

# Arquitectura final del MVP

```text
                       TURNEO
                          │
              ┌───────────┴───────────┐
              │                       │
          ADMIN PANEL             PÚBLICO
              │                       │
        Smart Tags               /s/{token}
              │                       │
              └───────────┬───────────┘
                          │
                     SmartTagService
                          │
              ┌───────────┴───────────┐
              │                       │
          SmartTag              SmartTagEvent
              │                       │
              └───────────┬───────────┘
                          │
                       Tenant
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           Reserva     Re-reserva   Reseña
```

### Principio de diseño

**NFC y QR no son sistemas independientes.**

Son simplemente dos formas de llegar a:

```text
https://turneo.app/s/{token}
```

Y el verdadero producto es:

> **Smart Link + Acción + Identificación + Analytics**

Eso permite que posteriormente podamos sumar WhatsApp, promociones, fidelización o campañas **sin modificar la infraestructura física instalada**.
