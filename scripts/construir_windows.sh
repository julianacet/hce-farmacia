#!/usr/bin/env bash
# Compila farm-web.exe y prepara los archivos para despliegue en Windows.
# Ejecutar desde la raíz del proyecto: bash scripts/construir_windows.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'
info()  { echo -e "${BLUE}[•]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WINDOWS_DIR="$ROOT/windows"
API_DIR="$ROOT/api"
UI_DIR="$ROOT/ui"

echo ""
echo -e "${BOLD}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}  HCE Farmacia — Build Windows                ${NC}"
echo -e "${BOLD}  (genera farm-web.exe + dist-farmacia/)      ${NC}"
echo -e "${BOLD}══════════════════════════════════════════════${NC}"
echo ""

command -v go  &>/dev/null || error "Go no encontrado. Instala Go: https://go.dev/dl/"
command -v npm &>/dev/null || error "npm no encontrado. Instala Node.js: https://nodejs.org/"

# Compilador C para CGO (webview requiere CGO en Windows)
MINGW_CC=""
if command -v x86_64-w64-mingw32-gcc &>/dev/null; then
    MINGW_CC="x86_64-w64-mingw32-gcc"
else
    info "Instalando compilador mingw-w64..."
    if command -v dnf &>/dev/null; then
        sudo dnf install -y mingw64-gcc
    elif command -v apt-get &>/dev/null; then
        sudo apt-get install -y gcc-mingw-w64-x86-64
    else
        error "Instala mingw-w64 manualmente:
  Fedora/RHEL:   sudo dnf install mingw64-gcc
  Ubuntu/Debian: sudo apt-get install gcc-mingw-w64-x86-64"
    fi
    MINGW_CC="x86_64-w64-mingw32-gcc"
fi
ok "Compilador C: $MINGW_CC"

# ── 1. Dependencia webview ────────────────────────────────────────────────────

info "Verificando dependencia webview..."
cd "$API_DIR"
if ! grep -q "webview/webview_go" go.mod 2>/dev/null; then
    info "Agregando github.com/webview/webview_go..."
    GOOS=windows go get github.com/webview/webview_go
    go mod tidy
fi
ok "webview_go disponible"

# ── 2. Compilar farm-web.exe ──────────────────────────────────────────────────

info "Compilando farm-web.exe para Windows/amd64 (WebView2)..."
cd "$API_DIR"
CC="$MINGW_CC" CGO_ENABLED=1 GOOS=windows GOARCH=amd64 go build \
    -ldflags="-s -w -H=windowsgui" \
    -o "$WINDOWS_DIR/farm-web.exe" \
    ./cmd/web/main.go
ok "farm-web.exe generado"

# ── 3. Construir frontend ─────────────────────────────────────────────────────

info "Construyendo frontend de farmacia..."
cd "$UI_DIR"
npm ci --silent
npm run build

info "Copiando dist/ a windows/dist-farmacia/..."
rm -rf "$WINDOWS_DIR/dist-farmacia"
cp -r "$UI_DIR/dist" "$WINDOWS_DIR/dist-farmacia"
ok "Frontend listo en windows/dist-farmacia/"

# ── 4. Resumen ────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Archivos listos en windows/                 ${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Opcion A — Instalador (recomendado):"
echo -e "    Compila farm.iss con Inno Setup en Windows:"
echo -e "      ISCC.exe windows\\farm.iss /DMyVersion=1.0.0"
echo -e "    Distribuye HCE-Farmacia-Setup.exe"
echo ""
echo -e "  Opcion B — Instalacion manual (equipo del medico):"
echo -e "    1. Copia farm-web.exe y dist-farmacia/ junto a hce-web.exe"
echo -e "    2. Ejecuta windows\\primera_vez_farmacia.bat  (aplica esquema en la BD)"
echo -e "    3. Haz doble clic en farm-web.exe para abrir farmacia"
echo ""
echo -e "  Para instalar en otros equipos (recepcion, etc.):"
echo -e "    Solo copia farm-web.exe y dist-farmacia/ — no se necesita nada mas."
echo -e "    El exe descubre HCE Consultorio automaticamente en la red."
echo ""
echo -e "  Nota: farm-web.exe usa WebView2 (Edge). Requiere Windows 10/11 actualizado."
echo ""
