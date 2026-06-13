from django.db import models
from django.core.exceptions import ValidationError
from .base import Producto, Sede

class Inventario(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='inventarios')
    sede = models.ForeignKey(Sede, on_delete=models.CASCADE, related_name='inventarios')
    
    stock_actual = models.IntegerField(default=0)
    stock_minimo = models.IntegerField(default=5, help_text="Alerta cuando baje de esta cantidad en esta sede")
    
    ubicacion = models.CharField(max_length=50, blank=True, help_text="Ej: Pasillo 3, Estante A")

    class Meta:
        app_label = 'inventario'
        unique_together = ('producto', 'sede') # Un producto solo aparece una vez por sede
        verbose_name_plural = "Inventarios / Existencias"

    def __str__(self):
        return f"{self.producto.nombre} en {self.sede.nombre}: {self.stock_actual}"

    def clean(self):
        if self.producto.tipo in ['SERVICIO', 'ANCHETA'] and self.stock_actual > 0:
            raise ValidationError(f"Un producto de tipo {self.producto.tipo} no puede tener stock físico.")
