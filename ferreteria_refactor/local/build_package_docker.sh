#!/bin/bash
# ============================================================
#  Mi Inventario Facil - Build offline usando Docker
#
#  Genera local/dist/MiInventarioFacil con todo lo necesario para
#  abrir la app en Windows sin internet. No requiere Node, npm,
#  pip ni dotnet instalados en el VPS: se usan contenedores.
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CODE_ROOT="$(dirname "$ROOT_DIR")"
PROJECT_DIR_NAME="$(basename "$ROOT_DIR")"
CONTAINER_PROJECT="/workspace_root/$PROJECT_DIR_NAME"

cd "$ROOT_DIR"

echo "============================================================"
echo "  Mi Inventario Facil - Build offline por Docker"
echo "============================================================"
echo ""

echo "[1/2] Compilando launcher Windows..."
docker run --rm \
  -v "$CODE_ROOT:/workspace_root" \
  -w "$CONTAINER_PROJECT/local/launcher" \
  mcr.microsoft.com/dotnet/sdk:8.0 \
  dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o publish

echo ""
echo "[2/2] Armando paquete portable offline..."
docker run --rm \
  -v "$CODE_ROOT:/workspace_root" \
  -w "$CONTAINER_PROJECT/local" \
  node:20-bookworm \
  bash -lc "apt-get update >/dev/null && apt-get install -y --no-install-recommends python3-pip wget unzip rsync openssl ca-certificates >/dev/null && bash build_package.sh"

echo ""
echo "============================================================"
echo "  Listo: $SCRIPT_DIR/dist/MiInventarioFacil"
echo "  En Windows: ejecutar setup.bat una vez y luego MiInventarioFacil.exe"
echo "============================================================"
