from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth — csrf_exempt porque usan JWT, no sesiones
    path('auth/login/', csrf_exempt(views.CustomTokenObtainPairView.as_view()), name='token_obtain'),
    path('auth/refresh/', csrf_exempt(TokenRefreshView.as_view()), name='token_refresh'),
    path('auth/me/', views.me, name='me'),

    # Instalaciones
    path('instalaciones/', views.InstalacionListCreateView.as_view(), name='instalaciones'),
    path('instalaciones/<int:pk>/', views.InstalacionDetailView.as_view(), name='instalacion_detail'),
    path('instalaciones/<int:pk>/checkpoints/', views.InstalacionCheckpointsView.as_view(), name='instalacion_checkpoints'),
    path('instalaciones/<int:instalacion_id>/qr-zip/', views.qr_instalacion_zip, name='qr_zip'),

    # Checkpoints
    path('checkpoints/', views.CheckpointListCreateView.as_view(), name='checkpoints'),
    path('checkpoints/<int:pk>/', views.CheckpointDetailView.as_view(), name='checkpoint_detail'),
    path('checkpoints/uuid/<uuid:uuid>/', views.checkpoint_by_uuid, name='checkpoint_by_uuid'),

    # QR
    path('qr/<int:checkpoint_id>/', views.qr_checkpoint, name='qr_checkpoint'),
    path('qr/<int:checkpoint_id>/regenerar/', views.regenerar_qr, name='qr_regenerar'),

    # Rondas
    path('rondas/', views.RondaListCreateView.as_view(), name='rondas'),
    path('rondas/<int:pk>/', views.RondaDetailView.as_view(), name='ronda_detail'),

    # Ejecuciones
    path('ejecuciones/', views.EjecucionListCreateView.as_view(), name='ejecuciones'),
    path('ejecuciones/<int:pk>/', views.EjecucionDetailView.as_view(), name='ejecucion_detail'),
    path('ejecuciones/<int:ejecucion_id>/scan/', views.scan_checkpoint, name='scan_checkpoint'),
    path('ejecuciones/<int:ejecucion_id>/finalizar/', views.finalizar_ejecucion, name='finalizar_ejecucion'),

    # Sync offline
    path('sync/', views.sync_offline, name='sync_offline'),

    # Dashboard
    path('dashboard/', views.dashboard, name='dashboard'),

    # Vigilantes
    path('vigilantes/', views.vigilantes_list, name='vigilantes'),
    path('vigilantes/crear/', views.crear_vigilante, name='crear_vigilante'),
    path('vigilantes/<int:user_id>/toggle/', views.toggle_vigilante, name='toggle_vigilante'),

    # Alertas
    path('alertas/<int:scan_id>/atender/', views.atender_alerta, name='atender_alerta'),

    # Exportación
    path('exportar/excel/', views.exportar_ejecuciones_excel, name='exportar_excel'),
]
