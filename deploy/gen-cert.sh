#!/bin/bash
# gen-cert.sh — Genera certificado HTTPS local con mkcert
# Ejecutar en el SERVIDOR Ubuntu como root o con sudo.
# El certificado generado es confiado por los dispositivos donde se instale la CA raíz.

set -e

DOMAIN="${1:-rondines.lan}"
CERTS_DIR="$(cd "$(dirname "$0")" && pwd)/certs"

echo "========================================"
echo "  Generador de certificado LAN (mkcert)"
echo "========================================"
echo "Dominio: $DOMAIN"
echo "Directorio: $CERTS_DIR"
echo ""

# ── Instalar mkcert si no está ───────────────────────────────────────────────
if ! command -v mkcert &>/dev/null; then
    echo "[1/3] Instalando mkcert..."
    apt-get update -q
    apt-get install -y -q libnss3-tools curl

    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then BIN="mkcert-v1.4.4-linux-amd64"; else BIN="mkcert-v1.4.4-linux-arm64"; fi
    curl -sLo /usr/local/bin/mkcert "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/${BIN}"
    chmod +x /usr/local/bin/mkcert
    echo "    mkcert instalado."
else
    echo "[1/3] mkcert ya está instalado."
fi

# ── Instalar la CA local ─────────────────────────────────────────────────────
echo "[2/3] Instalando CA raíz local..."
mkcert -install

# ── Generar certificado ──────────────────────────────────────────────────────
echo "[3/3] Generando certificado para: $DOMAIN, *.${DOMAIN} y IPs locales..."
mkdir -p "$CERTS_DIR"

SERVER_IP=$(hostname -I | awk '{print $1}')

mkcert \
    -cert-file "$CERTS_DIR/cert.pem" \
    -key-file  "$CERTS_DIR/key.pem" \
    "$DOMAIN" \
    "*.${DOMAIN}" \
    "$SERVER_IP" \
    "localhost" \
    "127.0.0.1"

CA_ROOT=$(mkcert -CAROOT)

echo ""
echo "✅ Certificados generados:"
echo "   $CERTS_DIR/cert.pem"
echo "   $CERTS_DIR/key.pem"
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  PRÓXIMOS PASOS"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "1) Copiá la CA raíz a un lugar accesible para los dispositivos:"
echo "   cp '${CA_ROOT}/rootCA.pem' $CERTS_DIR/rootCA.crt"
cp "${CA_ROOT}/rootCA.pem" "$CERTS_DIR/rootCA.crt"
echo "   → Archivo copiado: $CERTS_DIR/rootCA.crt"
echo ""
echo "2) Instalar la CA en cada dispositivo (se hace UNA SOLA VEZ):"
echo ""
echo "   ANDROID:"
echo "   - Mandá rootCA.crt al celular (email, USB, o sirviéndolo por HTTP)"
echo "   - Ajustes → Seguridad → Instalar certificado → CA"
echo "   - Seleccioná rootCA.crt"
echo ""
echo "   iOS / iPadOS:"
echo "   - Mandá rootCA.crt al dispositivo"
echo "   - Ajustes → Perfil descargado → Instalar"
echo "   - Ajustes → General → Info → Confianza de certificados → activar la CA"
echo ""
echo "3) Configurar AdGuard DNS para que $DOMAIN apunte a $SERVER_IP:"
echo "   En AdGuard Home → Filtros → Reglas DNS → Agregar:"
echo "   |$DOMAIN^  →  $SERVER_IP"
echo "   (ver sección AdGuard en deploy/GUIA_LAN_HTTPS.md)"
echo ""
echo "4) Levantar con el Caddyfile.lan:"
echo "   cd deploy"
echo "   cp .env.example .env  # editar el .env"
echo "   # En docker-compose.prod.yml cambiar Caddyfile → Caddyfile.lan"
echo "   docker compose -p rondines --env-file ../.env -f docker-compose.prod.yml up -d --build"
echo ""
