#!/bin/bash
set -e

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-trinity}"
AUTH_DB_NAME="${AUTH_DB_NAME:-auth}"
WORLD_DB_NAME="${WORLD_DB_NAME:-world}"
CHAR_DB_NAME="${CHAR_DB_NAME:-characters}"
HOTFIX_DB_NAME="${HOTFIX_DB_NAME:-hotfixes}"
DATA_DIR="${WORLD_DATA_DIR:-/data}"

ETC_DIR="/opt/trinitycore/etc"
CONF="${ETC_DIR}/worldserver.conf"

wait-for-mysql.sh

mkdir -p "$ETC_DIR"

if [ ! -f "$CONF" ]; then
  echo "[entrypoint] worldserver.conf birinchi marta yaratilmoqda..."
  cp "${ETC_DIR}/worldserver.conf.dist" "$CONF"

  sed -i \
    -e "s#^LoginDatabaseInfo.*#LoginDatabaseInfo     = \"${DB_HOST};${DB_PORT};${DB_USER};${DB_PASSWORD};${AUTH_DB_NAME}\"#" \
    -e "s#^WorldDatabaseInfo.*#WorldDatabaseInfo     = \"${DB_HOST};${DB_PORT};${DB_USER};${DB_PASSWORD};${WORLD_DB_NAME}\"#" \
    -e "s#^CharacterDatabaseInfo.*#CharacterDatabaseInfo = \"${DB_HOST};${DB_PORT};${DB_USER};${DB_PASSWORD};${CHAR_DB_NAME}\"#" \
    -e "s#^HotfixDatabaseInfo.*#HotfixDatabaseInfo    = \"${DB_HOST};${DB_PORT};${DB_USER};${DB_PASSWORD};${HOTFIX_DB_NAME}\"#" \
    -e "s#^DataDir.*#DataDir = \"${DATA_DIR}\"#" \
    -e "s#^LogsDir.*#LogsDir = \"\"#" \
    -e "s#^BindIP.*#BindIP = \"0.0.0.0\"#" \
    -e "s#^SourceDirectory.*#SourceDirectory = \"/usr/src/trinitycore\"#" \
    -e "s#^MySQLExecutable.*#MySQLExecutable = \"/usr/bin/mysql\"#" \
    "$CONF"
else
  echo "[entrypoint] Mavjud worldserver.conf ishlatilmoqda (${CONF})."
fi

cd /opt/trinitycore/bin
echo "[entrypoint] worldserver ishga tushirilmoqda..."
echo "[entrypoint] DIQQAT: xarita ma'lumotlari (dbc/maps/vmaps/mmaps) va to'liq world" \
     "bazasi (TDB) alohida ta'minlanishi kerak - DOCKER_UZ.md ga qarang."
exec ./worldserver -c "$CONF"
