from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.core.exceptions import ValidationError
from .models import Producto, Sede
from .serializers import ProductoPOSSerializer
from .services import armar_ancheta

class ListarProductosPOS(generics.ListAPIView):
    serializer_class = ProductoPOSSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        usuario = self.request.user
        
        sede_target = None

        # A. Lógica para ADMIN
        if hasattr(usuario, 'perfil') and usuario.perfil.rol == 'ADMIN':
            # Si es admin, miramos si mandó ?sede_id=...
            sede_param = self.request.query_params.get('sede_id')
            if sede_param:
                # Intentamos buscar esa sede
                sede_target = Sede.objects.filter(id=sede_param).first()
            
            # Si no mandó nada, o no existe, podríamos:
            # 1. Mostrar todo (peligroso por duplicados).
            # 2. O retornar nada.
            # 3. O fallback a su sede del perfil.
            if not sede_target and usuario.perfil.sede:
                 sede_target = usuario.perfil.sede
        
        # B. Lógica para EMPLEADO (o usuario normal)
        elif hasattr(usuario, 'perfil') and usuario.perfil.sede:
            sede_target = usuario.perfil.sede

        # C. Si no encontramos sede objetivo...
        if not sede_target:
            return Producto.objects.none()

        # Guardamos la sede encontrada en el objeto para usarla en get_serializer_context
        self.sede_target = sede_target

        # 2. Filtrar Productos: 
        # Traemos productos con stock en la sede OR que sean SERVICIOS (globales)
        return Producto.objects.filter(
            Q(inventarios__sede=sede_target, inventarios__stock_actual__gt=0) |
            Q(tipo='SERVICIO')
        ).distinct()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Usamos la sede que determinamos en get_queryset
        if hasattr(self, 'sede_target') and self.sede_target:
            context['sede_id'] = self.sede_target.id
        return context

class ListarSedesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Retorna todas las sedes activas para el selector
        sedes = Sede.objects.filter(activa=True).values('id', 'nombre', 'direccion')
        return Response(list(sedes))

class ArmarAnchetaView(APIView):
    def post(self, request):
        # 1. Validar formato de datos (Serializer)
        serializer = ArmarAnchetaInputSerializer(data=request.data)
        if serializer.is_valid():
            datos = serializer.validated_data
            
            try:
                # 2. Obtener objetos reales de la DB
                ancheta = get_object_or_404(Producto, id=datos['producto_id'])
                sede = get_object_or_404(Sede, id=datos['sede_id'])
                cantidad = datos['cantidad']

                # 3. LLAMAR A TU SERVICIO (Capa de Negocio)
                # Aquí ocurre la magia: restas insumos, sumas anchetas
                armar_ancheta(ancheta, sede, cantidad)

                return Response({
                    "mensaje": f"Se armaron {cantidad} unidades de '{ancheta.nombre}' correctamente.",
                    "sede": sede.nombre
                }, status=status.HTTP_200_OK)

            except ValidationError as e:
                # Capturamos los errores de tu servicio (ej. 'No hay stock suficiente')
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class BuscarProductoPublicoView(generics.ListAPIView):
    """
    Endpoint para el Verificador de Precios.
    Busca productos por nombre, código de barras o código interno.
    No requiere Sede (es búsqueda global de catálogo).
    """
    serializer_class = ProductoPOSSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        query = self.request.query_params.get('q', '')
        if len(query) < 3:
            return Producto.objects.none()
        
        return Producto.objects.filter(
            Q(nombre__icontains=query) |
            Q(codigo_barras__icontains=query) |
            Q(codigo_interno__icontains=query)
        )[:10] # Limitamos a 10 resultados

from .serializers import ProductoAdminSerializer

class BuscarProductoAdminView(generics.ListAPIView):
    """
    Endpoint para búsqueda de productos con datos de costo.
    Solo para administradores.
    """
    serializer_class = ProductoAdminSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Validar que sea ADMIN
        if not hasattr(self.request.user, 'perfil') or self.request.user.perfil.rol != 'ADMIN':
             return Producto.objects.none()

        query = self.request.query_params.get('q', '')
        if len(query) < 2: # Bajamos el limite a 2 para admin
            return Producto.objects.none()
        
        return Producto.objects.filter(
            Q(nombre__icontains=query) |
            Q(codigo_barras__icontains=query) |
            Q(codigo_interno__icontains=query)
        )[:15]

from .serializers import MovimientoInventarioSerializer

class RegistrarMovimientoView(generics.CreateAPIView):
    """
    Vista para registrar entradas, salidas y traslados.
    Se conecta con el modelo MovimientoInventario que ya tiene lógica mágica en save().
    """
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Asignamos el usuario que está logueado automáticamente
        serializer.save(usuario=self.request.user)

    def create(self, request, *args, **kwargs):
        # Sobreescribimos create para capturar errores de validación del modelo (ValidationError)
        try:
            return super().create(request, *args, **kwargs)
        except ValidationError as e:
             return Response({"error": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


from .models import Inventario
from .serializers import InventarioGlobalSerializer
from django.db.models import Sum, F

class AdminInventarioGlobalView(generics.ListAPIView):
    serializer_class = InventarioGlobalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Inventario.objects.all().select_related('producto', 'sede')
        sede_id = self.request.query_params.get('sede_id')
        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        return queryset

    def list(self, request, *args, **kwargs):
        sede_id = self.request.query_params.get('sede_id')
        queryset = self.get_queryset()
        
        # 1. Calcular Resumen Global (este siempre es total de lo que hay en el queryset)
        summary = queryset.aggregate(
            total_items=Sum('stock_actual'),
            valor_total_costo=Sum(F('stock_actual') * F('producto__precio_costo')),
            valor_total_venta=Sum(F('stock_actual') * F('producto__precio_venta'))
        )

        # 2. Si no hay sede_id, agrupamos por producto
        if not sede_id:
            # Agregamos por producto para evitar repeticiones
            grouped_data = queryset.values(
                'producto_id', 
                'producto__nombre', 
                'producto__tipo',
                'producto__precio_costo', 
                'producto__precio_venta'
            ).annotate(
                total_stock=Sum('stock_actual'),
                total_costo_acumulado=Sum(F('stock_actual') * F('producto__precio_costo')),
                total_venta_acumulado=Sum(F('stock_actual') * F('producto__precio_venta'))
            ).order_by('producto__nombre')

            inventario_list = []
            for item in grouped_data:
                inventario_list.append({
                    "id": item['producto_id'], # Usamos el ID del producto como referencia
                    "sede_nombre": "Todas las Sedes",
                    "producto_nombre": item['producto__nombre'],
                    "producto_tipo": item['producto__tipo'],
                    "stock_actual": item['total_stock'],
                    "producto_costo": item['producto__precio_costo'],
                    "producto_precio": item['producto__precio_venta'],
                    "valor_total_costo": item['total_costo_acumulado'] or 0,
                    "valor_total_venta": item['total_venta_acumulado'] or 0
                })
            
            return Response({
                "resumen": summary,
                "inventario": inventario_list
            })
        
        # 3. Si hay sede_id, devolvemos la lista normal serializada
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            "resumen": summary,
            "inventario": serializer.data
        })

from .models import Categoria
class ListarCategoriasView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Categoria.objects.all()
    serializer_class = None # Usaremos un serializer simple on-the-fly o values
    
    def list(self, request, *args, **kwargs):
        data = self.get_queryset().values('id', 'nombre')
        return Response(list(data))

from .serializers import ProductoCreateSerializer

class CrearProductoView(generics.CreateAPIView):
    """
    Vista para crear productos desde el Frontend (Admin).
    Soporta creación de Anchetas con sus ingredientes.
    """
    serializer_class = ProductoCreateSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Validar que sea ADMIN
        if not hasattr(self.request.user, 'perfil') or self.request.user.perfil.rol != 'ADMIN':
             raise ValidationError("Solo los administradores pueden crear productos.")
        
        serializer.save()

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except ValidationError as e:
             return Response({"error": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
             return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GenerarSiguienteCodigoProductoView(APIView):
    """
    Genera el siguiente codigo interno disponible, partiendo de 1000.
    Ignora codigos alfanumericos que no sean convertibles a entero.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'perfil') or request.user.perfil.rol != 'ADMIN':
             return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)

        codigos = Producto.objects.values_list('codigo_interno', flat=True)
        
        max_codigo = 999
        
        for c in codigos:
            # Verificamos si es puramente digitos para evitar errores con "PROD-001"
            if c and c.isdigit():
                val = int(c)
                if val > max_codigo:
                    max_codigo = val
        
        siguiente = max_codigo + 1
        return Response({"siguiente_codigo": str(siguiente)})
