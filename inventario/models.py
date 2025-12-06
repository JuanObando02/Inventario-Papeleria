from django.db import models
from django.core.exceptions import ValidationError

class Sede(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200, blank=True)
    activa = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre

class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    def __str__(self):
        return self.nombre

class Producto(models.Model):
    
    TIPOS = (
        ('FISICO', 'Producto Físico'),
        ('SERVICIO', 'Servicio (Copia, Impresión)'),
        ('ANCHETA', 'Ancheta / Kit'),
    )

    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True, null=True)

    codigo_barras = models.CharField(max_length=50, blank=True, null=True, unique=True)
    codigo_interno = models.CharField(max_length=20, unique=True, help_text="Código manual o PLU (Ej: PROD-001)")
    
    tipo = models.CharField(max_length=10, choices=TIPOS, default='FISICO')
    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True, blank=True)
    
    precio_costo = models.DecimalField(max_digits=10, decimal_places=2)
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2)

    unidad_medida = models.CharField(max_length=20, default='UND')
    activo = models.BooleanField(default=True)

    
    # RELACIÓN MÁGICA: Un producto puede tener "componentes" que también son productos.
    # 'symmetrical=False' es vital: Si la ancheta tiene un chocolate, 
    # no significa que el chocolate tenga una ancheta.
    componentes = models.ManyToManyField(
        'self', 
        through='RecetaAncheta', 
        symmetrical=False, 
        related_name='parte_de_kits'
    )
    
    def clean(self):
        # Validación 1: Precio Venta vs Costo
        if self.precio_venta < self.precio_costo:
            raise ValidationError("El precio de venta no puede ser menor al costo.")
        
        # Validación 2: Servicios no deberían tener stock
        if self.tipo == 'SERVICIO' and self.stock_actual > 0:
            raise ValidationError("Un servicio no puede tener stock físico.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nombre} ({self.codigo_interno})"

class Inventario(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='inventarios')
    sede = models.ForeignKey(Sede, on_delete=models.CASCADE, related_name='inventarios')
    
    stock_actual = models.IntegerField(default=0)
    stock_minimo = models.IntegerField(default=5, help_text="Alerta cuando baje de esta cantidad en esta sede")
    
    ubicacion = models.CharField(max_length=50, blank=True, help_text="Ej: Pasillo 3, Estante A")

    class Meta:
        unique_together = ('producto', 'sede') # Un producto solo aparece una vez por sede
        verbose_name_plural = "Inventarios / Existencias"

    def __str__(self):
        return f"{self.producto.nombre} en {self.sede.nombre}: {self.stock_actual}"

    def clean(self):
        # Servicios no deben tener inventario físico en ninguna sede
        if self.producto.tipo == 'SERVICIO' and self.stock_actual > 0:
            raise ValidationError("Un servicio no puede tener stock físico.")

class RecetaAncheta(models.Model):
    producto_padre = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='ingredientes')
    producto_hijo = models.ForeignKey(Producto, on_delete=models.PROTECT) 
    cantidad = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('producto_padre', 'producto_hijo')
        verbose_name = "Ingrediente de Ancheta"
        verbose_name_plural = "Ingredientes de la Ancheta"

    def clean(self):
        if self.producto_padre_id == self.producto_hijo_id:
            raise ValidationError("Un producto no puede ser componente de sí mismo.")
        if self.producto_hijo.tipo == 'ANCHETA':
             raise ValidationError("Por ahora, una Ancheta no puede contener otra Ancheta.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)