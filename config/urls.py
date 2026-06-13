from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from django.http import HttpResponse

def home_view(request):
    html = """
    <html>
        <head>
            <title>API Backend - Inventario</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f8f9fa; }
                h1 { color: #343a40; }
                p { color: #6c757d; }
                a { text-decoration: none; color: white; background-color: #007bff; padding: 10px 20px; border-radius: 5px; }
                a:hover { background-color: #0056b3; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Backend Inventario Papeleria</h1>
                <p>El servidor API está funcionando correctamente.</p>
                <p>Estado: <strong>Online</strong> ✅</p>
                <br>
                <a href="/admin/">Ir al Panel Admin</a>
            </div>
        </body>
    </html>
    """
    return HttpResponse(html)

urlpatterns = [
    path('', home_view, name='home'),
    path('admin/', admin.site.urls),
    path('api/ventas/', include('ventas.urls')),
    path('api/inventario/', include('inventario.urls')),
    
    # OpenAPI 3 Schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Swagger UI
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # ReDoc UI
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
