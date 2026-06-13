from django.urls import path
from .views import (
    ListarProductosPOS, ArmarAnchetaView, ListarSedesView, 
    BuscarProductoPublicoView, RegistrarMovimientoView, AdminInventarioGlobalView,
    ListarCategoriasView, CrearProductoView, BuscarProductoAdminView, GenerarSiguienteCodigoProductoView,
    CrearCategoriaView, AlertasStockView, ActualizarStockMinimoView,
    ProductoAdminDetailView, HistorialMovimientosView
)

urlpatterns = [
    path('armar-kit/', ArmarAnchetaView.as_view(), name='api-armar-ancheta'),
    path('listar-pos/', ListarProductosPOS.as_view(), name='api-listar-productos'),
    path('buscar-publico/', BuscarProductoPublicoView.as_view(), name='api-buscar-publico'),
    path('sedes/', ListarSedesView.as_view(), name='api-listar-sedes'),
    path('categorias/', ListarCategoriasView.as_view(), name='api-listar-categorias'),
    path('admin/crear-categoria/', CrearCategoriaView.as_view(), name='api-crear-categoria'),
    path('movimientos/', HistorialMovimientosView.as_view(), name='api-historial-movimientos'),
    path('movimientos/crear/', RegistrarMovimientoView.as_view(), name='api-crear-movimiento'),
    path('alertas-stock/', AlertasStockView.as_view(), name='api-alertas-stock'),
    path('inventarios/<int:pk>/', ActualizarStockMinimoView.as_view(), name='api-actualizar-stock-minimo'),
    path('admin/inventario-global/', AdminInventarioGlobalView.as_view(), name='api-admin-inventario-global'),
    path('admin/crear-producto/', CrearProductoView.as_view(), name='api-crear-producto'),
    path('admin/productos/<int:pk>/', ProductoAdminDetailView.as_view(), name='api-admin-producto-detalle'),
    path('admin/buscar-productos/', BuscarProductoAdminView.as_view(), name='api-admin-buscar-productos'),
    path('admin/generar-codigo/', GenerarSiguienteCodigoProductoView.as_view(), name='api-admin-generar-codigo'),
]
