# Idea: Actualizador de APK (Opción A — Notificador + descarga manual)

## Concepto

Al abrir el APK, la app consulta un endpoint del backend con la versión actual disponible.
Si la versión instalada es más vieja, muestra un banner invitando al usuario a descargar la nueva versión.
El usuario toca el link, descarga el `.apk` desde Railway, y Android lo instala solo.

Sin librerías extra. Sin complejidad. Funciona en cualquier Android.

---

## Backend (Django)

### 1. Agregar versión a settings.py

```python
APP_VERSION = "1.0.0"
```

### 2. Endpoint público (sin auth)

```python
# rondines/views.py
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([AllowAny])
def app_version(request):
    return Response({
        "version": settings.APP_VERSION,
        "download_url": f"{settings.FRONTEND_URL}/descargas/rondines.apk",
        "obligatoria": False,  # True para forzar actualización
    })
```

```python
# config/urls.py — agregar:
path('api/version/', views.app_version),
```

### 3. Servir el APK desde Django

Subir el `.apk` a `backend/media/descargas/rondines.apk` y configurar MEDIA_ROOT para servirlo.
O simplemente hostear el APK en cualquier URL pública (Google Drive con link directo, etc.).

---

## Frontend (React + Capacitor)

### 1. Versión en el APK

En `package.json` del frontend, usar el campo `version` como fuente de verdad:
```json
{ "version": "1.0.0" }
```

Leer en el código:
```js
const VERSION_INSTALADA = import.meta.env.VITE_APP_VERSION  // definido en vite.config.js
```

En `vite.config.js`:
```js
import pkg from './package.json'
// dentro de defineConfig:
define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version) }
```

### 2. Hook de verificación

```js
// src/hooks/useAppUpdate.js
import { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || '/api'

export function useAppUpdate() {
  const [updateDisponible, setUpdateDisponible] = useState(null)

  useEffect(() => {
    axios.get(`${API}/version/`).then(({ data }) => {
      const actual = import.meta.env.VITE_APP_VERSION || '0.0.0'
      if (data.version !== actual) {
        setUpdateDisponible(data)
      }
    }).catch(() => {})
  }, [])

  return updateDisponible
}
```

### 3. Banner en MisRondas (vista principal del vigilante)

```jsx
import { useAppUpdate } from '../../hooks/useAppUpdate'

// dentro del componente:
const update = useAppUpdate()

// en el JSX, antes del contenido principal:
{update && (
  <div className="bg-accent/10 border border-accent/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
    <div>
      <p className="text-accent text-sm font-semibold">Nueva versión disponible</p>
      <p className="text-white/50 text-xs">v{update.version} — tocá para actualizar</p>
    </div>
    <a
      href={update.download_url}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 bg-accent text-dark-500 font-bold text-sm px-4 py-2 rounded-xl active:scale-95 transition-transform"
    >
      Actualizar
    </a>
  </div>
)}
```

---

## Flujo de actualización

1. Desarrollador sube el nuevo APK a la URL configurada
2. Actualiza `APP_VERSION` en `settings.py` y hace deploy a Railway
3. La próxima vez que el guard abre la app (con internet), ve el banner
4. Toca "Actualizar" → Android descarga e instala el nuevo APK
5. La app se reinicia con la versión nueva

## Para forzar actualización

Poner `"obligatoria": True` en el endpoint y en el frontend mostrar un modal bloqueante en vez de un banner dismissible.

---

## Notas

- El campo `version` de `package.json` del frontend y `APP_VERSION` en Django deben sincronizarse manualmente al hacer release.
- El APK puede hostearse en cualquier lugar: Railway media, Google Drive (link directo), Dropbox, servidor propio.
- Android 8+ puede bloquear instalaciones de fuentes desconocidas — el usuario tiene que habilitar "Instalar apps de fuentes desconocidas" la primera vez (solo una vez).
