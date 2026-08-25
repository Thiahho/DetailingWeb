-- Solo hace falta correr esto si check_rls_role.sql dio rolsuper=t o
-- rolbypassrls=t contra Neon. Crea un rol de aplicación sin esos privilegios
-- y le da exactamente los permisos que la app necesita (nada de DDL, la app
-- nunca debería poder alterar el esquema en runtime — eso lo hace
-- Database.Migrate() al arrancar, con el rol owner de la base).
--
-- Reemplazá <PASSWORD_FUERTE> y corré esto una sola vez contra Neon
-- (SQL Editor de Neon o psql), con el rol owner que te dio Neon por default.

CREATE ROLE turneo_app WITH LOGIN PASSWORD '<PASSWORD_FUERTE>' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE current_database() TO turneo_app;
GRANT USAGE ON SCHEMA public TO turneo_app;

-- SELECT/INSERT/UPDATE/DELETE en todas las tablas existentes...
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO turneo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO turneo_app;

-- ...y en las que EF cree a futuro con nuevas migraciones (owner sigue siendo
-- el rol admin de Neon, que es el que corre `dotnet ef database update` /
-- Database.Migrate() en el arranque de la app).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO turneo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO turneo_app;

-- Verificación: debería dar rolsuper=f, rolbypassrls=f.
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'turneo_app';

-- Después de correr esto: actualizar ConnectionStrings__DefaultConnection en
-- Render para que use turneo_app en vez del rol owner de Neon, y reiniciar.
-- Las migraciones de Database.Migrate() en el arranque van a fallar con este
-- rol (no tiene DDL) — si necesitás aplicar una migración nueva, hacelo una
-- vez con el rol owner y volvé a apuntar la app a turneo_app.
