# Scripts del proyecto

## build-apk.ps1

**Uso:** `.\build-apk.ps1`

Build local del APK sin publicar. Útil para probar cambios antes de hacer un release oficial.

**Qué hace:**
1. Compila el frontend React con `npm run build:cap` (genera el bundle y lo sincroniza al proyecto Android)
2. Corre Gradle para generar el APK de debug
3. Muestra la ruta del APK generado

**Output:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

**Cuándo usarlo:** Cuando querés probar un cambio en el celular sin publicar una versión nueva.

---

## build-release.ps1

**Uso:** `.\build-release.ps1`  
**Con versión manual:** `.\build-release.ps1 -Version "2.0.0"`

Release completo y automático. Publica una nueva versión del APK y notifica a los guards automáticamente.

**Qué hace:**
1. Incrementa automáticamente la versión patch en `frontend/package.json` (ej: 1.0.3 → 1.0.4)
2. Compila el frontend React con `npm run build:cap`
3. Genera el APK con Gradle
4. Crea un GitHub Release con el APK como adjunto en `MarcosReyero/sistema-rondines`
5. Actualiza las variables `APP_VERSION` y `APK_DOWNLOAD_URL` en Railway
6. Railway redespliega automáticamente → el endpoint `/api/version/` devuelve la nueva versión

**Resultado para los guards:** La próxima vez que abran la app con internet, ven un banner verde "Nueva versión disponible" con un botón para descargar e instalar el APK nuevo.

**Requisitos previos (solo la primera vez):**
- Autenticarse en GitHub CLI: `gh auth login`
- Si `gh` no se reconoce en la terminal: `$env:PATH += ";C:\Program Files\GitHub CLI\"` (hasta reiniciar Windows)

**Cuándo usarlo:** Cada vez que tenés cambios listos para distribuir a los guards.

---

## Flujo típico de desarrollo

```
Hacer cambios en el código
        ↓
.\build-apk.ps1        ← probar en el celular
        ↓
(ajustes si hace falta)
        ↓
.\build-release.ps1    ← publicar a todos los guards
```
