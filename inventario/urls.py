from django.urls import path
from .views import ListarProductosPOS, ArmarAnchetaView, ListarSedesView

urlpatterns = [
    path('armar-kit/', ArmarAnchetaView.as_view(), name='api-armar-ancheta'),
    path('listar-pos/', ListarProductosPOS.as_view(), name='api-listar-productos'),
    path('sedes/', ListarSedesView.as_view(), name='api-listar-sedes'),
]
