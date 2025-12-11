# ventas/admin.py
from django.contrib import admin
from .models import SesionCaja, Venta, DetalleVenta

# 1. Configuración para ver los productos DENTRO de la venta
class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    readonly_fields = ('producto', 'cantidad', 'precio_unitario', 'subtotal')
    can_delete = False
    extra = 0 # No mostrar filas vacías extra

# 2. Configuración de la Venta
@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha', 'cliente_nombre', 'total', 'metodo_pago', 'sesion_caja')
    list_filter = ('fecha', 'metodo_pago')
    search_fields = ('cliente_nombre',)
    inlines = [DetalleVentaInline] # Aquí insertamos el detalle
    
    # Opcional: Para que no modifiquen ventas históricas por error
    def has_change_permission(self, request, obj=None):
        return False 

# 3. Configuración de la Caja (Lo que necesitas para tu prueba)
@admin.register(SesionCaja)
class SesionCajaAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'sede', 'fecha_apertura', 'activa', 'total_ventas_sistema')
    list_filter = ('activa', 'sede', 'fecha_apertura')
    
    # Acciones rápidas
    actions = ['cerrar_cajas_masivamente']

    def cerrar_cajas_masivamente(self, request, queryset):
        queryset.update(activa=False)
    cerrar_cajas_masivamente.short_description = "Cerrar cajas seleccionadas"