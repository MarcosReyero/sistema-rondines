from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('rondines', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProgramacionRonda',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dias_semana', models.JSONField(default=list, help_text='Lista de días: 0=Lun … 6=Dom')),
                ('hora_inicio', models.TimeField(help_text='Hora en que debe iniciarse la ronda')),
                ('duracion_minutos', models.PositiveIntegerField(default=60, help_text='Minutos para completarla')),
                ('activo', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('ronda', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                            related_name='programaciones', to='rondines.ronda')),
                ('vigilante', models.ForeignKey(blank=True, null=True,
                                                on_delete=django.db.models.deletion.SET_NULL,
                                                related_name='programaciones_asignadas',
                                                to=settings.AUTH_USER_MODEL)),
            ],
            options={'verbose_name': 'Programación de Ronda',
                     'verbose_name_plural': 'Programaciones de Rondas',
                     'ordering': ['hora_inicio']},
        ),
        migrations.AddField(
            model_name='ejecucionronda',
            name='programacion',
            field=models.ForeignKey(blank=True, null=True,
                                    on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='ejecuciones', to='rondines.programacionronda'),
        ),
        migrations.AddField(
            model_name='ejecucionronda',
            name='hora_limite',
            field=models.DateTimeField(blank=True, null=True,
                                       help_text='Vence si no se completa antes de aquí'),
        ),
        migrations.AddField(
            model_name='ejecucionronda',
            name='vencida',
            field=models.BooleanField(default=False,
                                      help_text='True si no se completó antes de hora_limite'),
        ),
    ]
