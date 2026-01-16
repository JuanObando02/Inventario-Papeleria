#!/bin/bash

# 1. Salir si hay error
set -e

# 2. Recolectar estáticos (CSS/JS)
echo "🎨 Recolectando archivos estáticos..."
python manage.py collectstatic --noinput

# 3. Correr migraciones
echo "📦 Aplicando migraciones de base de datos..."
python manage.py migrate

# 4. Iniciar Gunicorn
echo "🚀 Iniciando servidor..."
gunicorn config.wsgi:application --bind 0.0.0.0:8000