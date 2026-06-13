from django.db import models
from django.core.exceptions import ValidationError

class Sede(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200, blank=True)
    activa = models.BooleanField(default=True)

    class Meta:
        app_label = 'inventario'

    def __str__(self):
        return self.nombre

class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True, help_text="Coloca el nombre de la categoria del producto")

    class Meta:
        app_label = 'inventario'

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

    componentes = models.ManyToManyField(
        'self',
        through='RecetaAncheta',
        symmetrical=False,
        related_name='parte_de_kits'
    )

    class Meta:
        app_label = 'inventario'
    
    # Validacion de que el precio de venta no sea menor al costo
    def clean(self):
        if self.precio_venta < self.precio_costo:
            raise ValidationError("El precio de venta no puede ser menor al costo.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nombre} ({self.codigo_interno})"

class RecetaAncheta(models.Model):
    producto_padre = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='ingredientes')
    producto_hijo = models.ForeignKey(Producto, on_delete=models.PROTECT) 
    cantidad = models.PositiveIntegerField(default=1)

    class Meta:
        app_label = 'inventario'
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
