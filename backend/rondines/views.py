import io
import base64
import zipfile
import uuid as uuid_lib
from datetime import timedelta

import qrcode
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import (
    Perfil, Instalacion, Checkpoint, Ronda, RondaCheckpointOrden,
    EjecucionRonda, CheckpointScan
)
from .serializers import (
    UserSerializer, UserCreateSerializer, InstalacionSerializer,
    InstalacionListSerializer, CheckpointSerializer, RondaSerializer,
    RondaCreateSerializer, EjecucionRondaSerializer, EjecucionRondaListSerializer,
    CheckpointScanSerializer, ScanOfflineSerializer
)


# ─── Permisos ────────────────────────────────────────────────────────────────

class IsSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        try:
            return request.user.perfil.rol == 'supervisor'
        except Perfil.DoesNotExist:
            return False


# ─── Auth ────────────────────────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'nombre': user.get_full_name() or user.username,
            'email': user.email,
            'rol': getattr(getattr(user, 'perfil', None), 'rol', 'vigilante'),
        }
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


# ─── Instalaciones ───────────────────────────────────────────────────────────

class InstalacionListCreateView(generics.ListCreateAPIView):
    queryset = Instalacion.objects.filter(activo=True)

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return InstalacionListSerializer
        return InstalacionSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisor()]
        return [permissions.IsAuthenticated()]


class InstalacionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Instalacion.objects.all()
    serializer_class = InstalacionSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsSupervisor()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.activo = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstalacionCheckpointsView(generics.ListAPIView):
    serializer_class = CheckpointSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Checkpoint.objects.filter(
            instalacion_id=self.kwargs['pk'],
            activo=True
        )


# ─── Checkpoints ─────────────────────────────────────────────────────────────

class CheckpointListCreateView(generics.ListCreateAPIView):
    serializer_class = CheckpointSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisor()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Checkpoint.objects.filter(activo=True)
        instalacion_id = self.request.query_params.get('instalacion')
        if instalacion_id:
            qs = qs.filter(instalacion_id=instalacion_id)
        return qs


class CheckpointDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CheckpointSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsSupervisor()]

    def get_queryset(self):
        return Checkpoint.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.activo = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def checkpoint_by_uuid(request, uuid):
    try:
        cp = Checkpoint.objects.get(codigo_qr=uuid, activo=True)
        return Response(CheckpointSerializer(cp).data)
    except Checkpoint.DoesNotExist:
        return Response({'error': 'Checkpoint no encontrado'}, status=status.HTTP_404_NOT_FOUND)


# ─── QR ──────────────────────────────────────────────────────────────────────

def _generar_qr_base64(checkpoint):
    dominio = getattr(settings, 'FRONTEND_URL', 'https://tu-dominio.com')
    url = f'{dominio}/check/{checkpoint.codigo_qr}'
    img = qrcode.make(url)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def qr_checkpoint(request, checkpoint_id):
    try:
        cp = Checkpoint.objects.get(id=checkpoint_id)
    except Checkpoint.DoesNotExist:
        return Response({'error': 'Checkpoint no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'checkpoint_id': cp.id,
        'nombre': cp.nombre,
        'codigo_qr': str(cp.codigo_qr),
        'qr_base64': _generar_qr_base64(cp),
    })


@api_view(['GET'])
@permission_classes([IsSupervisor])
def qr_instalacion_zip(request, instalacion_id):
    from django.http import HttpResponse
    try:
        instalacion = Instalacion.objects.get(id=instalacion_id)
    except Instalacion.DoesNotExist:
        return Response({'error': 'Instalación no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    checkpoints = Checkpoint.objects.filter(instalacion=instalacion, activo=True)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zf:
        for cp in checkpoints:
            dominio = getattr(settings, 'FRONTEND_URL', 'https://tu-dominio.com')
            url = f'{dominio}/check/{cp.codigo_qr}'
            img = qrcode.make(url)
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            zf.writestr(f'{cp.nombre}.png', img_buffer.getvalue())

    zip_buffer.seek(0)
    response = HttpResponse(zip_buffer.read(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{instalacion.nombre}_qr.zip"'
    return response


@api_view(['POST'])
@permission_classes([IsSupervisor])
def regenerar_qr(request, checkpoint_id):
    try:
        cp = Checkpoint.objects.get(id=checkpoint_id)
    except Checkpoint.DoesNotExist:
        return Response({'error': 'Checkpoint no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    cp.codigo_qr = uuid_lib.uuid4()
    cp.save()
    return Response({
        'checkpoint_id': cp.id,
        'nombre': cp.nombre,
        'codigo_qr': str(cp.codigo_qr),
        'qr_base64': _generar_qr_base64(cp),
    })


# ─── Rondas ───────────────────────────────────────────────────────────────────

class RondaListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RondaCreateSerializer
        return RondaSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsSupervisor()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        try:
            rol = user.perfil.rol
        except Perfil.DoesNotExist:
            rol = 'vigilante'

        if rol == 'supervisor':
            return Ronda.objects.filter(activo=True).select_related('instalacion')

        return Ronda.objects.filter(activo=True).filter(
            Q(vigilantes_asignados__isnull=True) | Q(vigilantes_asignados=user)
        ).select_related('instalacion').distinct()


class RondaDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Ronda.objects.all()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return RondaCreateSerializer
        return RondaSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsSupervisor()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.activo = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Ejecuciones ─────────────────────────────────────────────────────────────

class EjecucionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return EjecucionRondaListSerializer
        return EjecucionRondaSerializer

    def get_queryset(self):
        user = self.request.user
        try:
            rol = user.perfil.rol
        except Perfil.DoesNotExist:
            rol = 'vigilante'

        qs = EjecucionRonda.objects.select_related(
            'ronda', 'ronda__instalacion', 'vigilante'
        )
        if rol != 'supervisor':
            qs = qs.filter(vigilante=user)

        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(fecha_inicio__date__gte=fecha_desde)
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(fecha_inicio__date__lte=fecha_hasta)
        vigilante_id = self.request.query_params.get('vigilante')
        if vigilante_id and rol == 'supervisor':
            qs = qs.filter(vigilante_id=vigilante_id)
        instalacion_id = self.request.query_params.get('instalacion')
        if instalacion_id:
            qs = qs.filter(ronda__instalacion_id=instalacion_id)

        return qs

    def create(self, request, *args, **kwargs):
        ronda_id = request.data.get('ronda')
        try:
            ronda = Ronda.objects.get(id=ronda_id, activo=True)
        except Ronda.DoesNotExist:
            return Response({'error': 'Ronda no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        # Supervisores pueden asignar a un vigilante específico
        vigilante = request.user
        try:
            es_supervisor = request.user.perfil.rol == 'supervisor'
        except Perfil.DoesNotExist:
            es_supervisor = False

        vigilante_id = request.data.get('vigilante_id')
        if es_supervisor and vigilante_id:
            try:
                vigilante = User.objects.get(id=vigilante_id)
            except User.DoesNotExist:
                return Response({'error': 'Vigilante no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        en_curso = EjecucionRonda.objects.filter(
            vigilante=vigilante, ronda=ronda, estado='en_curso'
        ).first()
        if en_curso:
            return Response(EjecucionRondaSerializer(en_curso).data, status=status.HTTP_200_OK)

        ejecucion = EjecucionRonda.objects.create(
            ronda=ronda,
            vigilante=vigilante,
            estado='en_curso'
        )

        _notify_ws('ronda_iniciada', {
            'ejecucion_id': ejecucion.id,
            'ronda': ronda.nombre,
            'vigilante': request.user.get_full_name() or request.user.username,
            'instalacion': ronda.instalacion.nombre,
        })

        return Response(EjecucionRondaSerializer(ejecucion).data, status=status.HTTP_201_CREATED)


class EjecucionDetailView(generics.RetrieveAPIView):
    serializer_class = EjecucionRondaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        try:
            rol = user.perfil.rol
        except Perfil.DoesNotExist:
            rol = 'vigilante'
        if rol == 'supervisor':
            return EjecucionRonda.objects.all()
        return EjecucionRonda.objects.filter(vigilante=user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def scan_checkpoint(request, ejecucion_id):
    try:
        ejecucion = EjecucionRonda.objects.get(id=ejecucion_id)
    except EjecucionRonda.DoesNotExist:
        return Response({'error': 'Ejecución no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    if ejecucion.vigilante != request.user:
        return Response({'error': 'Sin permiso'}, status=status.HTTP_403_FORBIDDEN)

    if ejecucion.estado != 'en_curso':
        return Response({'error': 'La ejecución no está en curso'}, status=status.HTTP_400_BAD_REQUEST)

    checkpoint_id = request.data.get('checkpoint')
    if not checkpoint_id:
        return Response({'error': 'Se requiere checkpoint'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        checkpoint = Checkpoint.objects.get(id=checkpoint_id, activo=True)
    except Checkpoint.DoesNotExist:
        return Response({'error': 'Checkpoint no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if not ejecucion.ronda.checkpoints.filter(id=checkpoint.id).exists():
        return Response({'error': 'Checkpoint no pertenece a esta ronda'}, status=status.HTTP_400_BAD_REQUEST)

    if ejecucion.scans.filter(checkpoint=checkpoint).exists():
        return Response({'error': 'Checkpoint ya escaneado en esta ejecución'}, status=status.HTTP_409_CONFLICT)

    timestamp_str = request.data.get('timestamp')
    if timestamp_str:
        from django.utils.dateparse import parse_datetime
        timestamp = parse_datetime(timestamp_str) or timezone.now()
    else:
        timestamp = timezone.now()

    scan = CheckpointScan.objects.create(
        ejecucion=ejecucion,
        checkpoint=checkpoint,
        timestamp=timestamp,
        tipo=request.data.get('tipo', 'observacion'),
        nota=request.data.get('nota', ''),
        latitud=request.data.get('latitud'),
        longitud=request.data.get('longitud'),
    )

    _notify_ws('checkpoint_escaneado', {
        'ejecucion_id': ejecucion.id,
        'checkpoint': checkpoint.nombre,
        'tipo': scan.tipo,
        'nota': scan.nota,
        'vigilante': request.user.get_full_name() or request.user.username,
        'instalacion': ejecucion.ronda.instalacion.nombre,
        'timestamp': str(scan.timestamp),
    })

    if scan.tipo in ['incidencia', 'alarma']:
        _notify_ws('alerta', {
            'scan_id': scan.id,
            'tipo': scan.tipo,
            'checkpoint': checkpoint.nombre,
            'instalacion': ejecucion.ronda.instalacion.nombre,
            'vigilante': request.user.get_full_name() or request.user.username,
            'nota': scan.nota,
            'timestamp': str(scan.timestamp),
        })

    return Response({
        'scan': CheckpointScanSerializer(scan).data,
        'progreso': ejecucion.calcular_progreso(),
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def finalizar_ejecucion(request, ejecucion_id):
    try:
        ejecucion = EjecucionRonda.objects.get(id=ejecucion_id)
    except EjecucionRonda.DoesNotExist:
        return Response({'error': 'Ejecución no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    if ejecucion.vigilante != request.user:
        return Response({'error': 'Sin permiso'}, status=status.HTTP_403_FORBIDDEN)

    progreso = ejecucion.calcular_progreso()
    ejecucion.fecha_fin = timezone.now()
    ejecucion.completada = progreso['completados'] >= progreso['total']
    ejecucion.estado = 'completada' if ejecucion.completada else 'incompleta'
    ejecucion.save()

    _notify_ws('ronda_finalizada', {
        'ejecucion_id': ejecucion.id,
        'ronda': ejecucion.ronda.nombre,
        'vigilante': request.user.get_full_name() or request.user.username,
        'estado': ejecucion.estado,
        'progreso': progreso,
    })

    return Response(EjecucionRondaSerializer(ejecucion).data)


# ─── Sync offline ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_offline(request):
    scans_data = request.data.get('scans', [])
    if not isinstance(scans_data, list):
        return Response({'error': 'Se esperaba una lista de scans'}, status=status.HTTP_400_BAD_REQUEST)

    resultados = []
    for item in scans_data:
        serializer = ScanOfflineSerializer(data=item)
        if not serializer.is_valid():
            resultados.append({'ok': False, 'errors': serializer.errors, 'data': item})
            continue

        data = serializer.validated_data
        try:
            checkpoint = Checkpoint.objects.get(codigo_qr=data['checkpoint_uuid'], activo=True)
            ejecucion = EjecucionRonda.objects.get(id=data['ejecucion_id'], vigilante=request.user)
        except (Checkpoint.DoesNotExist, EjecucionRonda.DoesNotExist) as e:
            resultados.append({'ok': False, 'error': str(e), 'data': item})
            continue

        if ejecucion.scans.filter(checkpoint=checkpoint).exists():
            resultados.append({'ok': False, 'error': 'Ya escaneado', 'data': item})
            continue

        scan = CheckpointScan.objects.create(
            ejecucion=ejecucion,
            checkpoint=checkpoint,
            timestamp=data['timestamp'],
            tipo=data['tipo'],
            nota=data.get('nota', ''),
            latitud=data.get('latitud'),
            longitud=data.get('longitud'),
        )
        resultados.append({'ok': True, 'scan_id': scan.id})

    return Response({'resultados': resultados})


# ─── Dashboard ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsSupervisor])
def dashboard(request):
    hoy = timezone.now().date()

    rondines_en_curso = EjecucionRonda.objects.filter(estado='en_curso').count()
    rondines_completados_hoy = EjecucionRonda.objects.filter(
        fecha_inicio__date=hoy, estado='completada'
    ).count()
    checkpoints_completados_hoy = CheckpointScan.objects.filter(
        timestamp_servidor__date=hoy
    ).count()
    alertas_activas = CheckpointScan.objects.filter(
        tipo__in=['incidencia', 'alarma'], atendida=False
    ).count()
    vigilantes_activos = EjecucionRonda.objects.filter(
        estado='en_curso'
    ).values('vigilante').distinct().count()

    ejecuciones_recientes = EjecucionRonda.objects.select_related(
        'ronda', 'ronda__instalacion', 'vigilante'
    ).order_by('-fecha_inicio')[:10]

    alertas_recientes = CheckpointScan.objects.filter(
        tipo__in=['incidencia', 'alarma']
    ).select_related('checkpoint', 'ejecucion', 'ejecucion__vigilante').order_by('-timestamp')[:20]

    return Response({
        'rondines_en_curso': rondines_en_curso,
        'rondines_completados_hoy': rondines_completados_hoy,
        'checkpoints_completados_hoy': checkpoints_completados_hoy,
        'alertas_activas': alertas_activas,
        'vigilantes_activos': vigilantes_activos,
        'ejecuciones_recientes': EjecucionRondaListSerializer(ejecuciones_recientes, many=True).data,
        'alertas_recientes': CheckpointScanSerializer(alertas_recientes, many=True).data,
    })


# ─── Vigilantes ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsSupervisor])
def vigilantes_list(request):
    vigilantes = User.objects.filter(perfil__rol='vigilante').select_related('perfil')
    return Response(UserSerializer(vigilantes, many=True).data)


@api_view(['POST'])
@permission_classes([IsSupervisor])
def crear_vigilante(request):
    serializer = UserCreateSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsSupervisor])
def toggle_vigilante(request, user_id):
    try:
        user = User.objects.get(id=user_id, perfil__rol='vigilante')
    except User.DoesNotExist:
        return Response({'error': 'Vigilante no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    user.is_active = not user.is_active
    user.save()
    return Response(UserSerializer(user).data)


# ─── Alertas ─────────────────────────────────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsSupervisor])
def atender_alerta(request, scan_id):
    try:
        scan = CheckpointScan.objects.get(id=scan_id)
    except CheckpointScan.DoesNotExist:
        return Response({'error': 'Scan no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    scan.atendida = True
    scan.save()
    return Response(CheckpointScanSerializer(scan).data)


# ─── Exportación ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsSupervisor])
def exportar_ejecuciones_excel(request):
    import openpyxl
    from django.http import HttpResponse

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Rondines'
    ws.append(['ID', 'Ronda', 'Instalación', 'Vigilante', 'Inicio', 'Fin', 'Estado', 'Completados', 'Total'])

    ejecuciones = EjecucionRonda.objects.select_related(
        'ronda', 'ronda__instalacion', 'vigilante'
    ).order_by('-fecha_inicio')[:500]

    for e in ejecuciones:
        progreso = e.calcular_progreso()
        ws.append([
            e.id,
            e.ronda.nombre,
            e.ronda.instalacion.nombre,
            e.vigilante.get_full_name() or e.vigilante.username,
            e.fecha_inicio.strftime('%d/%m/%Y %H:%M') if e.fecha_inicio else '',
            e.fecha_fin.strftime('%d/%m/%Y %H:%M') if e.fecha_fin else '',
            e.estado,
            progreso['completados'],
            progreso['total'],
        ])

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename=rondines.xlsx'
    wb.save(response)
    return response


# ─── Helper WebSocket notify ─────────────────────────────────────────────────

def _notify_ws(event_type, data):
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'supervisores',
            {'type': 'rondines_event', 'event': event_type, 'data': data}
        )
    except Exception:
        pass
