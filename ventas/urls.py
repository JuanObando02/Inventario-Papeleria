from django.urls import path
from .views import ProcesarVentaView, CerrarCajaView

urlpatterns = [
    path('crear/', ProcesarVentaView.as_view(), name='crear-venta'),
    path('cerrar/<int:pk>/', CerrarCajaView.as_view(), name='cerrar-caja'),
]   