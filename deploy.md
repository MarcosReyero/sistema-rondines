# Sistema de Rondines — Guía de Deploy en Railway

Stack: **Python 3.11 · Django 5.2 · PostgreSQL · Railway · GitHub**

---

## Requisitos previos

- Python 3.11 instalado localmente
- Git instalado
- Cuenta en [GitHub](https://github.com)
- Cuenta en [Railway](https://railway.app)
- Node.js instalado (para el CLI de Railway)

---

## 1. Crear el repositorio en GitHub

1. Crear nuevo repositorio en github.com (ej: `sistema-rondines`)
2. Inicializarlo con `README.md` y `.gitignore` (Python)
3. Clonarlo localmente:

```bash
git clone https://github.com/tu-usuario/sistema-rondines.git
cd sistema-rondines
```

---

## 2. Crear la estructura del proyecto Django

```bash
mkdir backend frontend
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install django djangorestframework django-cors-headers psycopg2-binary gunicorn whitenoise
pip freeze > requirements.txt
django-admin startproject config .
python manage.py startapp rondines
```

La estructura debe quedar así:

```
sistema-rondines/
├── Dockerfile
├── railway.toml
├── backend/
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── rondines/
│   ├── manage.py
│   ├── requirements.txt
│   └── create_superuser.py
└── frontend/
```

---

## 3. Configurar settings.py

Reemplazar el contenido relevante de `backend/config/settings.py`:

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'clave-local-insegura')

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost').split(',')

CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', 'http://localhost').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',   # ← segundo, después de Security
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('PGDATABASE'),
        'USER': os.environ.get('PGUSER'),
        'PASSWORD': os.environ.get('PGPASSWORD'),
        'HOST': os.environ.get('PGHOST'),
        'PORT': os.environ.get('PGPORT', '5432'),
    }
}

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

---

## 4. Crear el script de superusuario

Crear `backend/create_superuser.py`:

```python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', '')

if username and password:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username=username, password=password, email=email)
        print(f'Superusuario {username} creado.')
    else:
        print(f'Superusuario {username} ya existe, omitiendo.')
```

---

## 5. Crear el Dockerfile

En la **raíz del repo** (no dentro de `backend/`):

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

ENV SECRET_KEY=clave-temporal-solo-para-build
ENV DJANGO_SETTINGS_MODULE=config.settings
RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate --verbosity=2 && python create_superuser.py && gunicorn config.wsgi --bind 0.0.0.0:8000"]
```

---

## 6. Crear railway.toml

En la **raíz del repo**:

```toml
[deploy]
startCommand = "gunicorn config.wsgi --bind 0.0.0.0:8000"
```

---

## 7. Subir a GitHub

```bash
git add .
git commit -m "estructura inicial django"
git push origin main
```

---

## 8. Configurar Railway

### 8.1 Crear el proyecto

1. Ir a [railway.app](https://railway.app) y loguearse con GitHub
2. **New Project** → **Deploy from GitHub repo**
3. Seleccionar el repositorio `sistema-rondines`

### 8.2 Agregar PostgreSQL

En el dashboard del proyecto → **+ New** → **Database** → **PostgreSQL**

Railway inyecta automáticamente las variables `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGPORT`.

### 8.3 Configurar variables de entorno

En el servicio → **Variables**, agregar:

| Variable | Valor |
|---|---|
| `SECRET_KEY` | una clave larga y aleatoria |
| `ALLOWED_HOSTS` | `tu-app.up.railway.app,localhost,127.0.0.1` |
| `CSRF_TRUSTED_ORIGINS` | `https://tu-app.up.railway.app` |
| `DJANGO_SUPERUSER_USERNAME` | `admin` |
| `DJANGO_SUPERUSER_PASSWORD` | tu contraseña segura |
| `DJANGO_SUPERUSER_EMAIL` | `admin@tuapp.com` |
| `PGDATABASE` | `${{Postgres.PGDATABASE}}` |
| `PGHOST` | `${{Postgres.PGHOST}}` |
| `PGPASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `PGPORT` | `${{Postgres.PGPORT}}` |
| `PGUSER` | `${{Postgres.PGUSER}}` |

> Las variables con `${{Postgres.XX}}` son referencias dinámicas al servicio PostgreSQL de Railway.

### 8.4 Generar dominio público

En el servicio → **Settings** → **Networking** → **Generate Domain**

---

## 9. Correr migraciones manualmente (primera vez)

Si el `migrate` automático del CMD no corre correctamente la primera vez, hacerlo via SSH:

### Instalar el CLI de Railway

```bash
npm install -g @railway/cli
railway login
ssh-keygen -t ed25519   # si no tenés clave SSH
```

### Conectarse al contenedor

```bash
railway ssh --project=TU_PROJECT_ID --environment=TU_ENV_ID --service=TU_SERVICE_ID
```

### Dentro del contenedor

```bash
python manage.py migrate
python create_superuser.py
```

---

## 10. Verificar el deploy

Entrar a `https://tu-app.up.railway.app/admin` y loguearse con las credenciales del superusuario creado.

---

## Flujo de trabajo para cambios futuros

```bash
# hacer cambios en el código
git add .
git commit -m "descripción del cambio"
git push origin main
# Railway detecta el push y redeploya automáticamente
```

---

## Notas importantes

- El `DEBUG` debe estar en `False` en producción — configurarlo via variable de entorno en Railway, no en el código.
- El `collectstatic` corre durante el **build** de Docker, no al iniciar el servidor.
- Whitenoise debe estar en **segundo lugar** en el `MIDDLEWARE`, inmediatamente después de `SecurityMiddleware`.
- El `Dockerfile` debe estar en la **raíz del repo**, no dentro de `backend/`.
- El `manage.py` debe estar dentro de `backend/`.
