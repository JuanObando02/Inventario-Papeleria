from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from .models import Producto
from .serializers import ProductoPOSSerializer
from .services import armar_ancheta

class ListarProductosPOS(generics.ListAPIView):
    """
    Devuelve solo los productos activos para mostrarlos en el POS.
    """
    queryset = Producto.objects.filter(activo=True)
    serializer_class = ProductoPOSSerializer

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
