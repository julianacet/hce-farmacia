#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; NC='\033[0m'

ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

if [[ $EUID -ne 0 ]]; then
  error "Este script debe ejecutarse con sudo: sudo bash desinstalar.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  HCE Farmacia — Desinstalador            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
warn "Esto detendrá y eliminará los contenedores de HCE Farmacia."
warn "La base de datos de hce-core NO se ve afectada."
echo ""

read -rp "  ¿Eliminar el esquema 'farmacia' de la base de datos (todos los datos de farmacia)? [s/N]: " BORRAR_SCHEMA
read -rp "  ¿Eliminar las imágenes Docker construidas? [s/N]: " BORRAR_IMAGENES
echo ""
read -rp "  ¿Confirmar desinstalación? [s/N]: " CONFIRMAR
[[ "${CONFIRMAR,,}" == "s" ]] || { echo "Cancelado."; exit 0; }

echo ""

if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
  if [[ "${BORRAR_IMAGENES,,}" == "s" ]]; then
    docker compose -f docker-compose.yml down --rmi local 2>/dev/null || true
  else
    docker compose -f docker-compose.yml down 2>/dev/null || true
  fi
  ok "Contenedores detenidos y eliminados"
fi

if [[ "${BORRAR_SCHEMA,,}" == "s" ]]; then
  if [[ -f "$SCRIPT_DIR/.env" ]]; then
    source "$SCRIPT_DIR/.env"
    HCE_DB="${HCE_DB_CONTAINER:-hce-db}"
    if docker inspect "$HCE_DB" &>/dev/null; then
      docker exec "$HCE_DB" psql -U "${DB_USER:-hce}" -d "${DB_NAME:-hce_provider}" \
        -c "DROP SCHEMA IF EXISTS farmacia CASCADE;" 2>/dev/null && \
        ok "Esquema 'farmacia' eliminado de la base de datos" || \
        warn "No se pudo eliminar el esquema. Elimínalo manualmente si es necesario."
    else
      warn "Contenedor de BD '$HCE_DB' no encontrado. Elimina el esquema manualmente si es necesario."
    fi
  fi
fi

rm -f "$SCRIPT_DIR/.env"
rm -f "$SCRIPT_DIR/ui/.env"
ok "Archivos de configuración eliminados"

echo ""
echo -e "${GREEN}${BOLD}Desinstalación completada.${NC}"
echo ""
