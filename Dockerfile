FROM python:3.11-slim

WORKDIR /app

#cache de Docker
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

ENV SECRET_KEY=clave-temporal-solo-para-build
ENV DJANGO_SETTINGS_MODULE=config.settings
RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate && python create_superuser.py && gunicorn config.wsgi --bind 0.0.0.0:8000"]