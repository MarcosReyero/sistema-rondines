# Guía de Despliegue — Sistema Rondines

Stack: Django (Daphne/ASGI) + React (Vite) + PostgreSQL + Nginx + Caddy

---

## Estructura de servicios Docker

```
Internet / LAN
      │
   Caddy :443  ← HTTPS (Let's Encrypt o certificado mkcert para LAN)
      │
   Nginx :80   ← Sirve React SPA + proxy a Django
      │
   Daphne :8000 ← Django + WebSockets (Django Channels)
      │
 PostgreSQL :5432
```

---

## 1. Preparar el servidor Ubuntu

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version
docker compose version
```

---

## 2. Clonar y configurar

```bash
git clone <tu-repo> /opt/rondines
cd /opt/rondines/sistema-rondines

# Crear .env a partir del ejemplo
cp .env.example .env
nano .env   # ← editar dominio, passwords, secret key
```

**Variables mínimas a cambiar en `.env`:**
- `SECRET_KEY` → generá una con: `python3 -c "import secrets; print(secrets.token_hex(50))"`
- `DB_PASSWORD` → password segura para la base de datos
- `DJANGO_SUPERUSER_PASSWORD` → password del usuario admin
- `PUBLIC_DOMAIN` → tu dominio (ej: `rondines.lan` para LAN)
- `PUBLIC_URL` → `https://rondines.lan`
- `ALLOWED_HOSTS` → incluir el dominio y la IP del servidor
- `CSRF_TRUSTED_ORIGINS` → `https://rondines.lan`

---

## 3a. Deploy en LAN con dominio personalizado (recomendado)

> Esto permite acceder desde el celular escaneando QR con HTTPS.

### 3a.1 Configurar AdGuard Home como DNS

AdGuard Home debe estar corriendo en el servidor (o en otro equipo de la red).
Si no lo tenés instalado: `docker run -d --name adguard -p 3000:3000 -p 53:53/udp adguard/adguardhome`

**Solución si el puerto 53 está ocupado (Ubuntu):**
```bash
sudo mkdir -p /etc/systemd/resolved.conf.d
sudo tee /etc/systemd/resolved.conf.d/00-disable-stub.conf <<EOF
[Resolve]
DNSStubListener=no
EOF
sudo systemctl restart systemd-resolved
sudo ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

**Agregar rewrite DNS en AdGuard Home:**
1. Abrir AdGuard Home (ej: `http://192.168.1.100:3000`)
2. Ir a **Filtros → Reglas DNS personalizadas**
3. Agregar:
   ```
   [/rondines.lan/]192.168.1.100
   ```
   *(reemplazar `rondines.lan` y `192.168.1.100` con tu dominio y la IP real del servidor)*

**Configurar los dispositivos para usar AdGuard como DNS:**
- En el router: cambiar el DNS del servidor DHCP a la IP del servidor AdGuard
- O manualmente en cada dispositivo: DNS primario = IP del servidor

### 3a.2 Generar certificado HTTPS con mkcert

```bash
cd /opt/rondines/sistema-rondines/deploy
chmod +x gen-cert.sh
sudo ./gen-cert.sh rondines.lan
```

Esto genera:
- `deploy/certs/cert.pem` — certificado
- `deploy/certs/key.pem`  — clave privada
- `deploy/certs/rootCA.crt` — CA raíz para instalar en dispositivos

### 3a.3 Instalar la CA raíz en cada dispositivo (UNA SOLA VEZ)

**Android:**
1. Pasar `deploy/certs/rootCA.crt` al celular (USB, email, etc.)
2. Ajustes → Seguridad → Instalar certificado → CA (Autoridad de certificación)
3. Seleccionar `rootCA.crt`
4. Confirmar

**iOS / iPadOS:**
1. Pasar `rootCA.crt` al dispositivo (AirDrop o email)
2. Ajustes → Perfil descargado → Instalar
3. Ajustes → General → Información → Confianza de certificados → activar la CA instalada

### 3a.4 Usar Caddyfile.lan en el docker-compose

Editar `deploy/docker-compose.prod.yml`, en el servicio `caddy`, cambiar el volumen del Caddyfile:

```yaml
# Cambiar esta línea:
- ./Caddyfile:/etc/caddy/Caddyfile:ro
# Por estas:
- ./Caddyfile.lan:/etc/caddy/Caddyfile:ro
- ./certs:/etc/caddy/certs:ro
```

### 3a.5 Levantar

```bash
cd /opt/rondines/sistema-rondines
docker compose -p rondines --env-file .env -f deploy/docker-compose.prod.yml up -d --build
```

Verificar: abrir `https://rondines.lan` desde el celular → debe cargar sin advertencias SSL.

---

## 3b. Deploy con dominio público (Let's Encrypt)

Si el servidor tiene IP pública y un dominio real apuntando a él, Caddy obtiene el certificado automáticamente sin configuración extra.

1. El Caddyfile ya está configurado para Let's Encrypt.
2. En `.env` poner: `PUBLIC_DOMAIN=rondines.tuempresa.com`, `ACME_EMAIL=tu@email.com`
3. Levantar igual que 3a.5.

---

## 4. Comandos útiles

```bash
# Ver logs de todos los servicios
docker compose -p rondines -f deploy/docker-compose.prod.yml logs -f

# Ver logs de un servicio específico
docker compose -p rondines -f deploy/docker-compose.prod.yml logs -f web

# Reiniciar un servicio
docker compose -p rondines -f deploy/docker-compose.prod.yml restart web

# Actualizar (pull + rebuild + redeploy sin downtime)
git pull
docker compose -p rondines --env-file .env -f deploy/docker-compose.prod.yml up -d --build

# Acceder a la DB
docker compose -p rondines -f deploy/docker-compose.prod.yml exec db psql -U rondines -d rondines

# Acceder a Django shell
docker compose -p rondines -f deploy/docker-compose.prod.yml exec web python manage.py shell

# Backup de la base de datos
docker compose -p rondines -f deploy/docker-compose.prod.yml exec db \
    pg_dump -U rondines rondines > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose -p rondines -f deploy/docker-compose.prod.yml exec -T db \
    psql -U rondines rondines < backup_YYYYMMDD.sql
```

---

## 5. Coexistencia con worm-erp

Si worm-erp ya está corriendo en el mismo servidor, no hay conflicto porque:
- Cada proyecto usa su propia red Docker (`rondines-net` vs `worm-net`)
- Caddy de cada proyecto escucha en puertos distintos del host, o comparten el mismo Caddy

**Opción A (recomendada): Caddy compartido**
Si ya tenés un Caddy de worm-erp en 80/443, agregar rondines al mismo Caddyfile:
```caddyfile
rondines.lan {
  tls /etc/caddy/certs/rondines/cert.pem /etc/caddy/certs/rondines/key.pem
  reverse_proxy localhost:8081  # nginx de rondines en puerto distinto
}
```
Y exponer el nginx de rondines en un puerto diferente (ej: 8081) en lugar de proxy interno.

**Opción B (más simple): Puerto alternativo para Caddy de rondines**
Cambiar en `docker-compose.prod.yml`:
```yaml
caddy:
  ports:
    - "8443:443"   # HTTPS en puerto 8443 en vez de 443
    - "8080:80"
```
Y acceder con `https://rondines.lan:8443`.

---

## 6. Estructura de archivos Docker

```
sistema-rondines/
├── backend/
│   └── Dockerfile              ← imagen Django/Daphne
├── frontend/
│   └── (código React)
├── deploy/
│   ├── docker-compose.prod.yml ← stack completo
│   ├── Dockerfile.frontend     ← build React + Nginx
│   ├── nginx.conf              ← SPA + WebSocket proxy
│   ├── Caddyfile               ← HTTPS público (Let's Encrypt)
│   ├── Caddyfile.lan           ← HTTPS LAN (certificado local)
│   ├── gen-cert.sh             ← generador de certificado mkcert
│   ├── certs/                  ← aquí van cert.pem, key.pem, rootCA.crt
│   └── GUIA_DEPLOY.md          ← esta guía
└── .env.example                ← plantilla de variables de entorno
```
