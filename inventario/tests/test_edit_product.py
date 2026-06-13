from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from inventario.models import Producto, RecetaAncheta
from usuarios.models import PerfilUsuario

User = get_user_model()

class EditProductTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin', password='password')
        PerfilUsuario.objects.create(usuario=self.admin, rol='ADMIN')
        self.empleado = User.objects.create_user(username='empleado', password='password')
        PerfilUsuario.objects.create(usuario=self.empleado, rol='EMPLEADO')

        self.producto = Producto.objects.create(
            nombre='Cuaderno', codigo_interno='C001',
            precio_costo=1000, precio_venta=2000, tipo='FISICO'
        )
        self.url = f'/api/inventario/admin/productos/{self.producto.id}/'

    def test_get_detalle_producto(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['nombre'], 'Cuaderno')

    def test_patch_cambia_precio(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(self.url, {'precio_venta': 2500}, format='json')
        self.assertEqual(res.status_code, 200)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_venta, 2500)

    def test_patch_desactiva_producto(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(self.url, {'activo': False}, format='json')
        self.assertEqual(res.status_code, 200)
        self.producto.refresh_from_db()
        self.assertFalse(self.producto.activo)

    def test_patch_precio_venta_menor_al_costo_falla(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(self.url, {'precio_venta': 500}, format='json')
        self.assertEqual(res.status_code, 400)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_venta, 2000)

    def test_patch_reemplaza_ingredientes_de_ancheta(self):
        hijo1 = Producto.objects.create(
            nombre='Dulce', codigo_interno='D001',
            precio_costo=100, precio_venta=200, tipo='FISICO'
        )
        hijo2 = Producto.objects.create(
            nombre='Caja', codigo_interno='CJ001',
            precio_costo=500, precio_venta=800, tipo='FISICO'
        )
        ancheta = Producto.objects.create(
            nombre='Ancheta', codigo_interno='A001',
            precio_costo=100, precio_venta=5000, tipo='ANCHETA'
        )
        RecetaAncheta.objects.create(producto_padre=ancheta, producto_hijo=hijo1, cantidad=1)

        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(f'/api/inventario/admin/productos/{ancheta.id}/', {
            'ingredientes': [{'producto_hijo_id': hijo2.id, 'cantidad': 2}]
        }, format='json')
        self.assertEqual(res.status_code, 200)

        receta = RecetaAncheta.objects.filter(producto_padre=ancheta)
        self.assertEqual(receta.count(), 1)
        self.assertEqual(receta.first().producto_hijo, hijo2)
        ancheta.refresh_from_db()
        # Costo recalculado: 2 x 500
        self.assertEqual(ancheta.precio_costo, 1000)

    def test_empleado_no_puede_editar(self):
        self.client.force_authenticate(user=self.empleado)
        res = self.client.patch(self.url, {'precio_venta': 3000}, format='json')
        self.assertEqual(res.status_code, 403)
