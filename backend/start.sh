#!/bin/sh
exec 2>&1
python manage.py migrate --noinput
python create_superuser.py
exec daphne -b 0.0.0.0 -p ${PORT:-8080} config.asgi:application
