from django.urls import path
from .views import ListarProductosPOS, ArmarAnchetaView

urlpatterns = [
    path('armar-kit/', ArmarAnchetaView.as_view(), name='api-armar-ancheta'),
    path('listar-pos/', ListarProductosPOS.as_view(), name='api-listar-productos'),
]
