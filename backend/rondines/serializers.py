from django.contrib.auth.models import User
from rest_framework import serializers
from .models import (
    Perfil, Instalacion, Checkpoint, Ronda, RondaCheckpointOrden,
    EjecucionRonda, CheckpointScan, ProgramacionRonda
)


class PerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = ['rol', 'activo']


class UserSerializer(serializers.ModelSerializer):
    perfil = PerfilSerializer(read_only=True)
    rol = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'perfil', 'rol', 'is_active']

    def get_rol(self, obj):
        try:
            return obj.perfil.rol
        except Perfil.DoesNotExist:
            return 'vigilante'


class UserCreateSerializer(serializers.ModelSerializer):
    rol = serializers.ChoiceField(choices=['vigilante', 'supervisor'], write_only=True, default='vigilante')
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'password', 'rol']

    def create(self, validated_data):
        rol = validated_data.pop('rol', 'vigilante')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        Perfil.objects.create(user=user, rol=rol)
        return user


class CheckpointSerializer(serializers.ModelSerializer):
    instalacion_nombre = serializers.CharField(source='instalacion.nombre', read_only=True)

    class Meta:
        model = Checkpoint
        fields = [
            'id', 'instalacion', 'instalacion_nombre', 'nombre', 'descripcion',
            'codigo_qr', 'pos_x', 'pos_y', 'activo', 'fecha_creacion'
        ]
        read_only_fields = ['codigo_qr', 'fecha_creacion']


class CheckpointBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkpoint
        fields = ['id', 'nombre', 'descripcion', 'codigo_qr', 'pos_x', 'pos_y', 'activo']


class InstalacionSerializer(serializers.ModelSerializer):
    checkpoints = CheckpointBriefSerializer(many=True, read_only=True)
    checkpoints_count = serializers.IntegerField(source='checkpoints.count', read_only=True)

    class Meta:
        model = Instalacion
        fields = [
            'id', 'nombre', 'descripcion', 'imagen_satelital',
            'fecha_creacion', 'activo', 'checkpoints', 'checkpoints_count'
        ]


class InstalacionListSerializer(serializers.ModelSerializer):
    checkpoints_count = serializers.IntegerField(source='checkpoints.count', read_only=True)

    class Meta:
        model = Instalacion
        fields = ['id', 'nombre', 'descripcion', 'imagen_satelital', 'fecha_creacion', 'activo', 'checkpoints_count']


class RondaCheckpointOrdenSerializer(serializers.ModelSerializer):
    checkpoint = CheckpointBriefSerializer(read_only=True)
    checkpoint_id = serializers.PrimaryKeyRelatedField(
        queryset=Checkpoint.objects.all(), source='checkpoint', write_only=True
    )

    class Meta:
        model = RondaCheckpointOrden
        fields = ['id', 'checkpoint', 'checkpoint_id', 'orden']


class RondaSerializer(serializers.ModelSerializer):
    instalacion_nombre = serializers.CharField(source='instalacion.nombre', read_only=True)
    checkpoint_ordenes = RondaCheckpointOrdenSerializer(
        source='rondacheckpointorden_set', many=True, read_only=True
    )
    checkpoints_count = serializers.IntegerField(source='checkpoints.count', read_only=True)

    class Meta:
        model = Ronda
        fields = [
            'id', 'instalacion', 'instalacion_nombre', 'nombre', 'descripcion',
            'activo', 'checkpoints_count', 'checkpoint_ordenes', 'fecha_creacion'
        ]


class RondaCreateSerializer(serializers.ModelSerializer):
    checkpoints_orden = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = Ronda
        fields = ['id', 'instalacion', 'nombre', 'descripcion', 'activo', 'checkpoints_orden']

    def create(self, validated_data):
        checkpoints_orden = validated_data.pop('checkpoints_orden', [])
        ronda = Ronda.objects.create(**validated_data)
        for item in checkpoints_orden:
            RondaCheckpointOrden.objects.create(
                ronda=ronda,
                checkpoint_id=item['checkpoint_id'],
                orden=item['orden']
            )
        return ronda

    def update(self, instance, validated_data):
        checkpoints_orden = validated_data.pop('checkpoints_orden', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if checkpoints_orden is not None:
            RondaCheckpointOrden.objects.filter(ronda=instance).delete()
            for item in checkpoints_orden:
                RondaCheckpointOrden.objects.create(
                    ronda=instance,
                    checkpoint_id=item['checkpoint_id'],
                    orden=item['orden']
                )
        return instance


class CheckpointScanSerializer(serializers.ModelSerializer):
    checkpoint_nombre = serializers.CharField(source='checkpoint.nombre', read_only=True)
    vigilante_nombre = serializers.SerializerMethodField()

    class Meta:
        model = CheckpointScan
        fields = [
            'id', 'ejecucion', 'checkpoint', 'checkpoint_nombre',
            'timestamp', 'timestamp_servidor', 'tipo', 'nota',
            'latitud', 'longitud', 'atendida', 'vigilante_nombre'
        ]
        read_only_fields = ['timestamp_servidor', 'atendida']

    def get_vigilante_nombre(self, obj):
        return obj.ejecucion.vigilante.get_full_name() or obj.ejecucion.vigilante.username


class CheckpointScanListSerializer(serializers.ModelSerializer):
    checkpoint_nombre = serializers.CharField(source='checkpoint.nombre', read_only=True)
    instalacion_nombre = serializers.CharField(source='checkpoint.instalacion.nombre', read_only=True)
    ronda_nombre = serializers.CharField(source='ejecucion.ronda.nombre', read_only=True)
    vigilante_nombre = serializers.SerializerMethodField()

    class Meta:
        model = CheckpointScan
        fields = ['id', 'checkpoint_nombre', 'instalacion_nombre', 'ronda_nombre',
                  'vigilante_nombre', 'tipo', 'nota', 'timestamp']

    def get_vigilante_nombre(self, obj):
        return obj.ejecucion.vigilante.get_full_name() or obj.ejecucion.vigilante.username


class ProgramacionRondaSerializer(serializers.ModelSerializer):
    ronda_nombre = serializers.CharField(source='ronda.nombre', read_only=True)
    instalacion_nombre = serializers.CharField(source='ronda.instalacion.nombre', read_only=True)
    vigilante_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ProgramacionRonda
        fields = [
            'id', 'ronda', 'ronda_nombre', 'instalacion_nombre',
            'vigilante', 'vigilante_nombre',
            'dias_semana', 'hora_inicio', 'duracion_minutos', 'activo', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_vigilante_nombre(self, obj):
        if obj.vigilante:
            return obj.vigilante.get_full_name() or obj.vigilante.username
        return None


class EjecucionRondaSerializer(serializers.ModelSerializer):
    ronda_nombre = serializers.CharField(source='ronda.nombre', read_only=True)
    instalacion_nombre = serializers.CharField(source='ronda.instalacion.nombre', read_only=True)
    vigilante_nombre = serializers.SerializerMethodField()
    scans = CheckpointScanSerializer(many=True, read_only=True)
    progreso = serializers.SerializerMethodField()
    checkpoints_ronda = serializers.SerializerMethodField()

    class Meta:
        model = EjecucionRonda
        fields = [
            'id', 'ronda', 'ronda_nombre', 'instalacion_nombre',
            'vigilante', 'vigilante_nombre', 'programacion',
            'fecha_inicio', 'fecha_fin', 'hora_limite',
            'completada', 'estado', 'vencida', 'scans', 'progreso',
            'checkpoints_ronda',
        ]
        read_only_fields = ['vigilante', 'fecha_inicio', 'completada', 'estado', 'vencida']

    def get_vigilante_nombre(self, obj):
        return obj.vigilante.get_full_name() or obj.vigilante.username

    def get_progreso(self, obj):
        return obj.calcular_progreso()

    def get_checkpoints_ronda(self, obj):
        cps = obj.ronda.checkpoints.filter(activo=True)
        return CheckpointBriefSerializer(cps, many=True).data


class EjecucionRondaListSerializer(serializers.ModelSerializer):
    ronda_nombre = serializers.CharField(source='ronda.nombre', read_only=True)
    instalacion_nombre = serializers.CharField(source='ronda.instalacion.nombre', read_only=True)
    vigilante_nombre = serializers.SerializerMethodField()
    progreso = serializers.SerializerMethodField()

    class Meta:
        model = EjecucionRonda
        fields = [
            'id', 'ronda', 'ronda_nombre', 'instalacion_nombre',
            'vigilante', 'vigilante_nombre', 'programacion',
            'fecha_inicio', 'fecha_fin', 'hora_limite',
            'completada', 'estado', 'vencida', 'progreso'
        ]

    def get_vigilante_nombre(self, obj):
        return obj.vigilante.get_full_name() or obj.vigilante.username

    def get_progreso(self, obj):
        return obj.calcular_progreso()


class ScanOfflineSerializer(serializers.Serializer):
    checkpoint_uuid = serializers.UUIDField()
    ejecucion_id = serializers.IntegerField()
    timestamp = serializers.DateTimeField()
    tipo = serializers.ChoiceField(choices=['observacion', 'incidencia', 'alarma'])
    nota = serializers.CharField(allow_blank=True, default='')
    latitud = serializers.FloatField(required=False, allow_null=True)
    longitud = serializers.FloatField(required=False, allow_null=True)


class DashboardSerializer(serializers.Serializer):
    rondines_en_curso = serializers.IntegerField()
    rondines_completados_hoy = serializers.IntegerField()
    checkpoints_completados_hoy = serializers.IntegerField()
    alertas_activas = serializers.IntegerField()
    vigilantes_activos = serializers.IntegerField()
    ejecuciones_recientes = EjecucionRondaListSerializer(many=True)
    alertas_recientes = CheckpointScanSerializer(many=True)
