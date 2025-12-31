from django.db import models
from django.db.models import Sum
from django.core.exceptions import ValidationError
from django.db import transaction
from django.conf import settings

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

class MovimientoInventario(models.Model):
    TIPOS = (
        ('ENTRADA', 'Entrada / Compra'), # Suma stock
        ('SALIDA', 'Salida / Ajuste / Pérdida'), # Resta stock (ej. robo, daño)
        ('TRASLADO', 'Traslado entre Sedes'), # Resta de Origen, Suma en Destino
    )

    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    tipo = models.CharField(max_length=10, choices=TIPOS)
    cantidad = models.PositiveIntegerField()
    
    # Origen y Destino
    sede_origen = models.ForeignKey(Sede, on_delete=models.PROTECT, related_name='movimientos_salida')
    sede_destino = models.ForeignKey(Sede, on_delete=models.PROTECT, related_name='movimientos_entrada', null=True, blank=True)
    
    motivo = models.CharField(max_length=200, help_text="Ej: Factura de compra #123, Traslado por falta de stock, etc.")
    
    # Campo para el costo histórico y cálculo de promedio ponderado
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Costo al momento de la compra")

    def __str__(self):
        return f"{self.tipo} - {self.producto.nombre} ({self.cantidad})"

    def clean(self):
        if self.tipo == 'TRASLADO' and not self.sede_destino:
            raise ValidationError("Para un TRASLADO debes especificar la Sede Destino.")
        if self.tipo == 'TRASLADO' and self.sede_origen == self.sede_destino:
            raise ValidationError("La sede de origen y destino no pueden ser la misma.")
        
        # Solo validamos si es SALIDA o TRASLADO (que son los que restan)
        if self.tipo in ['SALIDA', 'TRASLADO']:
            # Buscamos si existe inventario en el origen
            inventario_origen = Inventario.objects.filter(
                producto=self.producto, 
                sede=self.sede_origen
            ).first()

            # No existe el registro de inventario siquiera
            if not inventario_origen:
                raise ValidationError(f"No existe inventario de {self.producto.nombre} en la sede {self.sede_origen}.")

            # Existe, pero no alcanza
            if inventario_origen.stock_actual < self.cantidad:
                raise ValidationError(
                    f"No hay suficiente stock en {self.sede_origen}. "
                    f"Tienes {inventario_origen.stock_actual}, intentas mover {self.cantidad}."
                )

    @transaction.atomic
    def save(self, *args, **kwargs):
        # Ejecutamos clean() para asegurar que incluso por código se validen las reglas
        self.full_clean() 

        # Si es un registro nuevo, aplicamos los cambios matemáticos
        if not self.pk: 
            
            if self.tipo == 'ENTRADA':
                # Para entradas, aseguramos que exista el registro de inventario
                inv_origen, created = Inventario.objects.get_or_create(
                    producto=self.producto, 
                    sede=self.sede_origen,
                    defaults={'stock_actual': 0}
                )
                
                # -----------------------------------------------------------
                # CÁLCULO DE PROMEDIO PONDERADO (Weighted Average Cost)
                # -----------------------------------------------------------
                if self.costo_unitario is not None:
                    # 1. Obtenemos el Stock Total Global ACTUAL (antes de sumar lo nuevo)
                    total_stock_actual = Inventario.objects.filter(producto=self.producto).aggregate(t=Sum('stock_actual'))['t'] or 0
                    
                    # 2. Precio de Costo Actual del Producto
                    costo_actual = self.producto.precio_costo
                    
                    # 3. Fórmula: ((StockViejo * CostoViejo) + (CantNueva * CostoNuevo)) / (StockViejo + CantNueva)
                    # Usamos decimales para precisión
                    numerador = (total_stock_actual * costo_actual) + (self.cantidad * self.costo_unitario)
                    denominador = total_stock_actual + self.cantidad
                    
                    if denominador > 0:
                        nuevo_costo_promedio = numerador / denominador
                        
                        # REDONDEO para evitar error de max_digits (ej. 133.33333333...)
                        # Ajustamos a 2 decimales
                        nuevo_costo_promedio = round(nuevo_costo_promedio, 2)

                        # Actualizamos el Producto con el nuevo costo promedio
                        self.producto.precio_costo = nuevo_costo_promedio
                        self.producto.save()
                
                # Finalmente sumamos el stock físico
                inv_origen.stock_actual += self.cantidad
                inv_origen.save()

            elif self.tipo == 'SALIDA':
                # Para salida, el inventario DEBE existir (validado en clean)
                inv_origen = Inventario.objects.get(producto=self.producto, sede=self.sede_origen)
                inv_origen.stock_actual -= self.cantidad
                inv_origen.save()

            elif self.tipo == 'TRASLADO':
                # Para traslado, origen existe (validado en clean)
                inv_origen = Inventario.objects.get(producto=self.producto, sede=self.sede_origen)
                inv_origen.stock_actual -= self.cantidad
                inv_origen.save()

                # Usamos get_or_create por si en el destino nunca ha habido ese producto
                inv_destino, _ = Inventario.objects.get_or_create(
                    producto=self.producto, 
                    sede=self.sede_destino,
                    defaults={'stock_actual': 0}
                )
                inv_destino.stock_actual += self.cantidad
                inv_destino.save()

        super().save(*args, **kwargs)