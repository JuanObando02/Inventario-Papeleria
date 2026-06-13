# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Punto de venta (POS) e inventario multi-sede para una papelería. Backend Django 6 + Django REST Framework (API con TokenAuthentication); frontend React 19 + Vite en `frontend/` que consume la API vía axios. El código, comentarios y nombres de dominio están en español (Sede, Venta, Caja, Ancheta...). DB: SQLite en local, PostgreSQL vía `DATABASE_URL` en producción (Docker/Coolify, gunicorn + whitenoise).

## Commands

Backend (desde la raíz, con `venv\Scripts\Activate.ps1` activado):

```
python manage.py runserver          # API en http://127.0.0.1:8000
python manage.py migrate
python manage.py makemigrations
python manage.py test               # todos los tests
python manage.py test inventario.tests.test_movements                 # un módulo
python manage.py test inventario.tests.test_movements.NombreTest.test_x  # un test
```

Frontend (desde `frontend/`):

```
npm run dev       # Vite dev server (espera el backend en http://127.0.0.1:8000/api/, override con VITE_API_URL)
npm run build
npm run lint      # eslint
```

No hay linter/formatter configurado para Python.

## Architecture

Tres apps Django montadas bajo `/api/` en [config/urls.py](config/urls.py): `inventario` (`/api/inventario/`), `ventas` (`/api/ventas/`) y `usuarios` (sin urls propias; solo modelo de perfil).

Cada app usa un paquete `models/` (no `models.py`) que re-exporta todo en su `__init__.py` — los imports externos siempre son `from inventario.models import Producto`, etc. Los modelos llevan `app_label` explícito en `Meta`.

### Modelo de dominio (lo importante)

- **Multi-sede**: el stock NO vive en `Producto` sino en `Inventario` (par único producto+sede). Las señales en [inventario/signals.py](inventario/signals.py) crean automáticamente registros `Inventario` en 0 al crear un producto (para todas las sedes) o una sede (para todos los productos).
- **Tipos de producto**: `FISICO` (con stock), `SERVICIO` y `ANCHETA` (sin stock físico propio, validado en `Inventario.clean()`). Las anchetas/kits tienen receta (`RecetaAncheta`, M2M auto-referencial sobre `Producto`); [inventario/services.py](inventario/services.py) (`armar_ancheta`) convierte insumos en anchetas pre-armadas dentro de una transacción con `select_for_update`.
- **Movimientos como fuente de cambio de stock**: `MovimientoInventario` (ENTRADA/SALIDA/TRASLADO/VENTA) aplica el cambio de stock dentro de su propio `save()` (atómico, solo en creación) y recalcula el costo promedio ponderado del producto en las ENTRADAS con costo. Para descontar stock en una venta se crea un `MovimientoInventario` tipo VENTA, no se resta a mano (ver `CrearVentaSerializer` en [ventas/serializers.py](ventas/serializers.py)).
- **Ciclo de caja**: las ventas requieren una `SesionCaja` abierta (`activa=True`); la sede de la venta se deriva de la sesión, no del request. El cierre calcula diferencia entre `total_ventas_sistema` y `dinero_fisico_declarado`.
- **Roles**: `PerfilUsuario` (OneToOne con User) define rol ADMIN/EMPLEADO y sede asignada. Patrón recurrente en las vistas: el EMPLEADO opera siempre sobre su sede de perfil; el ADMIN puede elegir sede vía `sede_id` (query param o body). Las validaciones de rol se hacen inline con `hasattr(user, 'perfil')`.
- Varios modelos llaman `full_clean()` dentro de `save()` (`Producto`, `RecetaAncheta`, `MovimientoInventario`), así que las validaciones de `clean()` aplican también fuera de formularios.

### Frontend

SPA en [frontend/src/App.jsx](frontend/src/App.jsx) con rutas protegidas por `AuthContext` (token DRF en `localStorage`, inyectado por el interceptor de [frontend/src/api/axios.js](frontend/src/api/axios.js)). Una página por pantalla en `frontend/src/pages/`. Bootstrap 5 para estilos. Existe además una plantilla server-rendered legacy del POS en `ventas/templates/` (vista `punto_venta_view`); el frontend React es el actual.

## Gotchas

- `requirements.txt` está guardado en UTF-16; cuidado al editarlo con herramientas que asumen UTF-8.
- `config/settings.py` tiene un `print()` de debug de env vars y defaults permisivos (CORS allow all, `ALLOWED_HOSTS=*`) pensados para el despliegue en Coolify/Railway.
