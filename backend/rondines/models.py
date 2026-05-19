import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Perfil(models.Model):
    ROL_CHOICES = [
        ('vigilante', 'Vigilante'),
        ('supervisor', 'Supervisor'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    rol = models.CharField(max_length=20, choices=ROL_CHOICES, default='vigilante')
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Perfil'
        verbose_name_plural = 'Perfiles'

    def __str__(self):
        return f'{self.user.username} ({self.rol})'


class Instalacion(models.Model):
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    imagen_satelital = models.ImageField(upload_to='instalaciones/', null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Instalación'
        verbose_name_plural = 'Instalaciones'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Checkpoint(models.Model):
    instalacion = models.ForeignKey(Instalacion, on_delete=models.CASCADE, related_name='checkpoints')
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    codigo_qr = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    pos_x = models.FloatField(default=50.0, help_text='Posición X en % sobre la imagen satelital')
    pos_y = models.FloatField(default=50.0, help_text='Posición Y en % sobre la imagen satelital')
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Checkpoint'
        verbose_name_plural = 'Checkpoints'
        ordering = ['instalacion', 'nombre']

    def __str__(self):
        return f'{self.instalacion.nombre} - {self.nombre}'


class Ronda(models.Model):
    instalacion = models.ForeignKey(Instalacion, on_delete=models.CASCADE, related_name='rondas')
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    checkpoints = models.ManyToManyField(
        Checkpoint,
        through='RondaCheckpointOrden',
        related_name='rondas'
    )
    vigilantes_asignados = models.ManyToManyField(
        User,
        blank=True,
        related_name='rondas_asignadas',
        help_text='Si vacío, todos los vigilantes pueden ejecutarla'
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Ronda'
        verbose_name_plural = 'Rondas'
        ordering = ['nombre']

    def __str__(self):
        return f'{self.nombre} ({self.instalacion.nombre})'


class RondaCheckpointOrden(models.Model):
    ronda = models.ForeignKey(Ronda, on_delete=models.CASCADE)
    checkpoint = models.ForeignKey(Checkpoint, on_delete=models.CASCADE)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Orden de Checkpoint en Ronda'
        verbose_name_plural = 'Órdenes de Checkpoints en Rondas'
        ordering = ['orden']
        unique_together = ('ronda', 'checkpoint')

    def __str__(self):
        return f'{self.ronda.nombre} - {self.checkpoint.nombre} (#{self.orden})'


class EjecucionRonda(models.Model):
    ESTADO_CHOICES = [
        ('en_curso', 'En curso'),
        ('completada', 'Completada'),
        ('incompleta', 'Incompleta'),
    ]
    ronda = models.ForeignKey(Ronda, on_delete=models.CASCADE, related_name='ejecuciones')
    vigilante = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ejecuciones')
    fecha_inicio = models.DateTimeField(default=timezone.now)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    completada = models.BooleanField(default=False)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='en_curso')

    class Meta:
        verbose_name = 'Ejecución de Ronda'
        verbose_name_plural = 'Ejecuciones de Rondas'
        ordering = ['-fecha_inicio']

    def __str__(self):
        return f'{self.ronda.nombre} - {self.vigilante.username} - {self.fecha_inicio.strftime("%d/%m/%Y %H:%M")}'

    def calcular_progreso(self):
        total = self.ronda.checkpoints.filter(activo=True).count()
        completados = self.scans.values('checkpoint').distinct().count()
        return {'total': total, 'completados': completados}


class CheckpointScan(models.Model):
    TIPO_CHOICES = [
        ('observacion', 'Observación'),
        ('incidencia', 'Incidencia'),
        ('alarma', 'Alarma'),
    ]
    ejecucion = models.ForeignKey(EjecucionRonda, on_delete=models.CASCADE, related_name='scans')
    checkpoint = models.ForeignKey(Checkpoint, on_delete=models.CASCADE, related_name='scans')
    timestamp = models.DateTimeField()
    timestamp_servidor = models.DateTimeField(auto_now_add=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='observacion')
    nota = models.TextField(blank=True)
    latitud = models.FloatField(null=True, blank=True)
    longitud = models.FloatField(null=True, blank=True)
    atendida = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Scan de Checkpoint'
        verbose_name_plural = 'Scans de Checkpoints'
        ordering = ['timestamp']

    def __str__(self):
        return f'{self.checkpoint.nombre} - {self.tipo} - {self.timestamp.strftime("%d/%m/%Y %H:%M")}'
