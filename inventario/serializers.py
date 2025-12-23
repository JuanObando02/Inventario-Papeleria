from .models import Producto, Inventario
from rest_framework import serializers

class ProductoPOSSerializer(serializers.ModelSerializer):
    stock = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            'id', 'nombre', 'precio_venta', 
            'codigo_barras', 'codigo_interno', 
            'tipo', 'stock'
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

class ArmarAnchetaInputSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField(help_text="ID del producto tipo Ancheta")
    sede_id = serializers.IntegerField(help_text="ID de la sede donde se armará")
    cantidad = serializers.IntegerField(min_value=1, default=1)