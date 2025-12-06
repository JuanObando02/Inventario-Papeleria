from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Inventario, RecetaAncheta

def armar_ancheta(producto_ancheta, sede, cantidad_a_armar):
    """
    Lógica transaccional para convertir insumos en una Ancheta pre-armada.
    """
    if producto_ancheta.tipo != 'ANCHETA':
        raise ValidationError("El producto seleccionado no es una Ancheta.")

    # 1. Obtener la receta (ingredientes)
    ingredientes = RecetaAncheta.objects.filter(producto_padre=producto_ancheta)
    
    if not ingredientes.exists():
        raise ValidationError("Esta ancheta no tiene ingredientes definidos.")

    # Usamos transaction.atomic para asegurar que O se hace todo O no se hace nada
    # Esto evita que se descuenten los chocolates si falla el descuento de la canasta.
    with transaction.atomic():
        
        # 2. Verificar y Descontar Stock de Insumos
        for linea_receta in ingredientes:
            insumo = linea_receta.producto_hijo
            cantidad_requerida = linea_receta.cantidad * cantidad_a_armar
            
            # Buscamos el inventario de este insumo en la sede específica
            try:
                stock_insumo = Inventario.objects.select_for_update().get(
                    producto=insumo, 
                    sede=sede
                )
            except Inventario.DoesNotExist:
                raise ValidationError(f"No hay registro de inventario para {insumo.nombre} en esta sede.")

            if stock_insumo.stock_actual < cantidad_requerida:
                raise ValidationError(
                    f"No hay suficiente stock de {insumo.nombre}. "
                    f"Necesitas {cantidad_requerida}, tienes {stock_insumo.stock_actual}."
                )

            # Restamos el insumo
            stock_insumo.stock_actual -= cantidad_requerida
            stock_insumo.save()

        # 3. Sumar Stock a la Ancheta Final
        stock_ancheta, created = Inventario.objects.get_or_create(
            producto=producto_ancheta, 
            sede=sede
        )
        stock_ancheta.stock_actual += cantidad_a_armar
        stock_ancheta.save()

    return True