# Inventario Papelería

Punto de venta (POS) e inventario **multi-sede** para una papelería. Backend en Django 6 + Django REST Framework que expone una API con autenticación por token, y frontend en React 19 + Vite que la consume vía axios.

El código, los comentarios y los nombres del dominio están en **español** (Sede, Venta, Caja, Ancheta, Movimiento...).

## Características

- **Multi-sede**: el stock no vive en el producto sino en un registro `Inventario` por par producto+sede. Al crear un producto o una sede se generan automáticamente los inventarios correspondientes en 0.
- **Tipos de producto**: `FISICO` (con stock), `SERVICIO` y `ANCHETA` (kits sin stock físico propio). Las anchetas tienen receta y se arman convirtiendo insumos en unidades pre-armadas dentro de una transacción.
- **Movimientos de inventario** como única fuente de cambio de stock: `ENTRADA`, `SALIDA`, `TRASLADO` y `VENTA`. Las entradas con costo recalculan el costo promedio ponderado del producto.
- **Ciclo de caja**: apertura y cierre de `SesionCaja`; una venta requiere una caja abierta y su sede se deriva de la sesión. El cierre calcula la diferencia entre lo vendido por el sistema y el dinero físico declarado.
- **Ventas y anulaciones** con reversión de stock.
- **Roles**: `ADMIN` y `EMPLEADO`. El empleado opera sobre su sede asignada; el administrador puede elegir sede.
- **Alertas de stock mínimo**, edición/desactivación de productos, historial de movimientos, dashboard de resumen y reportes financieros por sede y fecha.
- **Documentación de la API** con OpenAPI 3 (Swagger UI y ReDoc).

## Stack

| Capa      | Tecnología                                                        |
|-----------|-------------------------------------------------------------------|
| Backend   | Django 6, Django REST Framework (TokenAuthentication), drf-spectacular |
| Frontend  | React 19, Vite, React Router 7, Bootstrap 5, axios                |
| Base de datos | SQLite en local · PostgreSQL en producción (vía `DATABASE_URL`) |
| Despliegue | Docker / Coolify · gunicorn + WhiteNoise                          |

## Estructura del proyecto

```
config/         # settings, urls raíz y wsgi/asgi del proyecto Django
inventario/     # productos, inventario por sede, movimientos, anchetas, señales, servicios
ventas/         # ventas, caja/sesiones, reportes, dashboard, POS legacy server-rendered
usuarios/       # perfil de usuario (rol y sede) — solo modelo, sin urls propias
frontend/       # SPA React + Vite que consume la API
Dockerfile      # imagen de producción (migrate + gunicorn)
Procfile        # arranque en plataformas tipo Heroku/Railway
requirements.txt
```

Cada app Django usa un paquete `models/` (no `models.py`) que re-exporta todo en su `__init__.py`; los imports externos siempre son del estilo `from inventario.models import Producto`.

## Requisitos previos

- Python 3.12+
- Node.js 18+ (para el frontend)

## Puesta en marcha

### Backend

Desde la raíz del proyecto:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1        # Windows PowerShell
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver       # API en http://127.0.0.1:8000
```

> Nota: `requirements.txt` está guardado en UTF-16; edítalo con cuidado si tu herramienta asume UTF-8.

### Frontend

Desde `frontend/`:

```bash
npm install
npm run dev      # espera el backend en http://127.0.0.1:8000/api/
```

El endpoint de la API se puede sobreescribir con la variable de entorno `VITE_API_URL`.

```bash
npm run build    # build de producción
npm run lint     # eslint
```

## API

Todas las rutas cuelgan de `/api/`:

- `/api/inventario/` — productos, sedes, categorías, inventario global, movimientos, alertas de stock, armado de kits.
- `/api/ventas/` — login (token), apertura/estado/cierre de caja, procesar y anular ventas, dashboard y reportes admin.

Documentación interactiva:

- Esquema OpenAPI: `/api/schema/`
- Swagger UI: `/api/schema/swagger-ui/`
- ReDoc: `/api/schema/redoc/`

Panel de administración de Django: `/admin/`

## Pruebas

```bash
python manage.py test                                                     # todos los tests
python manage.py test inventario.tests.test_movements                     # un módulo
python manage.py test inventario.tests.test_movements.NombreTest.test_x   # un test
```

## Despliegue

La imagen de Docker ejecuta las migraciones y arranca gunicorn:

```bash
docker build -t inventario-papeleria .
docker run -p 8000:8000 -e DATABASE_URL=postgres://... inventario-papeleria
```

Variables de entorno relevantes: `DATABASE_URL` (activa PostgreSQL), `ALLOWED_HOSTS`, `SECRET_KEY`. Los archivos estáticos se sirven con WhiteNoise.

## Licencia

Software propietario — **todos los derechos reservados**. El código se publica como *source-available*: puede consultarse, pero no está permitido usarlo, copiarlo, modificarlo ni distribuirlo sin autorización previa y por escrito del titular. Ver [LICENSE](LICENSE).
