from django.contrib import admin
from .models import (
    Perfil, Instalacion, Checkpoint, Ronda,
    RondaCheckpointOrden, EjecucionRonda, CheckpointScan
)


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ['user', 'rol', 'activo']
    list_filter = ['rol', 'activo']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']


@admin.register(Instalacion)
class InstalacionAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'fecha_creacion', 'activo']
    list_filter = ['activo']
    search_fields = ['nombre']


class CheckpointInline(admin.TabularInline):
    model = Checkpoint
    extra = 0
    fields = ['nombre', 'pos_x', 'pos_y', 'activo']
    readonly_fields = ['codigo_qr']


@admin.register(Checkpoint)
class CheckpointAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'instalacion', 'codigo_qr', 'activo']
    list_filter = ['activo', 'instalacion']
    search_fields = ['nombre', 'instalacion__nombre']
    readonly_fields = ['codigo_qr']


class RondaCheckpointOrdenInline(admin.TabularInline):
    model = RondaCheckpointOrden
    extra = 0
    ordering = ['orden']


@admin.register(Ronda)
class RondaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'instalacion', 'activo', 'fecha_creacion']
    list_filter = ['activo', 'instalacion']
    search_fields = ['nombre']
    inlines = [RondaCheckpointOrdenInline]


class CheckpointScanInline(admin.TabularInline):
    model = CheckpointScan
    extra = 0
    readonly_fields = ['timestamp', 'timestamp_servidor', 'tipo', 'nota']
    fields = ['checkpoint', 'tipo', 'nota', 'timestamp', 'atendida']


@admin.register(EjecucionRonda)
class EjecucionRondaAdmin(admin.ModelAdmin):
    list_display = ['ronda', 'vigilante', 'fecha_inicio', 'estado', 'completada']
    list_filter = ['estado', 'completada']
    search_fields = ['ronda__nombre', 'vigilante__username']
    inlines = [CheckpointScanInline]


@admin.register(CheckpointScan)
class CheckpointScanAdmin(admin.ModelAdmin):
    list_display = ['checkpoint', 'ejecucion', 'tipo', 'timestamp', 'atendida']
    list_filter = ['tipo', 'atendida']
    search_fields = ['checkpoint__nombre']
