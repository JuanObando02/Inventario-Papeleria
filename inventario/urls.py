from django.urls import path
from .views import (
    ListarProductosPOS, ArmarAnchetaView, ListarSedesView, 
    BuscarProductoPublicoView, RegistrarMovimientoView, AdminInventarioGlobalView,
    ListarCategoriasView, CrearProductoView
)

urlpatterns = [
    path('armar-kit/', ArmarAnchetaView.as_view(), name='api-armar-ancheta'),
    path('listar-pos/', ListarProductosPOS.as_view(), name='api-listar-productos'),
    path('buscar-publico/', BuscarProductoPublicoView.as_view(), name='api-buscar-publico'),
    path('sedes/', ListarSedesView.as_view(), name='api-listar-sedes'),
    path('categorias/', ListarCategoriasView.as_view(), name='api-listar-categorias'),
    path('movimientos/crear/', RegistrarMovimientoView.as_view(), name='api-crear-movimiento'),
    path('admin/inventario-global/', AdminInventarioGlobalView.as_view(), name='api-admin-inventario-global'),
    path('admin/crear-producto/', CrearProductoView.as_view(), name='api-crear-producto'),
]
