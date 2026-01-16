from django.db import models
from django.conf import settings # Para importar el usuario
from django.utils import timezone
from inventario.models import Producto, Sede # Importamos lo que ya hiciste

class SesionCaja(models.Model):
    """ Representa un turno de trabajo. Un empleado abre caja y la cierra. """
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    sede = models.ForeignKey(Sede, on_delete=models.PROTECT)
    
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    
    monto_base = models.DecimalField(max_digits=10, decimal_places=2, help_text = "Dinero con el que inicia la caja")
    
    # Estos campos se llenan al cerrar
    total_ventas_sistema = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Calculado por el sistema")
    dinero_fisico_declarado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Lo que el cajero cuenta manualmente")
    diferencia = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Faltante o Sobrante")
    
    # se desactiva al cerrar la caja
    activa = models.BooleanField(default=True)

    def __str__(self):
        return f"Caja {self.id} - {self.usuario} ({self.fecha_apertura.date()})"

class Venta(models.Model):
    METODOS_PAGO = (
        ('EFECTIVO', 'Efectivo'),
        ('TRANSFERENCIA', 'Transferencia / QR'),
        ('TARJETA', 'Tarjeta Débito/Crédito'),
    )

    # Vinculamos la venta a una sesión específica (para saber quién la hizo y en qué turno)
    sesion_caja = models.ForeignKey(SesionCaja, on_delete=models.PROTECT, related_name='ventas')
    
    fecha = models.DateTimeField(auto_now_add=True)
    cliente_nombre = models.CharField(max_length=100, default="Cliente General")
    # Si quisieras factura electrónica, aquí iría el NIT/Cédula
    
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    metodo_pago = models.CharField(max_length=20, choices=METODOS_PAGO, default='EFECTIVO')

    def __str__(self):
        return f"Venta #{self.id} - ${self.total}"

class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    
    cantidad = models.PositiveIntegerField()
    
    # IMPORTANTE: Guardamos el precio AQUÍ. 
    # Si el producto cambia de precio mañana, esta venta histórica no se altera.
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Campo para agrupar items "sueltos" que pertenecen a una misma Ancheta dinámica
    id_agrupador_kit = models.CharField(max_length=50, null=True, blank=True, help_text="UUID para agrupar items de una misma ancheta")

    def save(self, *args, **kwargs):
        # Calculamos subtotal automáticamente antes de guardar
        self.subtotal = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.cantidad} x {self.producto.nombre}"

class DetalleVentaComponente(models.Model):
    """ Registro histórico de los componentes que conformaron una Ancheta en una venta específica """
    detalle_venta = models.ForeignKey(DetalleVenta, on_delete=models.CASCADE, related_name='componentes')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    
    cantidad = models.PositiveIntegerField()
    
    # Precio al que se vendió el componente individual dentro de la ancheta
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        self.subtotal = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.cantidad} x {self.producto.nombre} (Componente de {self.detalle_venta})"