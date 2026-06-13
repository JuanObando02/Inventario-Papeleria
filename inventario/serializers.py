from .models import Producto, Inventario, Categoria, RecetaAncheta
from rest_framework import serializers
from django.db import transaction

class RecetaSerializer(serializers.ModelSerializer):
    producto_id = serializers.ReadOnlyField(source='producto_hijo.id')
    nombre = serializers.ReadOnlyField(source='producto_hijo.nombre')
    precio_venta = serializers.ReadOnlyField(source='producto_hijo.precio_venta')

    class Meta:
        model = RecetaAncheta
        fields = ['producto_id', 'nombre', 'precio_venta', 'cantidad']

class ProductoPOSSerializer(serializers.ModelSerializer):
    stock = serializers.SerializerMethodField()
    ingredientes = RecetaSerializer(many=True, read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id', 'nombre', 'precio_venta', 
            'codigo_barras', 'codigo_interno', 
            'tipo', 'stock', 'categoria', 'ingredientes'
        ]

    def get_stock(self, obj):
        # 1. Recuperamos la sede desde el "contexto" que envió la vista
        sede_id = self.context.get('sede_id')
        
        if not sede_id:
            return 0

        # 2. Buscamos el stock EXACTO de ese producto en esa sede
        try:
            item_inventario = Inventario.objects.get(producto=obj, sede_id=sede_id)
            return item_inventario.stock_actual
        except Inventario.DoesNotExist:
            return 0

class ProductoAdminSerializer(serializers.ModelSerializer):
    """Serializer para uso administrativo que incluye el costo"""
    class Meta:
        model = Producto
        fields = [
            'id', 'nombre', 'precio_venta', 'precio_costo',
            'codigo_barras', 'codigo_interno', 'tipo'
        ]

class ArmarAnchetaInputSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField(help_text="ID del producto tipo Ancheta")
    sede_id = serializers.IntegerField(help_text="ID de la sede donde se armará")
    cantidad = serializers.IntegerField(min_value=1, default=1)

from .models import MovimientoInventario

class MovimientoInventarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoInventario
        fields = [
            'tipo', 'producto', 'cantidad', 
            'sede_origen', 'sede_destino', 'motivo',
            'costo_unitario'
        ]
    
    def validate(self, data):
        """
        Validaciones extra a nivel de serializer antes de pasar al modelo.
        El modelo ya tiene validaciones en el metodo clean(), 
        pero DRF a veces valida antes.
        """
        if data['tipo'] == 'TRASLADO' and not data.get('sede_destino'):
            raise serializers.ValidationError("Para traslados debes indicar la Sede Destino.")
        
        if data['tipo'] == 'TRASLADO' and data['sede_origen'] == data.get('sede_destino'):
            raise serializers.ValidationError("Origen y Destino no pueden ser iguales.")

        if data['producto'].tipo == 'SERVICIO':
              raise serializers.ValidationError(f"El producto '{data['producto'].nombre}' es un SERVICIO y no maneja stock físico.")

        return data

class MovimientoHistorialSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    codigo_interno = serializers.ReadOnlyField(source='producto.codigo_interno')
    sede_origen_nombre = serializers.ReadOnlyField(source='sede_origen.nombre')
    sede_destino_nombre = serializers.ReadOnlyField(source='sede_destino.nombre')
    usuario_nombre = serializers.ReadOnlyField(source='usuario.username')

    class Meta:
        model = MovimientoInventario
        fields = [
            'id', 'fecha', 'tipo', 'producto_nombre', 'codigo_interno',
            'cantidad', 'sede_origen_nombre', 'sede_destino_nombre',
            'usuario_nombre', 'motivo', 'costo_unitario'
        ]

class InventarioGlobalSerializer(serializers.ModelSerializer):
    
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    producto_tipo = serializers.ReadOnlyField(source='producto.tipo')
    producto_costo = serializers.ReadOnlyField(source='producto.precio_costo')
    producto_precio = serializers.ReadOnlyField(source='producto.precio_venta')
    sede_nombre = serializers.ReadOnlyField(source='sede.nombre')
    valor_total_costo = serializers.SerializerMethodField()
    valor_total_venta = serializers.SerializerMethodField()

    class Meta:
        model = Inventario
        fields = [
            'id', 'sede_nombre', 'producto_nombre', 'producto_tipo', 'stock_actual',
            'producto_costo', 'producto_precio', 
            'valor_total_costo', 'valor_total_venta'
        ]

    def get_valor_total_costo(self, obj):
        return obj.stock_actual * obj.producto.precio_costo

    def get_valor_total_venta(self, obj):
        return obj.stock_actual * obj.producto.precio_venta

class AlertaStockSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    codigo_interno = serializers.ReadOnlyField(source='producto.codigo_interno')
    sede_id = serializers.ReadOnlyField(source='sede.id')
    sede_nombre = serializers.ReadOnlyField(source='sede.nombre')

    class Meta:
        model = Inventario
        fields = [
            'id', 'producto_nombre', 'codigo_interno',
            'sede_id', 'sede_nombre',
            'stock_actual', 'stock_minimo', 'ubicacion'
        ]

class StockMinimoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventario
        fields = ['id', 'stock_minimo']

from .models import RecetaAncheta

class RecetaAnchetaSerializer(serializers.ModelSerializer):
    producto_hijo_id = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.filter(activo=True),
        source='producto_hijo',
        write_only=True
    )

    class Meta:
        model = RecetaAncheta
        fields = ['producto_hijo_id', 'cantidad']

class CrearCategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre']

class ProductoCreateSerializer(serializers.ModelSerializer):
    ingredientes = RecetaAnchetaSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = Producto
        fields = [
            'id', 'nombre', 'descripcion', 'codigo_barras', 
            'codigo_interno', 'tipo', 'categoria', 
            'precio_costo', 'precio_venta', 'unidad_medida', 
            'activo', 'ingredientes'
        ]
    
    def validate(self, data):
        # 1. Validar que si es Ancheta, traiga ingredientes (opcional, pero recomendado)
        if data.get('tipo') == 'ANCHETA' and not data.get('ingredientes'):
            # Podríamos hacerlo obligatorio o dejarlo pasar y que lo armen luego.
            # Según requerimiento usuario: "permitir agregar los productos"
            pass
        return data

    @transaction.atomic
    def create(self, validated_data):
        ingredientes_data = validated_data.pop('ingredientes', [])
        tipo = validated_data.get('tipo', 'FISICO')
        
        # 1. Si es ANCHETA, recalculamos el costo basándonos en los ingredientes reales
        if tipo == 'ANCHETA' and ingredientes_data:
            costo_calculado = 0
            for item in ingredientes_data:
                prod_hijo = item['producto_hijo']
                cantidad = item.get('cantidad', 1)
                costo_calculado += (prod_hijo.precio_costo * cantidad)
            validated_data['precio_costo'] = costo_calculado

        # 2. Crear el Producto Padre
        producto = Producto.objects.create(**validated_data)
        
        # 3. Si es Ancheta y hay ingredientes, crearlos
        if producto.tipo == 'ANCHETA' and ingredientes_data:
            recetas = []
            for item in ingredientes_data:
                recetas.append(RecetaAncheta(
                    producto_padre=producto,
                    producto_hijo=item['producto_hijo'],
                    cantidad=item.get('cantidad', 1)
                ))
            if recetas:
                RecetaAncheta.objects.bulk_create(recetas)

        return producto

class RecetaAdminSerializer(serializers.ModelSerializer):
    """Lectura de ingredientes con costo, para el formulario de edición (Admin)."""
    producto_hijo_id = serializers.ReadOnlyField(source='producto_hijo.id')
    nombre = serializers.ReadOnlyField(source='producto_hijo.nombre')
    precio_costo = serializers.ReadOnlyField(source='producto_hijo.precio_costo')

    class Meta:
        model = RecetaAncheta
        fields = ['producto_hijo_id', 'nombre', 'precio_costo', 'cantidad']

class ProductoUpdateSerializer(ProductoCreateSerializer):
    ingredientes_detalle = RecetaAdminSerializer(source='ingredientes', many=True, read_only=True)

    class Meta(ProductoCreateSerializer.Meta):
        fields = ProductoCreateSerializer.Meta.fields + ['ingredientes_detalle']

    @transaction.atomic
    def update(self, instance, validated_data):
        ingredientes_data = validated_data.pop('ingredientes', None)
        tipo = validated_data.get('tipo', instance.tipo)

        if tipo == 'ANCHETA' and ingredientes_data is not None:
            costo_calculado = 0
            for item in ingredientes_data:
                hijo = item['producto_hijo']
                if hijo.id == instance.id:
                    raise serializers.ValidationError("Un producto no puede ser componente de sí mismo.")
                if hijo.tipo == 'ANCHETA':
                    raise serializers.ValidationError("Una Ancheta no puede contener otra Ancheta.")
                costo_calculado += (hijo.precio_costo * item.get('cantidad', 1))
            validated_data['precio_costo'] = costo_calculado

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Reemplazar la receta completa si enviaron ingredientes
        if ingredientes_data is not None and instance.tipo == 'ANCHETA':
            instance.ingredientes.all().delete()
            RecetaAncheta.objects.bulk_create([
                RecetaAncheta(
                    producto_padre=instance,
                    producto_hijo=item['producto_hijo'],
                    cantidad=item.get('cantidad', 1)
                )
                for item in ingredientes_data
            ])

        return instance