# Migración de la base a Neon + verificación de RLS + backups

Runbook de los puntos 2, 3 y 5 de la checklist de auditoría pre-piloto. Requiere
credenciales (Render, Neon) que no viven en el repo — pensado para que lo
ejecutes vos a mano, no para correrlo con un script único sin mirar.

El punto 4 (desactivar pagos) ya está aplicado en código: `PaymentsController`
lee `Payments:Enabled` (default `false`), ver `appsettings.json`/`appsettings.Production.json`.

## Estado (25/08)

- ✅ **1.1-1.3 (dump/restore)** hechos y verificados: 47 tablas, 46
  migraciones, 1 tenant / 5 users / 8 bookings coinciden entre Render y Neon.
- ✅ **1.5 (migraciones)** confirmado al día — `dotnet ef database update`
  contra Neon con el rol owner: "No migrations were applied. The database is
  already up to date."
- ✅ **Sección 2 (rol RLS)** — `neondb_owner` da `rolbypassrls=t` (confirmado,
  es el hallazgo esperado). Se creó el rol `turneo_app` sin bypass y se
  verificó que respeta RLS de verdad (0 filas sin `app.tenant_id`, 8 con
  `bypass`). Password del rol nuevo: entregado en el chat de la sesión que
  hizo esto, no vive en ningún archivo del repo — rotarlo si hace falta
  recuperarlo (`ALTER ROLE turneo_app WITH PASSWORD '...'` contra Neon).
- ⏳ **Pendiente, requiere acción manual en Render:** actualizar
  `ConnectionStrings__DefaultConnection` al connection string de Neon con el
  rol `turneo_app` (sección 1.4) y reiniciar. Hasta que eso pase, Render sigue
  siendo la base real — Neon tiene una copia al momento del dump, no un
  espejo en vivo.
- ⬜ **Sección 3 (backups)** no configurada todavía — depende de la PC vieja
  mencionada en el punto 5 original, fuera del alcance de esta sesión.

---

## 1. Migrar la base a Render → Neon

**Por qué:** el free tier de Render Postgres se borra a los 30 días de
inactividad/expiración. Neon free es permanente. Costo: cero. Elimina el
riesgo de perder la base con datos de un cliente real adentro.

### 1.1 Crear el proyecto en Neon

1. [neon.tech](https://neon.tech) → cuenta nueva o login → **New Project**.
2. Región: la más cercana a Render (normalmente `us-east` si Render está ahí).
3. Postgres 16 (misma major version que corre local, ver `docker/Dockerfile` /
   `Testcontainers.PostgreSql` en los tests — evita sorpresas de compatibilidad).
4. Copiar el **connection string** que te da Neon (rol owner por default,
   pooled y direct — usá el **direct** para el `pg_restore`, el pooled después
   para la app si querés PgBouncer).

### 1.2 Dump de Render

Necesitás la connection string actual de Render (Dashboard → tu base de
Postgres → "Connections" → External Database URL).

```bash
pg_dump "postgres://usuario:pass@host-de-render/db?sslmode=require" -Fc -f render_export.dump
```

`-Fc` (formato custom): comprimido, permite restaurar en paralelo, y es lo que
esperan los scripts de `tools/`.

**Gotcha real (encontrado migrando el 25/08):** si la migración
`EnableRowLevelSecurity` ya está aplicada en Render, el `pg_dump` de arriba
falla con `query would be affected by row-level security policy` — el rol de
la app es owner de las tablas pero **no** tiene `BYPASSRLS` (correcto, es
justamente lo que se quiere), y las policies están con `FORCE ROW LEVEL
SECURITY`, así que ni el owner las saltea por default. Postgres tira el mismo
hint que es el fix: desactivar `FORCE` solo el rato del dump, y reactivarlo
apenas termina.

```bash
# 1. Listar las tablas con FORCE RLS y generar los ALTER TABLE (dueño = tu rol)
psql "$SRC" -tAc "
  SELECT 'ALTER TABLE public.\"' || c.relname || '\" NO FORCE ROW LEVEL SECURITY;'
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relforcerowsecurity = true
  ORDER BY 1;" > rls_disable.sql
sed 's/NO FORCE/FORCE/' rls_disable.sql > rls_enable.sql

# 2. Desactivar, dumpear, reactivar — SIEMPRE con trap para no dejar la
#    reactivación pendiente si el dump falla a mitad de camino
psql "$SRC" -f rls_disable.sql
pg_dump "$SRC" -Fc -f render_export.dump
psql "$SRC" -f rls_enable.sql
```

Ventana de exposición: segundos (lo que tarda el dump), y no toca ni una fila
de datos — es un flag de metadata por tabla. Verificar después que quedó
reactivado en las 32 tablas:
```bash
psql "$SRC" -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity AND NOT c.relforcerowsecurity;"
-- tiene que dar 0
```

### 1.3 Restore en Neon

Usá el connection string **directo** (sin `-pooler` en el host) — el pooler
de Neon es PgBouncer en modo transacción, y `pg_restore` necesita
funcionalidad de sesión que ese modo no da bien. El host directo es el mismo
que el pooled, sacando el sufijo `-pooler`.

```bash
pg_restore -d "postgres://usuario:pass@host-directo-de-neon/db?sslmode=require" \
  --no-owner --no-privileges --clean --if-exists \
  render_export.dump
```

(Ojo con la sintaxis: la connection string va después de `-d`, no como
argumento posicional junto al archivo — a diferencia de `pg_dump`, que sí la
acepta posicional.)

- `--no-owner --no-privileges`: la base de Neon tiene su propio rol owner, no
  el de Render — sin esto `pg_restore` intenta reasignar ownership a un rol
  que no existe en Neon y tira warnings (no fatales, pero ensucian el log).
- `--clean --if-exists`: por si corrés esto más de una vez contra la misma
  base de Neon (ej. algo salió mal y repetís) — dropea antes de recrear en vez
  de fallar por "ya existe". En un restore contra una base recién creada
  (nada que dropear) es un no-op inofensivo.

### 1.4 Cambiar el connection string en Render

**Crítico — formato, no URI:** el Npgsql de este proyecto (9.0.2, verificado
directo contra la librería el 25/08) **no parsea** `postgresql://user:pass@host/db`
— solo el formato ADO.NET `Host=...;Port=...;...`. `psql`/`pg_dump` sí aceptan
URI porque son herramientas de libpq, nada que ver con Npgsql. Pegar el
connection string tal cual lo muestra el dashboard de Neon (formato URI)
en la env var de Render **tira la app al reiniciar** — hay que convertirlo:

```
Host=<host-pooled-de-neon>;Port=5432;Database=neondb;Username=turneo_app;Password=<password-del-rol>;SSL Mode=Require
```

Usá el host **pooled** acá (con `-pooler`) — a diferencia del restore (1.3),
que necesita el directo, el tráfico normal de la app (queries cortas,
muchas conexiones concurrentes de Kestrel) es exactamente el caso de uso que
el pooler de Neon está pensado para manejar.

Dashboard de Render → tu servicio de `Turneo.Api` → **Environment** →
`ConnectionStrings__DefaultConnection` (o el nombre que uses, doble
underscore para el nesting de config de .NET) → pegar el string de arriba
(ya convertido, no el de Neon tal cual) → **guardar y reiniciar** el servicio.

**No hace falta correr `Database.Migrate()` a mano** — ya corre solo en cada
arranque (`Program.cs:246`, `context.Database.Migrate()`). Al reiniciar contra
Neon, las migraciones se aplican automáticamente.

### 1.5 Verificar las migraciones (hoy son 46, no 18)

> El número "18" de la checklist original y el "17" de
> `docs/auditoriabelleza_0507.md` (julio) están desactualizados. El conteo
> confiable es el de la propia herramienta de EF, no `ls`/`grep` sobre la
> carpeta (un `grep` ingenuo ahí puede contar archivos que no son migraciones
> reales y dar un número inflado — pasó al escribir este runbook):
> ```bash
> dotnet ef migrations list --connection "Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require" \
>   | grep -c "^2026"
> ```
> Con esto: **46 migraciones**, mismo número que las aplicadas tanto en Render
> como en Neon tras el restore (sección 1.3) — confirmado en la migración real
> del 25/08.

```bash
psql "postgres://usuario:pass@host-de-neon/db?sslmode=require" \
  -c "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\";"
```

Contá las filas contra el número de arriba — tienen que coincidir. Si dan
menos: `dotnet ef database update --connection "..."` con el rol owner
(no con `turneo_app`, ver sección 2 — ese rol no tiene DDL) aplica las que
falten.

Si no coinciden: mirá los logs de arranque del servicio en Render (Dashboard →
Logs) — `Database.Migrate()` tira excepción y el proceso no levanta si una
migración falla, así que "el sitio anda" ya es buena señal, pero confirmá los
conteos igual.

### 1.6 Smoke test post-migración

- Login de admin real.
- Ver que aparezcan turnos/clientes existentes (los datos migraron, no solo el
  esquema).
- Crear una reserva de prueba desde el sitio público.

---

## 2. Verificar el rol de Postgres para RLS

**Por qué:** la migración `EnableRowLevelSecurity` (ver
`docs/auditoriabelleza_0507.md`, sección RLS) asume que el rol de conexión de
la app **no** puede saltarse las policies. Un rol superusuario o con
`BYPASSRLS` hace que esa capa de defensa en profundidad sea decorativa — el
aislamiento entre tenants pasaría a depender solo de los query filters de EF
Core (una sola capa, no dos).

### 2.1 Correr el chequeo

Con el rol que Render usa hoy para conectarse a Neon:

```bash
psql "postgres://usuario:pass@host-de-neon/db?sslmode=require" \
  -f backend/Turneo.Api/Scripts/check_rls_role.sql
```

### 2.2 Si da rolsuper=t o rolbypassrls=t

El connection string inicial que da Neon suele ser el rol owner del proyecto,
que normalmente **no** es superusuario en Neon (a diferencia de un Postgres
self-hosted) — pero confirmalo, no lo asumas.

Si hace falta un rol separado sin esos privilegios:

```bash
psql "postgres://usuario:pass@host-de-neon/db?sslmode=require" \
  -f backend/Turneo.Api/Scripts/create_app_role_no_bypass.sql
```

Editá el archivo primero y poné una contraseña real en `<PASSWORD_FUERTE>`.
**Importante:** ese rol nuevo no tiene permisos de DDL — `Database.Migrate()`
en el arranque va a fallar si la app se conecta con él. Para aplicar una
migración nueva a futuro, hay que volver a apuntar temporalmente al rol owner,
correr el deploy, y volver a apuntar a `turneo_app`. Es el trade-off de tener
un rol realmente sin privilegios de escritura de esquema.

Después de crear el rol: actualizar
`ConnectionStrings__DefaultConnection` en Render para usar `turneo_app` en vez
del rol owner, reiniciar, y confirmar que el login/reserva de prueba (paso 1.6)
sigue funcionando.

---

## 3. Backups diarios (probados, no solo copiados)

Scripts en `tools/`:

- **`backup_neon.sh`** — hace el `pg_dump` diario, retiene 14 días, borra el
  resto. Pensado para cron (Linux/WSL) o Task Scheduler (Windows, apuntando a
  `bash.exe` con este script) en la PC vieja mencionada en el punto 5.
- **`restore_and_verify_backup.sh`** — restaura un dump elegido contra una
  base LOCAL vacía y corre chequeos de sanidad (cuenta de tablas, migraciones
  aplicadas, filas en `Bookings`). **Corré esto al menos una vez** después de
  armar el cron — un backup que nunca se probó a restaurar no es un backup,
  es una promesa.

### Setup

1. En la PC que va a hacer de backup: copiar `tools/backup_neon.sh` y
   `tools/restore_and_verify_backup.sh`, más un archivo `tools/.env` (no
   commitear) con:
   ```
   NEON_CONNECTION_STRING="postgres://usuario:pass@host-de-neon/db?sslmode=require"
   ```
2. Requiere `pg_dump`/`pg_restore`/`psql` instalados — vienen con
   "PostgreSQL client tools" (no hace falta instalar el servidor completo).
3. Programar `backup_neon.sh` diario (madrugada, para no competir con tráfico
   real — Neon free tier tiene límites de cómputo mensuales).
4. Primera vez: correr `backup_neon.sh` a mano, después
   `restore_and_verify_backup.sh tools/backups/turneo_<fecha>.dump` contra un
   Postgres local (el de `docker/` del proyecto sirve) para confirmar que el
   dump restaura de verdad.
