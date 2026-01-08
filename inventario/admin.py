from django.contrib import admin
from .models import Sede, Categoria, Producto, RecetaAncheta, Inventario, MovimientoInventario
from django.db.models import Sum

@admin.register(Sede)
class SedeAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'direccion', 'activa')

class InventarioInline(admin.TabularInline):
    """Permite ver y editar el stock de cada sede dentro de la pantalla del Producto"""
    model = Inventario
    extra = 1

class RecetaInline(admin.TabularInline):
    model = RecetaAncheta
    fk_name = 'producto_padre'
    extra = 1

@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('codigo_interno', 'nombre', 'tipo', 'precio_venta', 'get_stock_total')
    list_filter = ('tipo', 'categoria')
    search_fields = ('nombre', 'codigo_barras', 'codigo_interno')
    inlines = [InventarioInline, RecetaInline] # <-- AQUI AGREGAMOS EL INVENTARIO

    # Función auxiliar para ver el stock sumado de todas las sedes en la lista
    def get_stock_total(self, obj):
        resultado = obj.inventarios.aggregate(total=Sum('stock_actual'))
        return resultado['total'] or 0

    get_stock_total.short_description = "Stock Global"

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre',)

@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'tipo', 'producto', 'cantidad', 'sede_origen', 'sede_destino', 'usuario')
    list_filter = ('tipo', 'fecha', 'sede_origen')
    search_fields = ('producto__nombre', 'motivo')
    autocomplete_fields = ['producto'] # Para buscar rápido si tienes muchos productos

    # Importante: Como el save() altera el stock, es mejor no dejar editar movimientos pasados
    # para no descuadrar el inventario histórico.
    def has_change_permission(self, request, obj=None):
        return False
    
    # Pre-llenar el usuario logueado automáticamente
    def save_model(self, request, obj, form, change):
        if not obj.usuario_id:
            obj.usuario = request.user
        super().save_model(request, obj, form, change)