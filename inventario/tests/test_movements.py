from django.test import TestCase
from django.contrib.auth import get_user_model
from inventario.models import Producto, Sede, Inventario, MovimientoInventario
from _decimal import Decimal

User = get_user_model()

class WeightedAverageCostTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testadmin', password='password')
        self.sede = Sede.objects.create(nombre='Sede Principal')
        self.producto = Producto.objects.create(
            nombre='Cuaderno',
            codigo_interno='C001',
            precio_costo=100.00,
            precio_venta=200.00,
            tipo='FISICO'
        )
        inv, _ = Inventario.objects.get_or_create(producto=self.producto, sede=self.sede)
        inv.stock_actual = 10
        inv.save()

    def test_weighted_average_calculation(self):
        mov = MovimientoInventario(
            usuario=self.user,
            producto=self.producto,
            tipo='ENTRADA',
            cantidad=10,
            sede_origen=self.sede,
            costo_unitario=200.00,
            motivo='Compra nueva batch'
        )
        mov.save()
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_costo, 150.00)
        inv = Inventario.objects.get(producto=self.producto, sede=self.sede)
        self.assertEqual(inv.stock_actual, 20)

    def test_entry_without_cost_keeps_average(self):
        mov = MovimientoInventario(
            usuario=self.user,
            producto=self.producto,
            tipo='ENTRADA',
            cantidad=5,
            sede_origen=self.sede,
            costo_unitario=None,
            motivo='Entrada sin costo'
        )
        mov.save()
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_costo, 100.00)

    def test_first_time_entry_creates_inventory(self):
        nueva_sede = Sede.objects.create(nombre='Nueva Sede')
        Inventario.objects.filter(producto=self.producto, sede=nueva_sede).delete()
        mov = MovimientoInventario(
            usuario=self.user,
            producto=self.producto,
            tipo='ENTRADA',
            cantidad=50,
            sede_origen=nueva_sede,
            motivo='Inauguración',
            costo_unitario=100.00
        )
        mov.save()
        inv = Inventario.objects.get(producto=self.producto, sede=nueva_sede)
        self.assertEqual(inv.stock_actual, 50)

    def test_decimal_precision_error(self):
        """
        Test that calculations resulting in repeating decimals (e.g. 1/3) don't crash
        due to max_digits constraint.
        Scenario:
        Current Stock: 1 @ 10
        Entry: 2 @ 10
        Total: 3 @ 10. (Easy)
        
        Let's try:
        Stock: 1 @ 10
        Entry: 1 @ 11
        Total: 2 @ 10.5
        
        Harder:
        Stock: 1 @ 10
        Entry: 2 units @ Cost 11
        Total Stock: 3. Total Value: 10 + 22 = 32.
        Avg Cost: 32 / 3 = 10.6666666...
        This should be rounded to 10.67
        """
        self.producto.precio_costo = 10.00
        self.producto.save()
        Inventario.objects.filter(producto=self.producto).update(stock_actual=1)
        
        mov = MovimientoInventario(
            usuario=self.user,
            producto=self.producto,
            tipo='ENTRADA',
            cantidad=2,
            sede_origen=self.sede,
            costo_unitario=11.00,
            motivo='Precision Test'
        )
        mov.save() # Should not crash
        
        self.producto.refresh_from_db()
        # 32 / 3 = 10.666... -> 10.67
        self.assertEqual(self.producto.precio_costo, Decimal('10.67'))
