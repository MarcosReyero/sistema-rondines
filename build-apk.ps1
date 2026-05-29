$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "==> Compilando frontend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
npm run build:cap
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR en build:cap" -ForegroundColor Red; exit 1 }

Write-Host "==> Generando APK..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend\android"
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR en Gradle" -ForegroundColor Red; exit 1 }

$apk = "$PSScriptRoot\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host ""
Write-Host "APK listo en:" -ForegroundColor Green
Write-Host $apk -ForegroundColor White
