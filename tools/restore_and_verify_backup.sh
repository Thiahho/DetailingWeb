#!/usr/bin/env bash
# Prueba real de un dump: lo restaura contra una base LOCAL vacía y corre
# chequeos básicos de sanidad. "Un backup no probado no es un backup" — este
# script es la prueba, no solo la copia (punto 5 del runbook).
#
# Uso:
#   ./restore_and_verify_backup.sh /ruta/al/turneo_2026-08-24_040000.dump
#
# Requiere: un Postgres local corriendo (el mismo docker/ que usa el proyecto
# para desarrollo sirve) y las variables RESTORE_HOST/RESTORE_PORT/RESTORE_USER
# si no son las de default de abajo.
#
# Corré esto de vez en cuando (no hace falta cada día) — al menos una vez
# después de armar el cron, y después cada tanto para confirmar que un dump
# reciente sigue siendo restaurable.

set -euo pipefail

DUMP_FILE="${1:?Uso: restore_and_verify_backup.sh <archivo.dump>}"

if [ ! -f "$DUMP_FILE" ]; then
    echo "[restore_verify] No existe: $DUMP_FILE" >&2
    exit 1
fi

RESTORE_HOST="${RESTORE_HOST:-localhost}"
RESTORE_PORT="${RESTORE_PORT:-5432}"
RESTORE_USER="${RESTORE_USER:-postgres}"
RESTORE_DB="turneo_restore_verify"

export PGPASSWORD="${RESTORE_PASSWORD:-postgres}"

echo "[restore_verify] Recreando base vacía '$RESTORE_DB' en $RESTORE_HOST:$RESTORE_PORT"
dropdb --if-exists -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" "$RESTORE_DB"
createdb -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" "$RESTORE_DB"

echo "[restore_verify] Restaurando $DUMP_FILE"
pg_restore -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" -d "$RESTORE_DB" --no-owner --no-privileges "$DUMP_FILE"

echo "[restore_verify] Chequeos de sanidad:"

TABLE_COUNT=$(psql -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" -d "$RESTORE_DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
echo "  - Tablas en public: $TABLE_COUNT"

MIGRATIONS_COUNT=$(psql -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" -d "$RESTORE_DB" -tAc \
    "SELECT count(*) FROM \"__EFMigrationsHistory\"" 2>/dev/null || echo "0")
echo "  - Migraciones aplicadas (__EFMigrationsHistory): $MIGRATIONS_COUNT"

BOOKINGS_COUNT=$(psql -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" -d "$RESTORE_DB" -tAc \
    "SELECT count(*) FROM \"Bookings\"" 2>/dev/null || echo "N/A")
echo "  - Filas en Bookings: $BOOKINGS_COUNT"

if [ "$TABLE_COUNT" -lt 10 ]; then
    echo "[restore_verify] ⚠️  Menos de 10 tablas restauradas — el dump probablemente está incompleto o corrupto." >&2
    exit 1
fi

echo "[restore_verify] OK — el dump restaura y tiene datos. Base de prueba: $RESTORE_DB (borrala con dropdb cuando termines de revisar)."
