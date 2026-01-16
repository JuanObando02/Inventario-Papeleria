from rest_framework import serializers
from django.db import transaction, models
from django.utils import timezone
from .models import Venta, DetalleVenta, SesionCaja, DetalleVentaComponente
from inventario.models import Producto, Inventario, MovimientoInventario

class ComponenteInputSerializer(serializers.Serializer):
    """Estructura para los componentes de una Ancheta"""
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)

class DetalleVentaInputSerializer(serializers.Serializer):
    """Estructura simple para recibir los datos de cada item"""
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    precio_unitario = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    # Identificador para Agrupación Dinámica (Anchetas "al vuelo")
    kit_uuid = serializers.CharField(required=False, allow_null=True)
    # Componentes opcionales para cuando se vende una ANCHETA (Legado/Estático)
    componentes = ComponenteInputSerializer(many=True, required=False)

class CrearVentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaInputSerializer(many=True)

    class Meta:
        model = Venta
        fields = ['sesion_caja', 'metodo_pago', 'cliente_nombre', 'detalles']

    def validate_sesion_caja(self, value):
        """Validar que la caja exista y esté abierta"""
        if not value.activa:
            raise serializers.ValidationError("Esta caja ya está cerrada. No se puede vender.")
        return value

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        sesion = validated_data['sesion_caja']
        sede_actual = sesion.sede # Obtenemos la sede de la caja actual

        # Usamos atomic para asegurar consistencia total
        with transaction.atomic():
            # 1. Crear la Venta (Cabecera)
            venta = Venta.objects.create(**validated_data)
            total_acumulado = 0

            # 2. Procesar cada producto
            for item in detalles_data:
                producto = Producto.objects.get(id=item['producto_id'])
                cantidad_items = item['cantidad']
                
                # PRECIO DINÁMICO: Si el front envía un precio lo usamos, de lo contrario el de la DB
                precio_item = item.get('precio_unitario', producto.precio_venta)

                # A. Validar y Descontar Stock (Lógica Crítica)
                # Solo descontamos stock si el producto principal es FISICO.
                # Las ANCHETAS y SERVICIOS no tienen stock propio.
                if producto.tipo == 'FISICO':
                    try:
                        inventario = Inventario.objects.select_for_update().get(
                            producto=producto, 
                            sede=sede_actual
                        )
                    except Inventario.DoesNotExist:
                        raise serializers.ValidationError(f"El producto {producto.nombre} no tiene inventario en esta sede.")

                    if inventario.stock_actual < cantidad_items:
                        raise serializers.ValidationError(
                            f"Stock insuficiente para {producto.nombre}. Tienes {inventario.stock_actual}, intentas vender {cantidad_items}."
                        )
                    
                    # En lugar de restar manualmente, creamos un registro de Movimiento
                    # La lógica de resta física ya está en el save() de MovimientoInventario
                    MovimientoInventario.objects.create(
                        usuario=sesion.usuario,
                        producto=producto,
                        tipo='VENTA',
                        cantidad=cantidad_items,
                        sede_origen=sede_actual,
                        motivo=f"Venta #{venta.id}"
                    )

                # B. Crear Detalle de Venta Principal
                kit_uuid = item.get('kit_uuid', None)
                detalle = DetalleVenta.objects.create(
                    venta=venta,
                    producto=producto,
                    cantidad=cantidad_items,
                    precio_unitario=precio_item,
                    subtotal=cantidad_items * precio_item,
                    id_agrupador_kit=kit_uuid
                )

                total_acumulado += (cantidad_items * precio_item)

            # 3. Actualizar total de la venta
            venta.total = total_acumulado
            venta.save()
            
            # 4. Actualizar acumulado en la sesión de caja
            sesion.total_ventas_sistema += total_acumulado
            sesion.save()

        return venta

class CerrarCajaSerializer(serializers.ModelSerializer):
    # El usuario solo envía cuánto dinero contó billete tras billete
    dinero_fisico_declarado = serializers.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        model = SesionCaja
        fields = ['dinero_fisico_declarado']

    def update(self, instance, validated_data):
        """
        Lógica del Arqueo: Comparar Realidad vs Sistema
        """
        dinero_fisico = validated_data['dinero_fisico_declarado']
        
        # 1. Calcular cuánto debería haber (Base + Ventas en Efectivo)
        # Nota: Solo sumamos efectivo. Las transferencias no suman al cajón de monedas.
        ventas_efectivo = instance.ventas.filter(metodo_pago='EFECTIVO').aggregate(
            total=models.Sum('total')
        )['total'] or 0
        
        total_esperado = instance.monto_base + ventas_efectivo

        # 2. Calcular la diferencia
        # Negativo = Falta dinero (Robo o error)
        # Positivo = Sobra dinero
        diferencia = dinero_fisico - total_esperado

        # 3. Guardar datos y cerrar
        instance.dinero_fisico_declarado = dinero_fisico
        instance.total_ventas_sistema = ventas_efectivo # Guardamos cuánto se vendió en efectivo
        instance.diferencia = diferencia
        instance.fecha_cierre = timezone.now()
        instance.activa = False # ¡Caja Cerrada!
        instance.save()

        return instance

# --- SERIALIZERS PARA REPORTES ---
class DetalleReporteSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    
    class Meta:
        model = DetalleVenta
        fields = ['producto_nombre', 'cantidad', 'precio_unitario', 'subtotal']

class VentaReporteSerializer(serializers.ModelSerializer):
    detalles = DetalleReporteSerializer(many=True, read_only=True)
    hora = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ['id', 'hora', 'metodo_pago', 'total', 'detalles']

    def get_hora(self, obj):
        return obj.fecha.strftime("%H:%M")

class SesionReporteSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.ReadOnlyField(source='usuario.username')
    sede_nombre = serializers.ReadOnlyField(source='sede.nombre')
    ventas = VentaReporteSerializer(many=True, read_only=True)
    total_esperado = serializers.SerializerMethodField()

    class Meta:
        model = SesionCaja
        fields = [
            'id', 'usuario_nombre', 'sede_nombre', 'fecha_apertura', 'fecha_cierre',
            'monto_base', 'total_ventas_sistema', 'dinero_fisico_declarado', 'diferencia',
            'activa', 'total_esperado', 'ventas'
        ]

    def get_total_esperado(self, obj):
        if not obj.activa:
            return (obj.monto_base or 0) + (obj.total_ventas_sistema or 0)
        return 0

class SesionResumenSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.ReadOnlyField(source='usuario.username')
    sede_nombre = serializers.ReadOnlyField(source='sede.nombre')
    
    class Meta:
        model = SesionCaja
        fields = [
            'id', 'usuario_nombre', 'sede_nombre', 'fecha_apertura', 'fecha_cierre',
            'diferencia'
        ]