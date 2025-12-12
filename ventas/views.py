from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.response import Response
from .serializers import CrearVentaSerializer, CerrarCajaSerializer
from .models import SesionCaja
from django.contrib.auth.decorators import login_required

class ProcesarVentaView(generics.CreateAPIView):
    serializer_class = CrearVentaSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venta = serializer.save()
        
        return Response({
            "mensaje": "Venta exitosa",
            "venta_id": venta.id,
            "total": venta.total
        }, status=status.HTTP_201_CREATED)

class CerrarCajaView(generics.UpdateAPIView):
    queryset = SesionCaja.objects.all()
    serializer_class = CerrarCajaSerializer
    lookup_field = 'pk' # Buscaremos la caja por su ID

    def update(self, request, *args, **kwargs):
        # 1. Obtener la instancia (datos viejos)
        instance = self.get_object()
        
        # Validar que no esté cerrada
        if not instance.activa:
            return Response(
                {"error": "Esta caja ya fue cerrada anteriormente."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 2. Ejecutar la actualización (se guardan los datos nuevos en la DB)
        response = super().update(request, *args, **kwargs)
        
        # 3. ¡SOLUCIÓN! Refrescar la instancia para traer los cálculos nuevos
        instance.refresh_from_db() 
        
        # Ahora instance.diferencia ya tiene el número (ej. -5000) en lugar de None
        diferencia = instance.diferencia
        
        # Lógica del mensaje
        mensaje = "Caja cuadrada perfecta"
        
        # Agregamos validación extra por seguridad (si diferencia sigue siendo None, asumimos 0)
        if diferencia is None:
            diferencia = 0

        if diferencia < 0:
            mensaje = f"⚠️ ALERTA: Faltan ${abs(diferencia)}"
        elif diferencia > 0:
            mensaje = f"Sobra dinero: ${diferencia}"

        return Response({
            "mensaje": "Caja cerrada correctamente",
            "estado_arqueo": mensaje,
            "diferencia": diferencia,
            "total_vendido_efectivo": instance.total_ventas_sistema
        }, status=status.HTTP_200_OK)
        
@login_required
def punto_venta_view(request):
    """
    Vista que renderiza el HTML del Punto de Venta.
    """
    # Buscamos si el usuario tiene una caja abierta HOY
    caja_abierta = SesionCaja.objects.filter(
        usuario=request.user, 
        activa=True
    ).first()

    context = {
        'caja': caja_abierta,
    }
    # Renderiza el archivo pos.html que creamos antes
    return render(request, 'ventas/pos.html', context)