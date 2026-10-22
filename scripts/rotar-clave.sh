#!/usr/bin/env bash
# Rotar manualmente: ~/cardioinsight/scripts/rotar-clave.sh
# Leer la clave vigente por SSH: cat ~/cardioinsight/acceso/clave
# Cron opcional diario 05:00: 0 5 * * * $HOME/cardioinsight/scripts/rotar-clave.sh >/dev/null
set -euo pipefail
umask 077
raiz="$(cd "$(dirname "$0")/.." && pwd)"
directorio="$raiz/acceso"
mkdir -p "$directorio"
chmod 700 "$directorio"
temporal="$(mktemp "$directorio/.clave.XXXXXXXX")"
trap 'rm -f "$temporal"' EXIT
openssl rand -hex 16 > "$temporal"
mv -f "$temporal" "$directorio/clave"
trap - EXIT
cat "$directorio/clave"
