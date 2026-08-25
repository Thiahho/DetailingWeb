-- Corré esto contra Neon apenas migres (punto 3 del runbook, docs/migracion_neon.md).
--
-- Qué mide: si el rol de Postgres que usa la app (el de la connection string)
-- puede saltarse Row Level Security por privilegio de servidor, en vez de por
-- el mecanismo de bypass propio de la app (sentinel 'bypass' en
-- CurrentTenantService, ver docs/auditoriabelleza_0507.md sección RLS).
--
-- rolsuper = true      -> el rol es superusuario, ignora RLS SIEMPRE, sin excepción.
-- rolbypassrls = true  -> el rol tiene BYPASSRLS explícito, mismo efecto.
--
-- Si cualquiera de las dos da 't': la migración EnableRowLevelSecurity queda
-- decorativa — las políticas existen en el esquema pero Postgres nunca las
-- evalúa para este rol, y el aislamiento entre tenants depende 100% de los
-- query filters de EF Core (una sola capa, no defensa en profundidad).
--
-- Fix si da 't': crear un rol de aplicación sin esos privilegios y apuntar
-- ConnectionStrings__DefaultConnection a ese rol en vez del rol admin/owner
-- que Neon te da por default en el connection string inicial.

SELECT
    rolname,
    rolsuper,
    rolbypassrls,
    CASE
        WHEN rolsuper OR rolbypassrls
            THEN '⚠️  RLS decorativo — este rol la saltea por privilegio de servidor'
        ELSE '✅ RLS se evalúa de verdad para este rol'
    END AS diagnostico
FROM pg_roles
WHERE rolname = current_user;
