from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from inventario.models import Producto, Sede, Inventario
from usuarios.models import PerfilUsuario
from .models import SesionCaja, Venta

User = get_user_model()

class BaseVentaTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.sede = Sede.objects.create(nombre='Sede Centro')

        self.admin = User.objects.create_user(username='admin', password='password')
        PerfilUsuario.objects.create(usuario=self.admin, rol='ADMIN', sede=self.sede)
        self.empleado = User.objects.create_user(username='empleado', password='password')
        PerfilUsuario.objects.create(usuario=self.empleado, rol='EMPLEADO', sede=self.sede)

        self.producto = Producto.objects.create(
            nombre='Cuaderno', codigo_interno='C001',
            precio_costo=1000, precio_venta=2000, tipo='FISICO'
        )
        Inventario.objects.create(producto=self.producto, sede=self.sede, stock_actual=10)

        self.sesion = SesionCaja.objects.create(
            usuario=self.empleado, sede=self.sede,
            monto_base=50000, total_ventas_sistema=0, activa=True
        )

    def crear_venta(self, cantidad=2, metodo='EFECTIVO'):
        """Crea una venta por la API (descuenta stock y acumula en caja)."""
        self.client.force_authenticate(user=self.empleado)
        res = self.client.post('/api/ventas/crear/', {
            'sesion_caja': self.sesion.id,
            'metodo_pago': metodo,
            'cliente_nombre': 'Cliente Test',
            'detalles': [{'producto_id': self.producto.id, 'cantidad': cantidad}]
        }, format='json')
        assert res.status_code == 201, res.data
        return Venta.objects.get(id=res.data['venta_id'])

    def stock_actual(self):
        return Inventario.objects.get(producto=self.producto, sede=self.sede).stock_actual


class AnularVentaTests(BaseVentaTestCase):
    def test_anular_repone_stock_y_resta_de_caja(self):
        venta = self.crear_venta(cantidad=2)
        self.assertEqual(self.stock_actual(), 8)
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.total_ventas_sistema, 4000)

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Error de digitación'}, format='json')
        self.assertEqual(res.status_code, 200)

        self.assertEqual(self.stock_actual(), 10)
        self.sesion.refresh_from_db()
        self.assertEqual(self.sesion.total_ventas_sistema, 0)
        venta.refresh_from_db()
        self.assertTrue(venta.anulada)
        self.assertEqual(venta.anulada_por, self.admin)
        self.assertEqual(venta.motivo_anulacion, 'Error de digitación')

    def test_anular_no_altera_costo_promedio(self):
        venta = self.crear_venta(cantidad=2)
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Test'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_costo, 1000)

    def test_doble_anulacion_falla(self):
        venta = self.crear_venta()
        self.client.force_authenticate(user=self.admin)
        self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Primera'}, format='json')
        res = self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Segunda'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.stock_actual(), 10)  # solo se repuso una vez

    def test_caja_cerrada_bloquea_anulacion(self):
        venta = self.crear_venta()
        self.sesion.activa = False
        self.sesion.save()

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Tarde'}, format='json')
        self.assertEqual(res.status_code, 400)
        venta.refresh_from_db()
        self.assertFalse(venta.anulada)

    def test_empleado_no_puede_anular(self):
        venta = self.crear_venta()
        self.client.force_authenticate(user=self.empleado)
        res = self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Intento'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_sin_motivo_falla(self):
        venta = self.crear_venta()
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/ventas/anular/{venta.id}/', {}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_cierre_de_caja_excluye_anuladas(self):
        self.crear_venta(cantidad=1)                  # $2000 efectivo (válida)
        venta_anulada = self.crear_venta(cantidad=2)  # $4000 efectivo (se anula)

        self.client.force_authenticate(user=self.admin)
        self.client.post(f'/api/ventas/anular/{venta_anulada.id}/', {'motivo': 'Error'}, format='json')

        # Cerrar declarando exactamente base + venta válida
        res = self.client.put(f'/api/ventas/cerrar/{self.sesion.id}/', {
            'dinero_fisico_declarado': 52000
        }, format='json')
        self.assertEqual(res.status_code, 200)

        self.sesion.refresh_from_db()
        self.assertFalse(self.sesion.activa)
        self.assertEqual(self.sesion.total_ventas_sistema, 2000)
        self.assertEqual(self.sesion.diferencia, 0)

    def test_costo_historico_se_guarda_en_detalle(self):
        venta = self.crear_venta(cantidad=1)
        detalle = venta.detalles.first()
        self.assertEqual(detalle.costo_unitario, Decimal('1000'))


class ReporteVentasTests(BaseVentaTestCase):
    def setUp(self):
        super().setUp()
        self.producto2 = Producto.objects.create(
            nombre='Resma', codigo_interno='R001',
            precio_costo=10000, precio_venta=15000, tipo='FISICO'
        )
        Inventario.objects.create(producto=self.producto2, sede=self.sede, stock_actual=20)
        # fecha__date filtra en hora local (TIME_ZONE), no UTC
        self.hoy = timezone.localdate().isoformat()
        self.url = f'/api/ventas/admin/reportes/ventas/?desde={self.hoy}&hasta={self.hoy}'

    def crear_venta_multi(self, items, metodo='EFECTIVO'):
        self.client.force_authenticate(user=self.empleado)
        res = self.client.post('/api/ventas/crear/', {
            'sesion_caja': self.sesion.id,
            'metodo_pago': metodo,
            'detalles': items
        }, format='json')
        assert res.status_code == 201, res.data
        return Venta.objects.get(id=res.data['venta_id'])

    def test_agregacion_por_producto(self):
        # 2 ventas: cuaderno x3 total, resma x1
        self.crear_venta_multi([{'producto_id': self.producto.id, 'cantidad': 2}])
        self.crear_venta_multi([
            {'producto_id': self.producto.id, 'cantidad': 1},
            {'producto_id': self.producto2.id, 'cantidad': 1}
        ], metodo='TARJETA')

        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)

        productos = {p['nombre']: p for p in res.data['productos']}
        self.assertEqual(productos['Cuaderno']['cantidad'], 3)
        self.assertEqual(productos['Cuaderno']['ingresos'], 6000)
        self.assertEqual(productos['Cuaderno']['utilidad'], 3000)   # (2000-1000)*3
        self.assertEqual(productos['Resma']['cantidad'], 1)
        self.assertEqual(productos['Resma']['utilidad'], 5000)      # 15000-10000

        self.assertEqual(res.data['resumen']['total_vendido'], 21000)
        self.assertEqual(res.data['resumen']['numero_ventas'], 2)
        self.assertEqual(res.data['resumen']['utilidad_total'], 8000)

        metodos = {m['metodo_pago']: m for m in res.data['por_metodo']}
        self.assertEqual(metodos['EFECTIVO']['total'], 4000)
        self.assertEqual(metodos['TARJETA']['total'], 17000)

    def test_venta_anulada_excluida_del_reporte(self):
        venta = self.crear_venta(cantidad=2)
        self.client.force_authenticate(user=self.admin)
        self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Error'}, format='json')

        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['resumen']['numero_ventas'], 0)
        self.assertEqual(len(res.data['productos']), 0)

    def test_utilidad_usa_costo_historico(self):
        venta = self.crear_venta(cantidad=1)  # costo histórico 1000
        # El costo del producto sube después de la venta
        self.producto.precio_costo = 1500
        self.producto.save()

        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        productos = {p['nombre']: p for p in res.data['productos']}
        # Utilidad con costo histórico: 2000 - 1000 = 1000 (no 500)
        self.assertEqual(productos['Cuaderno']['utilidad'], 1000)

        # Si el detalle no tiene costo histórico (venta antigua), usa el costo actual
        venta.detalles.update(costo_unitario=None)
        res = self.client.get(self.url)
        productos = {p['nombre']: p for p in res.data['productos']}
        self.assertEqual(productos['Cuaderno']['utilidad'], 500)

    def test_empleado_no_accede_al_reporte(self):
        self.client.force_authenticate(user=self.empleado)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 403)

    def test_fechas_invalidas(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/ventas/admin/reportes/ventas/?desde=ayer&hasta=hoy')
        self.assertEqual(res.status_code, 400)
        res = self.client.get('/api/ventas/admin/reportes/ventas/')
        self.assertEqual(res.status_code, 400)


class DashboardResumenTests(BaseVentaTestCase):
    def test_resumen_con_venta_y_caja_abierta(self):
        self.crear_venta(cantidad=2)  # $4000, empleado con caja abierta

        self.client.force_authenticate(user=self.empleado)
        res = self.client.get('/api/ventas/dashboard/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['ventas_hoy']['total'], 4000)
        self.assertEqual(res.data['ventas_hoy']['numero'], 1)
        self.assertTrue(res.data['caja']['abierta'])
        self.assertEqual(res.data['caja']['saldo'], 54000)  # base 50000 + 4000
        # Cuaderno quedó en 8 (mínimo default 5): sin alertas
        self.assertEqual(res.data['alertas_stock'], 0)

    def test_alertas_y_anuladas_excluidas(self):
        venta = self.crear_venta(cantidad=8)  # stock queda en 2 -> alerta
        self.client.force_authenticate(user=self.admin)
        self.client.post(f'/api/ventas/anular/{venta.id}/', {'motivo': 'Error'}, format='json')

        # Tras anular: stock vuelve a 10 (sin alerta) y la venta no cuenta
        res = self.client.get('/api/ventas/dashboard/')
        self.assertEqual(res.data['ventas_hoy']['numero'], 0)
        self.assertEqual(res.data['alertas_stock'], 0)
        # El admin no tiene caja propia abierta
        self.assertFalse(res.data['caja']['abierta'])
