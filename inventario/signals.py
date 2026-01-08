from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Producto, Sede, Inventario

@receiver(post_save, sender=Producto)
def crear_inventario_por_defecto(sender, instance, created, **kwargs):
    """
    Cada vez que se crea un producto, generamos su inventario en 0
    para todas las sedes activas. Usamos on_commit para no interferir
    con los inlines del admin de Django.
    """
    if created:
        def create_missing_inventory():
            sedes_activas = Sede.objects.filter(activa=True)
            for sede in sedes_activas:
                Inventario.objects.get_or_create(
                    producto=instance,
                    sede=sede,
                    defaults={'stock_actual': 0}
                )
        
        transaction.on_commit(create_missing_inventory)

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
            print("Producto", producto, "agregado en la sede:", instance)
        Inventario.objects.bulk_create(items_inventario)
        print("Inventario creado para la sede:", instance)  