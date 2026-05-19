from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from pathlib import Path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('rondines.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# En producción, servir el frontend React para cualquier ruta no API
frontend_index = Path(settings.BASE_DIR) / 'frontend_dist' / 'index.html'
if frontend_index.exists():
    urlpatterns += [
        re_path(r'^(?!api/|admin/|media/|static/).*$',
                TemplateView.as_view(template_name='index.html'),
                name='frontend'),
    ]
