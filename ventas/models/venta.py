from django.db import models
from django.conf import settings
from inventario.models import Producto
from .caja import SesionCaja

class Venta(models.Model):
    METODOS_PAGO = (
        ('EFECTIVO', 'Efectivo'),
        ('TRANSFERENCIA', 'Transferencia / QR'),
        ('TARJETA', 'Tarjeta Débito/Crédito'),
    )

    sesion_caja = models.ForeignKey(SesionCaja, on_delete=models.PROTECT, related_name='ventas')
    fecha = models.DateTimeField(auto_now_add=True)
    cliente_nombre = models.CharField(max_length=100, default="Cliente General")
    
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    metodo_pago = models.CharField(max_length=20, choices=METODOS_PAGO, default='EFECTIVO')

    anulada = models.BooleanField(default=False)
    motivo_anulacion = models.CharField(max_length=200, blank=True)
    anulada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name='ventas_anuladas'
    )
    fecha_anulacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'ventas'

    def __str__(self):
        return f"Venta #{self.id} - ${self.total}"

class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Costo del producto al momento de la venta")
    
    id_agrupador_kit = models.CharField(max_length=50, null=True, blank=True, help_text="UUID para agrupar items de una misma ancheta")
    porcentaje_comision = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Porcentaje de comisión/margen aplicado (especialmente para anchetas)")

    class Meta:
        app_label = 'ventas'

    def save(self, *args, **kwargs):
        self.subtotal = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.cantidad} x {self.producto.nombre}"
