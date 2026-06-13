from django.db import models
from django.conf import settings
from inventario.models import Sede

class SesionCaja(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    sede = models.ForeignKey(Sede, on_delete=models.PROTECT)
    
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    
    monto_base = models.DecimalField(max_digits=10, decimal_places=2, help_text = "Dinero con el que inicia la caja")
    
    total_ventas_sistema = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Calculado por el sistema")
    dinero_fisico_declarado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Lo que el cajero cuenta manualmente")
    diferencia = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Faltante o Sobrante")
    
    activa = models.BooleanField(default=True)

    class Meta:
        app_label = 'ventas'

    def __str__(self):
        return f"Caja {self.id} - {self.usuario} ({self.fecha_apertura.date()})"
