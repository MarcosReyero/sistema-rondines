param(
    [string]$Version = ""   # opcional: pasar version manual ej. .\build-release.ps1 -Version "1.2.0"
)

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;" + [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

$ROOT     = $PSScriptRoot
$FRONTEND = "$ROOT\frontend"
$ANDROID  = "$FRONTEND\android"
$APK_PATH = "$ANDROID\app\build\outputs\apk\debug\app-debug.apk"
$REPO     = "MarcosReyero/sistema-rondines"

# ── 1. Calcular nueva versión ───────────────────────────────────────────────
$pkgContent = Get-Content "$FRONTEND\package.json" -Raw
$current = ([regex]'"version":\s*"([^"]+)"').Match($pkgContent).Groups[1].Value

if ($Version -eq "") {
    $parts = $current.Split('.')
    $parts[2] = [int]$parts[2] + 1
    $Version = $parts -join '.'
}

Write-Host ""
Write-Host "╔══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Rondines Release Builder        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "  $current  →  $Version" -ForegroundColor White
Write-Host ""

# ── 2. Actualizar version en package.json ───────────────────────────────────
$pkgContent = $pkgContent -replace '"version":\s*"[^"]+"', '"version": "' + $Version + '"'
[System.IO.File]::WriteAllText("$FRONTEND\package.json", $pkgContent)
Write-Host "[1/5] Version actualizada en package.json" -ForegroundColor Green

# ── 3. Build frontend + sync Android ───────────────────────────────────────
Write-Host "[2/5] Compilando frontend..." -ForegroundColor Yellow
Set-Location $FRONTEND
npm run build:cap --silent
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR en build:cap" -ForegroundColor Red; exit 1 }
Write-Host "[2/5] Frontend OK" -ForegroundColor Green

# ── 4. Build APK ───────────────────────────────────────────────────────────
Write-Host "[3/5] Generando APK..." -ForegroundColor Yellow
Set-Location $ANDROID
.\gradlew.bat assembleDebug --quiet
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR en Gradle" -ForegroundColor Red; exit 1 }
Write-Host "[3/5] APK OK" -ForegroundColor Green

# ── 5. GitHub Release ───────────────────────────────────────────────────────
Write-Host "[4/5] Publicando GitHub Release..." -ForegroundColor Yellow
Set-Location $ROOT
$TAG = "v$Version"
gh release create $TAG $APK_PATH `
    --title "Rondines $TAG" `
    --notes "Release automatico $TAG" `
    --repo $REPO 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR en gh release (¿corriste 'gh auth login'?)" -ForegroundColor Red; exit 1 }
$DOWNLOAD_URL = "https://github.com/$REPO/releases/download/$TAG/app-debug.apk"
Write-Host "[4/5] Release publicado en GitHub" -ForegroundColor Green

# ── 6. Actualizar variables en Railway ─────────────────────────────────────
Write-Host "[5/5] Actualizando Railway..." -ForegroundColor Yellow
Set-Location $ROOT
railway variable set "APP_VERSION=$Version" "APK_DOWNLOAD_URL=$DOWNLOAD_URL"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR actualizando Railway" -ForegroundColor Red; exit 1 }
Write-Host "[5/5] Railway actualizado (redeploy en curso)" -ForegroundColor Green

# ── Listo ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Release $TAG publicado exitosamente!" -ForegroundColor Green
Write-Host "APK: $DOWNLOAD_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "Los guards verán el banner de actualizacion la proxima vez que abran la app con internet." -ForegroundColor White
