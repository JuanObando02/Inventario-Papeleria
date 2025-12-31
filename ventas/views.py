from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from .serializers import (
    CrearVentaSerializer, CerrarCajaSerializer, 
    SesionReporteSerializer, SesionResumenSerializer
)
from .models import SesionCaja, DetalleVenta
from inventario.models import Producto, Sede, Inventario
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate

class EstadoCajaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Buscar si el usuario tiene una caja abierta
        sesion = SesionCaja.objects.filter(usuario=request.user, activa=True).first()
        
        if sesion:
            # CALCULAMOS EL DINERO ACTUAL
            # Dinero en caja = Base + Lo que has vendido
            saldo_actual_calculado = sesion.monto_base + sesion.total_ventas_sistema

            return Response({
                "abierta": True,
                "id": sesion.id,
                "saldo": saldo_actual_calculado, 
                "monto_base": sesion.monto_base,
                "ventas_hoy": sesion.total_ventas_sistema,
                "sede_id": sesion.sede.id  # <--- Agregamos esto
            })
        else:
            return Response({"abierta": False, "id": None})

class LoginAPIView(APIView):
    """
    Endpoint para que React inicie sesión.
    Recibe: { "username": "...", "password": "..." }
    Retorna: { "token": "...", "username": "..." }
    """
    permission_classes = [AllowAny]
    def post(self, request):
        # 1. Obtener datos del JSON
        username = request.data.get('username')
        password = request.data.get('password')

        # 2. Verificar credenciales
        user = authenticate(username=username, password=password)

        if user:
            # 3. Si existe, crear o recuperar su Token
            token, created = Token.objects.get_or_create(user=user)
            
            # Obtener datos extras del perfil
            rol = 'EMPLEADO'
            sede_id = None
            sede_nombre = None
            
            if hasattr(user, 'perfil'):
                rol = user.perfil.rol
                if user.perfil.sede:
                    sede_id = user.perfil.sede.id
                    sede_nombre = user.perfil.sede.nombre

            return Response({
                'token': token.key,
                'username': user.username,
                'user_id': user.id,
                'rol': rol,
                'sede_id': sede_id,
                'sede_nombre': sede_nombre
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Credenciales inválidas'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

class AbrirCajaView(APIView):
    """
    Endpoint para abrir una caja.
    Recibe: { "saldo_inicial": "..." }
    Retorna: { "mensaje": "...", "sesion_id": "..." }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        usuario = request.user
        
        # 1. Validar si ya tiene caja abierta
        if SesionCaja.objects.filter(usuario=usuario, activa=True).exists():
            return Response({"error": "Ya tienes una caja abierta."}, status=400)

        # 2. Obtener monto (React envía 'saldo_inicial', nosotros guardamos en 'monto_base')
        monto_recibido = request.data.get('saldo_inicial', 0)
        
        # 3. DETERMINAR LA SEDE SEGÚN EL ROL
        # Lógica:
        # - Si es ADMIN: Puede enviar 'sede_id' en el body. Si no envía, error (o default opcional).
        # - Si es EMPLEADO: Se usa obligatoriamente su usuario.perfil.sede.
        
        sede_actual = None
        es_admin = hasattr(usuario, 'perfil') and usuario.perfil.rol == 'ADMIN'
        
        if es_admin:
            # ADMIN: Busca la sede que envió el frontend
            sede_id_request = request.data.get('sede_id')
            if sede_id_request:
                try:
                    sede_actual = Sede.objects.get(pk=sede_id_request)
                except Sede.DoesNotExist:
                    return Response({"error": "La Sede seleccionada no existe"}, status=400)
            else:
                # Si es admin y no mandó nada, ¿qué hacemos? 
                # Opción A: Error. Opción B: Tomar la de su perfil si tiene.
                # Vamos con Error para obligar al selector.
                return Response({"error": "Como Administrador debes seleccionar una Sede."}, status=400)
        
        else:
            # EMPLEADO: Usar la de su perfil
            if hasattr(usuario, 'perfil') and usuario.perfil.sede:
                sede_actual = usuario.perfil.sede
            else:
                return Response({"error": "Tu usuario no tiene una Sede asignada. Contacta al Admin."}, status=400)
        
        if not sede_actual:
            return Response({"error": "No se pudo determinar la Sede."}, status=500)

        # 4. Crear la sesión con TU ESTRUCTURA
        nueva_sesion = SesionCaja.objects.create(
            usuario=usuario,
            sede=sede_actual,          # <--- Campo obligatorio
            monto_base=monto_recibido, # <--- Tu campo
            total_ventas_sistema=0,    # <--- Arranca en 0
            activa=True
        )

        return Response({
            "mensaje": "Caja abierta correctamente",
            "sesion_id": nueva_sesion.id
        }, status=status.HTTP_201_CREATED)

class ProcesarVentaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CrearVentaSerializer(data=request.data)
        if serializer.is_valid():
            venta = serializer.save()
            return Response({
                "mensaje": "Venta registrada exitosamente",
                "venta_id": venta.id,
                "nuevo_acumulado_caja": venta.sesion_caja.total_ventas_sistema
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
        
        return Response({
            "mensaje": "Caja cerrada correctamente. Información guardada.",
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

class AdminReportesCajaView(generics.ListAPIView):
    """Lista las cajas cerradas para el Admin"""
    serializer_class = SesionResumenSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Opcional: validar rol
        if getattr(self.request.user, 'perfil', None) and self.request.user.perfil.rol == 'ADMIN':
             return SesionCaja.objects.filter(activa=False).order_by('-fecha_cierre')
        return SesionCaja.objects.none()

class AdminDetalleCajaView(generics.RetrieveAPIView):
    """Detalle completo de una sesión (ventas, productos, arqueo)"""
    queryset = SesionCaja.objects.all()
    serializer_class = SesionReporteSerializer
    permission_classes = [IsAuthenticated]