FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

WORKDIR /app
CMD ["gunicorn", "config.wsgi", "--bind", "0.0.0.0:8000", "--log-file", "-"]