FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copiar el build del frontend al directorio de estáticos de Django
COPY --from=frontend-builder /frontend/dist ./frontend_dist/

ENV SECRET_KEY=clave-temporal-solo-para-build
ENV DJANGO_SETTINGS_MODULE=config.settings
RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["sh", "-c", "echo '=== migrate ===' && python manage.py migrate --noinput && echo '=== superuser ===' && python create_superuser.py && echo '=== PORT='$PORT' ===' && exec daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]
