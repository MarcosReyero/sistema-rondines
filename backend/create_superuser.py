import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rondines.models import Perfil

User = get_user_model()

username = os.environ.get('DJANGO_SUPERUSER_USERNAME')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', '')

if username and password:
    if not User.objects.filter(username=username).exists():
        user = User.objects.create_superuser(username=username, password=password, email=email)
        Perfil.objects.get_or_create(user=user, defaults={'rol': 'supervisor'})
        print(f'Superusuario {username} creado con rol supervisor.')
    else:
        user = User.objects.get(username=username)
        Perfil.objects.get_or_create(user=user, defaults={'rol': 'supervisor'})
        print(f'Superusuario {username} ya existe — perfil verificado.')
