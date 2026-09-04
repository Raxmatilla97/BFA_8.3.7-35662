#!/bin/bash
# MySQL serveri so'rovlarni qabul qilishini kutadi.
# Kutilayotgan muhit o'zgaruvchilari: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD

set -e

HOST="${DB_HOST:-mysql}"
PORT="${DB_PORT:-3306}"
USER="${DB_USER:-root}"
PASSWORD="${DB_PASSWORD:-}"

echo "[wait-for-mysql] ${HOST}:${PORT} manziliga ulanish kutilmoqda..."

TRIES=0
MAX_TRIES=60
until mysql -h "$HOST" -P "$PORT" -u "$USER" ${PASSWORD:+-p"$PASSWORD"} -e "SELECT 1" >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_TRIES" ]; then
    echo "[wait-for-mysql] ${MAX_TRIES} marta urinishdan so'ng ham MySQL javob bermadi. To'xtatilmoqda."
    exit 1
  fi
  sleep 2
done

echo "[wait-for-mysql] MySQL tayyor."
