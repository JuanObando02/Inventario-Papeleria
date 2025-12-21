from django.urls import path
from django.contrib.auth import views as auth_views
from .views import ProcesarVentaView, CerrarCajaView, punto_venta_view

urlpatterns = [
    # --- RUTAS DE ACCESO ---
    path('login/', auth_views.LoginView.as_view(template_name='ventas/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),

    # --- RUTAS DEL POS ---
    path('crear/', ProcesarVentaView.as_view(), name='crear-venta'),
    path('cerrar/<int:pk>/', CerrarCajaView.as_view(), name='cerrar-caja'),
    path('pos/', punto_venta_view, name='pantalla-pos'),
]   