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
