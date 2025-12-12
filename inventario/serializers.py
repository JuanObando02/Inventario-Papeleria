from .models import Producto
from rest_framework import serializers

class ProductoPOSSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'precio_venta', 'codigo_barras', 'codigo_interno', 'tipo']

class ArmarAnchetaInputSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField(help_text="ID del producto tipo Ancheta")
    sede_id = serializers.IntegerField(help_text="ID de la sede donde se armará")
    cantidad = serializers.IntegerField(min_value=1, default=1)