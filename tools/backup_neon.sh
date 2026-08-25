#!/usr/bin/env bash
# Backup diario de la base de Neon (punto 5 del runbook, docs/migracion_neon.md).
#
# Uso:
#   1. Copiar este archivo (y restore_and_verify_backup.sh) a la PC que hace de
#      backup, junto con un archivo .env al lado con:
#        NEON_CONNECTION_STRING="postgres://usuario:pass@host/db?sslmode=require"
#   2. Programarlo:
#        cron (Linux/WSL):  0 4 * * * /ruta/a/backup_neon.sh >> /ruta/a/backup.log 2>&1
#        Task Scheduler (Windows): acción "Iniciar un programa" apuntando a
#          bash.exe (Git Bash/WSL) con este script como argumento, disparador diario.
#   3. Requiere pg_dump instalado (viene con "PostgreSQL client tools" — no
#      hace falta el servidor completo, solo el cliente).
#
# Retención: guarda los últimos 14 dumps y borra el resto — un backup diario
# sin límite de retención eventualmente llena el disco.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
RETENTION_DAYS=14

if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
fi

if [ -z "${NEON_CONNECTION_STRING:-}" ]; then
    echo "[backup_neon] Falta NEON_CONNECTION_STRING (en el entorno o en $ENV_FILE)." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
DUMP_FILE="$BACKUP_DIR/turneo_${TIMESTAMP}.dump"

echo "[backup_neon] Iniciando dump -> $DUMP_FILE"

# Formato custom (-Fc): comprimido y el único formato que acepta pg_restore
# con paralelismo — más chico y más rápido de restaurar que un .sql plano.
pg_dump "$NEON_CONNECTION_STRING" -Fc -f "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[backup_neon] Dump completo: $DUMP_FILE ($DUMP_SIZE)"

# Un dump de 0 bytes o casi vacío es peor que no tener backup — corta acá y
# avisa en vez de dejar rotar uno corrupto sobre los backups buenos.
MIN_BYTES=1024
ACTUAL_BYTES=$(stat -c%s "$DUMP_FILE" 2>/dev/null || stat -f%z "$DUMP_FILE")
if [ "$ACTUAL_BYTES" -lt "$MIN_BYTES" ]; then
    echo "[backup_neon] ⚠️  El dump pesa menos de 1KB — algo salió mal, no se borra nada de la retención vieja." >&2
    exit 1
fi

echo "[backup_neon] Limpiando dumps de más de $RETENTION_DAYS días en $BACKUP_DIR"
find "$BACKUP_DIR" -name "turneo_*.dump" -mtime "+$RETENTION_DAYS" -print -delete

echo "[backup_neon] OK"
