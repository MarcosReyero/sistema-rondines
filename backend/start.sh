#!/bin/sh
# Merge stderr into stdout — everything appears in Railway deploy logs
exec 2>&1

echo "=== ENV ==="
echo "PORT=${PORT:-NOT_SET}"
echo "PGHOST=${PGHOST:-NOT_SET}"
echo "PGDATABASE=${PGDATABASE:-NOT_SET}"

echo "=== DB TEST ==="
python -c "
import psycopg2, os, sys
try:
    conn = psycopg2.connect(
        host=os.environ['PGHOST'],
        database=os.environ['PGDATABASE'],
        user=os.environ['PGUSER'],
        password=os.environ['PGPASSWORD'],
        port=os.environ.get('PGPORT', '5432'),
        connect_timeout=10
    )
    conn.close()
    print('DB_OK')
except Exception as e:
    print('DB_FAILED:', e)
    sys.exit(1)
"
echo "=== MIGRATE ==="
python manage.py migrate --noinput
echo "=== migrate exit: $? ==="

echo "=== SUPERUSER ==="
python create_superuser.py
echo "=== superuser exit: $? ==="

echo "=== DAPHNE PORT=${PORT:-8000} ==="
daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application
echo "=== DAPHNE SALIO: $? — fallback HTTP para SSH ==="
python -m http.server ${PORT:-8000}
