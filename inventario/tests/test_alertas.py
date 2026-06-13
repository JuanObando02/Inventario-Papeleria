from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from inventario.models import Producto, Sede, Inventario
from usuarios.models import PerfilUsuario

User = get_user_model()

class AlertasStockTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.sede1 = Sede.objects.create(nombre='Sede Norte')
        self.sede2 = Sede.objects.create(nombre='Sede Sur')

        self.admin = User.objects.create_user(username='admin', password='password')
        PerfilUsuario.objects.create(usuario=self.admin, rol='ADMIN')

        self.empleado = User.objects.create_user(username='empleado', password='password')
        PerfilUsuario.objects.create(usuario=self.empleado, rol='EMPLEADO', sede=self.sede1)

        self.producto_bajo = Producto.objects.create(
            nombre='Lapicero', codigo_interno='L001',
            precio_costo=500, precio_venta=1000, tipo='FISICO'
        )
        self.producto_ok = Producto.objects.create(
            nombre='Resma', codigo_interno='R001',
            precio_costo=10000, precio_venta=15000, tipo='FISICO'
        )
        # La señal post_save usa transaction.on_commit (no corre en TestCase),
        # así que creamos los inventarios explícitamente.
        # producto_bajo: stock 2 (mínimo default 5) en sede1; en sede2 con stock alto para que no alerte
        Inventario.objects.create(producto=self.producto_bajo, sede=self.sede1, stock_actual=2)
        Inventario.objects.create(producto=self.producto_bajo, sede=self.sede2, stock_actual=50)
        # producto_ok: sobre el mínimo en ambas sedes
        Inventario.objects.create(producto=self.producto_ok, sede=self.sede1, stock_actual=100)
        Inventario.objects.create(producto=self.producto_ok, sede=self.sede2, stock_actual=100)

    def test_producto_bajo_minimo_aparece(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/inventario/alertas-stock/?sede_id=%s' % self.sede1.id)
        self.assertEqual(res.status_code, 200)
        nombres = [a['producto_nombre'] for a in res.data]
        self.assertIn('Lapicero', nombres)
        self.assertNotIn('Resma', nombres)

    def test_admin_ve_todas_las_sedes(self):
        # Bajamos también el stock en sede2 para generar otra alerta
        Inventario.objects.filter(producto=self.producto_bajo, sede=self.sede2).update(stock_actual=0)
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/inventario/alertas-stock/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)

    def test_empleado_solo_ve_su_sede(self):
        Inventario.objects.filter(producto=self.producto_bajo, sede=self.sede2).update(stock_actual=0)
        self.client.force_authenticate(user=self.empleado)
        res = self.client.get('/api/inventario/alertas-stock/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['sede_id'], self.sede1.id)

    def test_producto_inactivo_no_alerta(self):
        self.producto_bajo.activo = False
        self.producto_bajo.save()
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/inventario/alertas-stock/')
        self.assertEqual(len(res.data), 0)

    def test_admin_actualiza_stock_minimo(self):
        inv = Inventario.objects.get(producto=self.producto_ok, sede=self.sede1)
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(f'/api/inventario/inventarios/{inv.id}/', {'stock_minimo': 20}, format='json')
        self.assertEqual(res.status_code, 200)
        inv.refresh_from_db()
        self.assertEqual(inv.stock_minimo, 20)

    def test_empleado_no_puede_actualizar_minimo(self):
        inv = Inventario.objects.get(producto=self.producto_ok, sede=self.sede1)
        self.client.force_authenticate(user=self.empleado)
        res = self.client.patch(f'/api/inventario/inventarios/{inv.id}/', {'stock_minimo': 20}, format='json')
        self.assertEqual(res.status_code, 403)
        inv.refresh_from_db()
        self.assertEqual(inv.stock_minimo, 5)
