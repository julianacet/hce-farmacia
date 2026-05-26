#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()   { echo -e "${BLUE}[•]${NC} $*"; }
ok()     { echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
error()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
titulo() { echo -e "\n${BOLD}$*${NC}"; }

titulo "╔══════════════════════════════════════════╗"
titulo "║   HCE Farmacia — Instalador Linux        ║"
titulo "╚══════════════════════════════════════════╝"
echo ""

if [[ $EUID -ne 0 ]]; then
  error "Este script debe ejecutarse con sudo: sudo bash instalar.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f "docker-compose.yml" ]]; then
  error "No se encontró docker-compose.yml. Ejecuta el script desde la carpeta raíz del proyecto."
fi

# ── Verificar Docker ──────────────────────────────────────────────────────────

titulo "1. Verificando Docker..."

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  ok "Docker ya está instalado ($(docker --version))"
else
  info "Docker no encontrado. Instalando..."

  if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
      $(lsb_release -cs) stable" \
      | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif command -v dnf &>/dev/null; then
    dnf -y -q install dnf-plugins-core
    dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
    dnf -y -q install docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif command -v yum &>/dev/null; then
    yum install -y -q yum-utils
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    error "Distribución no reconocida. Instala Docker manualmente: https://docs.docker.com/engine/install/"
  fi

  systemctl enable --now docker
  ok "Docker instalado"
fi

USUARIO_REAL="${SUDO_USER:-$USER}"
if ! groups "$USUARIO_REAL" | grep -q docker; then
  usermod -aG docker "$USUARIO_REAL"
  warn "Usuario '$USUARIO_REAL' agregado al grupo docker. Cambios aplican en la próxima sesión."
fi

# ── Configuración ─────────────────────────────────────────────────────────────

titulo "2. Configuración de hce-core (base de datos compartida)..."
echo ""
info "hce-farmacia se conecta a la misma base de datos que hce-core."
info "Necesitas el nombre del proyecto Docker de hce-core (COMPOSE_PROJECT_NAME en su .env)."
echo ""

read -rp "  Nombre del proyecto Docker de hce-core [hce]: " HCE_PROJECT
HCE_PROJECT="${HCE_PROJECT:-hce}"
HCE_NETWORK_NAME="${HCE_PROJECT}_default"
HCE_DB_CONTAINER="${HCE_PROJECT}-db"

# Verificar que la red de hce-core existe
if ! docker network inspect "$HCE_NETWORK_NAME" &>/dev/null; then
  warn "No se encontró la red Docker '$HCE_NETWORK_NAME'."
  warn "Asegúrate de que hce-core esté corriendo antes de instalar hce-farmacia."
  read -rp "  ¿Continuar de todas formas? [s/N]: " CONTINUAR
  [[ "${CONTINUAR,,}" == "s" ]] || error "Instalación cancelada."
fi

# Verificar que el contenedor de BD existe
if ! docker inspect "$HCE_DB_CONTAINER" &>/dev/null; then
  warn "No se encontró el contenedor de base de datos '$HCE_DB_CONTAINER'."
  warn "¿Está corriendo hce-core? Ejecuta: docker compose -f /ruta/hce-core/docker-compose.yml up -d"
  read -rp "  ¿Continuar de todas formas? [s/N]: " CONTINUAR
  [[ "${CONTINUAR,,}" == "s" ]] || error "Instalación cancelada."
fi

ok "Red Docker de hce-core: $HCE_NETWORK_NAME"

titulo "3. Credenciales de la base de datos..."
echo ""
info "Ingresa las mismas credenciales que usaste al instalar hce-core."
echo ""

read -rp "  Usuario de la base de datos [hce]: " DB_USER
DB_USER="${DB_USER:-hce}"

read -rp "  Nombre de la base de datos [hce_provider]: " DB_NAME
DB_NAME="${DB_NAME:-hce_provider}"

while true; do
  read -rsp "  Contraseña de la base de datos: " DB_PASS
  echo ""
  if [[ -z "$DB_PASS" ]]; then
    warn "La contraseña no puede estar vacía."
  else
    break
  fi
done

# Verificar conexión a la BD
info "Verificando conexión a la base de datos..."
if docker exec "$HCE_DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null 2>&1; then
  ok "Conexión a la base de datos exitosa"
else
  warn "No se pudo verificar la conexión. Continuando de todas formas..."
fi

titulo "4. Configuración del servidor de farmacia..."
echo ""

read -rp "  Puerto de acceso al módulo de farmacia en el navegador [8080]: " UI_PORT
UI_PORT="${UI_PORT:-8080}"

read -rp "  Puerto de la API de farmacia [8010]: " API_PORT
API_PORT="${API_PORT:-8010}"

for PUERTO in "$UI_PORT" "$API_PORT"; do
  if ss -tlnp 2>/dev/null | grep -q ":${PUERTO} " || ss -tlnp 2>/dev/null | grep -q ":${PUERTO}$"; then
    error "El puerto $PUERTO ya está en uso."
  fi
done

echo ""
info "Si el sistema solo se usará en este equipo, dejá 'localhost'."
info "Si otros equipos de la red van a acceder, ingresá la IP de este servidor."
read -rp "  Dirección del servidor [localhost]: " SERVER_HOST
SERVER_HOST="${SERVER_HOST:-localhost}"

read -rp "  Zona horaria [America/Bogota]: " APP_TZ
APP_TZ="${APP_TZ:-America/Bogota}"

read -rp "  Nombre de la impresora térmica en CUPS (Enter para omitir): " PRINTER_TERMICA
PRINTER_TERMICA="${PRINTER_TERMICA:-}"

JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '\n=')
ok "Configuración lista"

# ── Crear archivos .env ───────────────────────────────────────────────────────

titulo "5. Creando archivos de configuración..."

ALLOWED_ORIGIN=$([ "${UI_PORT}" = "80" ] && echo "http://${SERVER_HOST}" || echo "http://${SERVER_HOST}:${UI_PORT}")

cat > "$SCRIPT_DIR/.env" <<EOF
COMPOSE_PROJECT_NAME=farmacia

HCE_NETWORK_NAME=${HCE_NETWORK_NAME}
HCE_DB_CONTAINER=${HCE_DB_CONTAINER}

DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

# La API se conecta al contenedor de BD por su nombre dentro de la red de hce-core
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${HCE_DB_CONTAINER}:5432/${DB_NAME}?sslmode=disable
JWT_SECRET=${JWT_SECRET}
PORT=${API_PORT}

VITE_API_URL=http://${SERVER_HOST}:${API_PORT}
UI_PORT=${UI_PORT}
APP_TZ=${APP_TZ}

DOCKER_API_PORT=${API_PORT}
DOCKER_ALLOWED_ORIGIN=${ALLOWED_ORIGIN}
DOCKER_VITE_API_URL=http://${SERVER_HOST}:${API_PORT}

PRINTER_TERMICA=${PRINTER_TERMICA}
EOF

cat > "$SCRIPT_DIR/ui/.env" <<EOF
VITE_API_URL=http://${SERVER_HOST}:${API_PORT}
EOF

ok "Archivos .env creados"

# ── Aplicar esquema de farmacia en la BD ──────────────────────────────────────

titulo "6. Aplicando esquema de farmacia en la base de datos..."

if docker exec -i "$HCE_DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$SCRIPT_DIR/db/init.sql" 2>&1; then
  ok "Esquema 'farmacia' aplicado correctamente"
else
  warn "No se pudo aplicar el esquema automáticamente."
  warn "Ejecuta manualmente: docker exec -i ${HCE_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} < db/init.sql"
fi

# ── Construir e iniciar ───────────────────────────────────────────────────────

titulo "7. Construyendo e iniciando los servicios..."
info "Esto puede tomar unos minutos la primera vez..."
echo ""

docker compose -f docker-compose.yml up -d --build

echo ""
ok "Servicios iniciados"

# Conectar farm-api a la red de hce-core para que pueda alcanzar hce-db
titulo "8. Conectando a la red de hce-core..."
FARM_API_CONTAINER="farmacia-api"

# Esperar a que el sandbox de red del contenedor esté listo
sleep 3

MAX_NET=10
NET_OK=false
for ((i=1; i<=MAX_NET; i++)); do
  if docker network connect "$HCE_NETWORK_NAME" "$FARM_API_CONTAINER" 2>/dev/null; then
    NET_OK=true
    break
  fi
  sleep 2
done

if $NET_OK; then
  ok "farm-api conectado a la red $HCE_NETWORK_NAME"
  info "Reiniciando API para que use la nueva red..."
  docker restart "$FARM_API_CONTAINER" &>/dev/null
else
  warn "No se pudo conectar automáticamente. Ejecuta manualmente:"
  warn "  docker network connect ${HCE_NETWORK_NAME} ${FARM_API_CONTAINER}"
  warn "  docker restart ${FARM_API_CONTAINER}"
fi

# ── Verificar que el backend responda ─────────────────────────────────────────

titulo "8. Verificando el backend..."

if command -v curl &>/dev/null; then
  check_health() { curl -sf "http://localhost:${API_PORT}/health" &>/dev/null; }
elif command -v wget &>/dev/null; then
  check_health() { wget -qO- "http://localhost:${API_PORT}/health" &>/dev/null; }
else
  warn "No se encontró curl ni wget. Omitiendo verificación del backend."
  check_health() { return 0; }
fi

MAX_INTENTOS=60
INTENTO=0
until check_health; do
  INTENTO=$((INTENTO + 1))
  if [[ $INTENTO -ge $MAX_INTENTOS ]]; then
    error "El backend no respondió. Revisa los logs: docker compose logs farm-api"
  fi
  sleep 1
done

ok "Backend respondiendo en http://localhost:${API_PORT}"

# ── Resumen final ─────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ¡Instalación completada exitosamente!   ${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "  Módulo de farmacia:  ${BOLD}http://localhost:${UI_PORT}${NC}"
echo ""
echo -e "  Credenciales: las mismas que hce-core (usuario/contraseña del consultorio)."
echo ""
echo -e "  Comandos útiles:"
echo -e "    Ver logs:    ${BOLD}docker compose logs -f${NC}"
echo -e "    Detener:     ${BOLD}docker compose down${NC}"
echo -e "    Reiniciar:   ${BOLD}docker compose restart${NC}"
echo ""
