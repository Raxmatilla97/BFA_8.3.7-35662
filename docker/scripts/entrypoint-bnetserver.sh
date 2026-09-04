#!/bin/bash
set -e

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-trinity}"
AUTH_DB_NAME="${AUTH_DB_NAME:-auth}"
EXTERNAL_ADDRESS="${BNET_EXTERNAL_ADDRESS:-127.0.0.1}"
LOCAL_ADDRESS="${BNET_LOCAL_ADDRESS:-127.0.0.1}"

ETC_DIR="/opt/trinitycore/etc"
CONF="${ETC_DIR}/bnetserver.conf"
CERT="${ETC_DIR}/bnetserver.cert.pem"
KEY="${ETC_DIR}/bnetserver.key.pem"

wait-for-mysql.sh

mkdir -p "$ETC_DIR"

if [ ! -f "$CONF" ]; then
  echo "[entrypoint] bnetserver.conf birinchi marta yaratilmoqda..."
  cp "${ETC_DIR}/bnetserver.conf.dist" "$CONF"

  sed -i \
    -e "s#^LoginDatabaseInfo.*#LoginDatabaseInfo = \"${DB_HOST};${DB_PORT};${DB_USER};${DB_PASSWORD};${AUTH_DB_NAME}\"#" \
    -e "s#^LoginREST.ExternalAddress.*#LoginREST.ExternalAddress = ${EXTERNAL_ADDRESS}#" \
    -e "s#^LoginREST.LocalAddress.*#LoginREST.LocalAddress = ${LOCAL_ADDRESS}#" \
    -e "s#^BindIP.*#BindIP = \"0.0.0.0\"#" \
    -e "s#^CertificatesFile.*#CertificatesFile = \"${CERT}\"#" \
    -e "s#^PrivateKeyFile.*#PrivateKeyFile = \"${KEY}\"#" \
    -e "s#^LogsDir.*#LogsDir = \"\"#" \
    -e "s#^SourceDirectory.*#SourceDirectory = \"/usr/src/trinitycore\"#" \
    -e "s#^MySQLExecutable.*#MySQLExecutable = \"/usr/bin/mysql\"#" \
    "$CONF"
else
  echo "[entrypoint] Mavjud bnetserver.conf ishlatilmoqda (${CONF})."
fi

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "[entrypoint] O'z-o'zidan imzolangan SSL sertifikat yaratilmoqda..."
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$KEY" -out "$CERT" \
    -subj "/C=UZ/O=BFA UZBEK COMUNITY BETTA/CN=bnetserver" >/dev/null 2>&1
fi

cd /opt/trinitycore/bin
echo "[entrypoint] bnetserver ishga tushirilmoqda..."
exec ./bnetserver -c "$CONF"
