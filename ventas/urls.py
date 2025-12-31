from django.urls import path
from django.contrib.auth import views as auth_views
from .views import (
    ProcesarVentaView, CerrarCajaView, punto_venta_view, LoginAPIView, 
    AbrirCajaView, EstadoCajaView, AdminReportesCajaView, AdminDetalleCajaView
)

urlpatterns = [
    # --- RUTAS DE ACCESO ---
    path('login/', auth_views.LoginView.as_view(template_name='ventas/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('login-json/', LoginAPIView.as_view(), name='login-api'),
    path('abrir-caja/', AbrirCajaView.as_view(), name='abrir-caja'),
    path('estado-caja/', EstadoCajaView.as_view(), name='estado-caja'),

    # --- RUTAS DEL POS ---
    path('crear/', ProcesarVentaView.as_view(), name='crear-venta'),
    path('cerrar/<int:pk>/', CerrarCajaView.as_view(), name='cerrar-caja'),
    path('pos/', punto_venta_view, name='pantalla-pos'),

    # --- REPORTES ADMIN ---
    path('admin/reportes/cajas/', AdminReportesCajaView.as_view(), name='admin-reportes-cajas'),
    path('admin/reportes/cajas/<int:pk>/', AdminDetalleCajaView.as_view(), name='admin-detalle-caja'),
]   