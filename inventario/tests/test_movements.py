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


from rest_framework.test import APIClient
from usuarios.models import PerfilUsuario

class HistorialMovimientosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.sede1 = Sede.objects.create(nombre='Sede Norte')
        self.sede2 = Sede.objects.create(nombre='Sede Sur')

        self.admin = User.objects.create_user(username='admin', password='password')
        PerfilUsuario.objects.create(usuario=self.admin, rol='ADMIN')
        self.empleado = User.objects.create_user(username='empleado', password='password')
        PerfilUsuario.objects.create(usuario=self.empleado, rol='EMPLEADO', sede=self.sede1)

        self.producto = Producto.objects.create(
            nombre='Cuaderno', codigo_interno='C001',
            precio_costo=100, precio_venta=200, tipo='FISICO'
        )
        Inventario.objects.create(producto=self.producto, sede=self.sede1, stock_actual=50)

        # ENTRADA en sede1, TRASLADO sede1 -> sede2
        MovimientoInventario.objects.create(
            usuario=self.admin, producto=self.producto, tipo='ENTRADA',
            cantidad=10, sede_origen=self.sede1, motivo='Compra'
        )
        MovimientoInventario.objects.create(
            usuario=self.admin, producto=self.producto, tipo='TRASLADO',
            cantidad=5, sede_origen=self.sede1, sede_destino=self.sede2, motivo='Reparto'
        )
        self.url = '/api/inventario/movimientos/'

    def test_lista_paginada(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 2)
        self.assertIn('results', res.data)

    def test_filtro_por_tipo(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url + '?tipo=ENTRADA')
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['tipo'], 'ENTRADA')

    def test_filtro_por_sede_incluye_origen_y_destino(self):
        self.client.force_authenticate(user=self.admin)
        # sede2 solo participa como destino del traslado
        res = self.client.get(self.url + f'?sede_id={self.sede2.id}')
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['tipo'], 'TRASLADO')

    def test_filtro_por_producto(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url + '?q=cuader')
        self.assertEqual(res.data['count'], 2)
        res = self.client.get(self.url + '?q=inexistente')
        self.assertEqual(res.data['count'], 0)

    def test_empleado_no_ve_historial(self):
        self.client.force_authenticate(user=self.empleado)
        res = self.client.get(self.url)
        self.assertEqual(res.data['count'], 0)
