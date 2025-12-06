# inventario/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Producto, Sede, Inventario

@receiver(post_save, sender=Producto)
def crear_inventario_por_defecto(sender, instance, created, **kwargs):
    """
    Cada vez que se crea un producto, generamos su inventario en 0
    para todas las sedes activas.
    """
    if created:
        sedes_activas = Sede.objects.filter(activa=True)
        items_inventario = []
        for sede in sedes_activas:
            # Preparamos el objeto pero no lo guardamos aún (bulk_create es más rápido)
            items_inventario.append(
                Inventario(producto=instance, sede=sede, stock_actual=0)
            )
        
        # Guardamos todo de un solo golpe
        Inventario.objects.bulk_create(items_inventario)

@receiver(post_save, sender=Sede)
def crear_inventario_nueva_sede(sender, instance, created, **kwargs):
    """
    Si abrimos una sede nueva, le creamos inventario en 0 para todos
    los productos existentes.
    """
    if created:
        productos = Producto.objects.all()
        items_inventario = []
        for producto in productos:
            items_inventario.append(
                Inventario(producto=producto, sede=instance, stock_actual=0)
            )
        Inventario.objects.bulk_create(items_inventario)