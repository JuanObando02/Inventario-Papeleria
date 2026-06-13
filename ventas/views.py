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
from .models import SesionCaja, DetalleVenta, Venta
from inventario.models import Producto, Sede, Inventario, MovimientoInventario
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone

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

class AnularVentaView(APIView):
    """
    Anula una venta de una caja ABIERTA (solo ADMIN):
    devuelve el stock de los productos físicos y resta el total de la sesión.
    Recibe: { "motivo": "..." }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        usuario = request.user
        if not (hasattr(usuario, 'perfil') and usuario.perfil.rol == 'ADMIN'):
            return Response({"error": "Solo los administradores pueden anular ventas."}, status=status.HTTP_403_FORBIDDEN)

        try:
            venta = Venta.objects.select_related('sesion_caja').get(pk=pk)
        except Venta.DoesNotExist:
            return Response({"error": "La venta no existe."}, status=status.HTTP_404_NOT_FOUND)

        if venta.anulada:
            return Response({"error": "Esta venta ya fue anulada."}, status=status.HTTP_400_BAD_REQUEST)

        sesion = venta.sesion_caja
        if not sesion.activa:
            return Response(
                {"error": "No se puede anular una venta de una caja ya cerrada."},
                status=status.HTTP_400_BAD_REQUEST
            )

        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response({"error": "Debes indicar el motivo de la anulación."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # 1. Devolver stock: solo los FISICOS descontaron stock al vender,
            # así que solo a ellos se les repone. costo_unitario=None evita
            # recalcular el costo promedio del producto.
            for detalle in venta.detalles.select_related('producto'):
                if detalle.producto.tipo == 'FISICO':
                    MovimientoInventario.objects.create(
                        usuario=usuario,
                        producto=detalle.producto,
                        tipo='ENTRADA',
                        cantidad=detalle.cantidad,
                        sede_origen=sesion.sede,
                        motivo=f"Anulación Venta #{venta.id}",
                        costo_unitario=None
                    )

            # 2. Marcar la venta como anulada
            venta.anulada = True
            venta.motivo_anulacion = motivo
            venta.anulada_por = usuario
            venta.fecha_anulacion = timezone.now()
            venta.save()

            # 3. Restar el total del acumulado de la caja
            sesion.total_ventas_sistema -= venta.total
            sesion.save()

        return Response({
            "mensaje": f"Venta #{venta.id} anulada correctamente.",
            "nuevo_acumulado_caja": sesion.total_ventas_sistema
        }, status=status.HTTP_200_OK)

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
            if self.request.query_params.get('estado') == 'abiertas':
                return SesionCaja.objects.filter(activa=True).order_by('-fecha_apertura')
            return SesionCaja.objects.filter(activa=False).order_by('-fecha_cierre')
        return SesionCaja.objects.none()

class AdminDetalleCajaView(generics.RetrieveAPIView):
    """Detalle completo de una sesión (ventas, productos, arqueo)"""
    queryset = SesionCaja.objects.all()
    serializer_class = SesionReporteSerializer
    permission_classes = [IsAuthenticated]

from django.db.models import Sum, Count, F
from django.db.models.functions import Coalesce
from datetime import datetime

class DashboardResumenView(APIView):
    """
    Resumen ligero para el menú principal en un solo fetch:
    ventas del día, alertas de stock y estado de la caja del usuario.
    EMPLEADO: cifras de su sede. ADMIN: cifras globales.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from inventario.views import alertas_stock_queryset
        usuario = request.user
        hoy = timezone.localdate()
        es_admin = hasattr(usuario, 'perfil') and usuario.perfil.rol == 'ADMIN'

        # --- Ventas del día ---
        ventas_hoy = Venta.objects.filter(fecha__date=hoy, anulada=False)
        if not es_admin:
            if hasattr(usuario, 'perfil') and usuario.perfil.sede:
                ventas_hoy = ventas_hoy.filter(sesion_caja__sede=usuario.perfil.sede)
            else:
                ventas_hoy = Venta.objects.none()

        from django.db.models import Sum, Count
        agregado = ventas_hoy.aggregate(total=Sum('total'), numero=Count('id'))

        # --- Alertas de stock (mismo filtro que la pantalla de Reposición) ---
        alertas = alertas_stock_queryset(usuario).count()

        # --- Estado de caja del usuario (misma lógica que EstadoCajaView) ---
        sesion = SesionCaja.objects.filter(usuario=usuario, activa=True).first()
        if sesion:
            caja = {
                "abierta": True,
                "id": sesion.id,
                "saldo": sesion.monto_base + sesion.total_ventas_sistema
            }
        else:
            caja = {"abierta": False, "id": None, "saldo": None}

        return Response({
            "ventas_hoy": {
                "total": agregado['total'] or 0,
                "numero": agregado['numero'] or 0
            },
            "alertas_stock": alertas,
            "caja": caja
        })

class ReporteVentasView(APIView):
    """
    Reporte de ventas agregado por producto en un rango de fechas (solo ADMIN).
    Query params: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&sede_id=
    La utilidad usa el costo histórico (costo_unitario del detalle);
    para ventas antiguas sin costo guardado, usa el costo actual del producto.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuario = request.user
        if not (hasattr(usuario, 'perfil') and usuario.perfil.rol == 'ADMIN'):
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)

        desde_str = request.query_params.get('desde')
        hasta_str = request.query_params.get('hasta')
        if not desde_str or not hasta_str:
            return Response({"error": "Debes enviar 'desde' y 'hasta' (YYYY-MM-DD)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            desde = datetime.strptime(desde_str, '%Y-%m-%d').date()
            hasta = datetime.strptime(hasta_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"error": "Formato de fecha inválido. Usa YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        sede_id = request.query_params.get('sede_id')

        # --- Detalles (para agregación por producto) ---
        detalles = DetalleVenta.objects.filter(
            venta__anulada=False,
            venta__fecha__date__gte=desde,
            venta__fecha__date__lte=hasta
        )
        ventas = Venta.objects.filter(
            anulada=False,
            fecha__date__gte=desde,
            fecha__date__lte=hasta
        )
        if sede_id:
            detalles = detalles.filter(venta__sesion_caja__sede_id=sede_id)
            ventas = ventas.filter(sesion_caja__sede_id=sede_id)

        # --- Agregación por producto ---
        productos = detalles.values(
            'producto_id', 'producto__nombre', 'producto__codigo_interno', 'producto__tipo'
        ).annotate(
            cantidad_total=Sum('cantidad'),
            ingresos_total=Sum('subtotal'),
            costo_total=Sum(F('cantidad') * Coalesce('costo_unitario', 'producto__precio_costo'))
        ).order_by('-ingresos_total')

        lista_productos = []
        for p in productos:
            ingresos = p['ingresos_total'] or 0
            costo = p['costo_total'] or 0
            lista_productos.append({
                "producto_id": p['producto_id'],
                "nombre": p['producto__nombre'],
                "codigo_interno": p['producto__codigo_interno'],
                "tipo": p['producto__tipo'],
                "cantidad": p['cantidad_total'],
                "ingresos": ingresos,
                "costo": costo,
                "utilidad": ingresos - costo
            })

        # --- Resumen general y por método de pago (sobre Venta, no detalles) ---
        resumen = ventas.aggregate(
            total_vendido=Sum('total'),
            numero_ventas=Count('id')
        )
        resumen['total_vendido'] = resumen['total_vendido'] or 0
        resumen['utilidad_total'] = sum(p['utilidad'] for p in lista_productos)

        por_metodo = list(
            ventas.values('metodo_pago')
            .annotate(total=Sum('total'), numero=Count('id'))
            .order_by('-total')
        )

        return Response({
            "resumen": resumen,
            "por_metodo": por_metodo,
            "productos": lista_productos
        })