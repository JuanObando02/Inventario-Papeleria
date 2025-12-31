from django.test import TestCase
from django.contrib.auth import get_user_model
from inventario.models import Producto, Categoria, RecetaAncheta

User = get_user_model()

class CreateProductTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', password='password', is_superuser=True)
        # Assuming there is a Perfil attached via signal or created properties.
        # But wait, logic uses `request.user.perfil.rol == 'ADMIN'`.
        # I need to ensure the profile exists and has role admin.
        if hasattr(self.admin, 'perfil'):
            self.admin.perfil.rol = 'ADMIN'
            self.admin.perfil.save()
        else:
             # Manually create profile if not auto-created
             from usuarios.models import PerfilUsuario
             PerfilUsuario.objects.create(usuario=self.admin, rol='ADMIN', sede_id=1) 
             # Wait, need a sede first?
             # Let's check models... Users usually have a profile.
             # I'll create Sede just in case.
             from inventario.models import Sede
             s = Sede.objects.create(nombre='Sede A')
             # Re-get or create
             PerfilUsuario.objects.get_or_create(usuario=self.admin, defaults={'rol': 'ADMIN', 'sede': s})

        self.client.force_login(self.admin)

    def test_create_simple_product(self):
        url = '/api/inventario/admin/crear-producto/'
        data = {
            'nombre': 'Nuevo lapiz',
            'codigo_interno': 'L001',
            'precio_costo': 500,
            'precio_venta': 1000,
            'tipo': 'FISICO'
        }
        response = self.client.post(url, data, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Producto.objects.filter(codigo_interno='L001').exists())

    def test_create_ancheta(self):
        # 1. Create ingredients
        p1 = Producto.objects.create(nombre='Dulce', codigo_interno='D1', precio_costo=100, precio_venta=200)
        p2 = Producto.objects.create(nombre='Caja', codigo_interno='C1', precio_costo=500, precio_venta=1000)

        url = '/api/inventario/admin/crear-producto/'
        data = {
            'nombre': 'Ancheta Navidad',
            'codigo_interno': 'ANCH-001',
            'precio_costo': 700,
            'precio_venta': 2000,
            'tipo': 'ANCHETA',
            'ingredientes': [
                {'producto_hijo': p1.id, 'cantidad': 2},
                {'producto_hijo': p2.id, 'cantidad': 1}
            ]
        }
        response = self.client.post(url, data, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        
        # Verify Product Created
        ancheta = Producto.objects.get(codigo_interno='ANCH-001')
        self.assertEqual(ancheta.tipo, 'ANCHETA')

        # Verify Ingredients
        self.assertEqual(RecetaAncheta.objects.filter(producto_padre=ancheta).count(), 2)
        r1 = RecetaAncheta.objects.get(producto_padre=ancheta, producto_hijo=p1)
        self.assertEqual(r1.cantidad, 2)
