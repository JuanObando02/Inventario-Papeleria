from django.db import models
from django.db.models import Sum
from django.core.exceptions import ValidationError
from django.db import transaction
from django.conf import settings
from .base import Producto, Sede
from .inventario_model import Inventario

class MovimientoInventario(models.Model):

    TIPOS = (
        ('ENTRADA', 'Entrada / Compra'), 
        ('SALIDA', 'Salida / Ajuste / Pérdida'),
        ('TRASLADO', 'Traslado entre Sedes'),
        ('VENTA', 'Venta al Público'),
    )

    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    tipo = models.CharField(max_length=10, choices=TIPOS)
    cantidad = models.PositiveIntegerField()
    
    sede_origen = models.ForeignKey(Sede, on_delete=models.PROTECT, related_name='movimientos_salida')
    sede_destino = models.ForeignKey(Sede, on_delete=models.PROTECT, related_name='movimientos_entrada', null=True, blank=True)
    
    motivo = models.CharField(max_length=200, help_text="Ej: Factura de compra #123, Traslado por falta de stock, etc.")
    
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Costo al momento de la compra")

    class Meta:
        app_label = 'inventario'

    def __str__(self):
        return f"{self.tipo} - {self.producto.nombre} ({self.cantidad})"

    def clean(self):
        # verificaciones
        if self.tipo == 'TRASLADO' and not self.sede_destino:
            raise ValidationError("Para un TRASLADO debes especificar la Sede Destino.")
        if self.tipo == 'TRASLADO' and self.sede_origen == self.sede_destino:
            raise ValidationError("La sede de origen y destino no pueden ser la misma.")
        
        if self.tipo in ['SALIDA', 'TRASLADO', 'VENTA']:
            inventario_origen = Inventario.objects.filter(
                producto=self.producto, 
                sede=self.sede_origen
            ).first()

            if not inventario_origen:
                raise ValidationError(f"No existe inventario de {self.producto.nombre} en la sede {self.sede_origen}.")

            if inventario_origen.stock_actual < self.cantidad:
                raise ValidationError(
                    f"No hay suficiente stock en {self.sede_origen}. "
                    f"Tienes {inventario_origen.stock_actual}, intentas mover {self.cantidad}."
                )

    @transaction.atomic
    def save(self, *args, **kwargs):
        self.full_clean() 

        if not self.pk: 
            if self.tipo == 'ENTRADA':
                inv_origen, created = Inventario.objects.get_or_create(
                    producto=self.producto, 
                    sede=self.sede_origen,
                    defaults={'stock_actual': 0}
                )
                
                if self.costo_unitario is not None:
                    total_stock_actual = Inventario.objects.filter(producto=self.producto).aggregate(t=Sum('stock_actual'))['t'] or 0
                    costo_actual = self.producto.precio_costo
                    
                    numerador = (total_stock_actual * costo_actual) + (self.cantidad * self.costo_unitario)
                    denominador = total_stock_actual + self.cantidad
                    
                    if denominador > 0:
                        nuevo_costo_promedio = numerador / denominador
                        nuevo_costo_promedio = round(nuevo_costo_promedio, 2)

                        self.producto.precio_costo = nuevo_costo_promedio
                        self.producto.save()
                
                inv_origen.stock_actual += self.cantidad
                inv_origen.save()

            elif self.tipo in ['SALIDA', 'VENTA']:
                inv_origen = Inventario.objects.get(producto=self.producto, sede=self.sede_origen)
                inv_origen.stock_actual -= self.cantidad
                inv_origen.save()

            elif self.tipo == 'TRASLADO':
                inv_origen = Inventario.objects.get(producto=self.producto, sede=self.sede_origen)
                inv_origen.stock_actual -= self.cantidad
                inv_origen.save()

                inv_destino, _ = Inventario.objects.get_or_create(
                    producto=self.producto, 
                    sede=self.sede_destino,
                    defaults={'stock_actual': 0}
                )
                inv_destino.stock_actual += self.cantidad
                inv_destino.save()

        super().save(*args, **kwargs)
