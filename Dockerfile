# syntax=docker/dockerfile:1
FROM python:3.12-slim

# libmysqlclient-dev + pkg-config + gcc: requeridos por mysqlclient (C extension)
# libgl1 + libglib2.0-0: requeridos por opencv-python (libGL.so.1 / gthread)
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev \
    pkg-config \
    gcc \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn==23.0.0

COPY . .

EXPOSE 8000

# Corre migraciones y luego arranca gunicorn como PID 1 (exec)
# workers=2: el stack ML es pesado en memoria
# timeout=120: Docling + embeddings pueden tardar 60-90 s
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --workers 2 --timeout 120 --bind 0.0.0.0:8000 --capture-output"]
