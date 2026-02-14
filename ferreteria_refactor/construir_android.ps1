Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  📱 ACTUALIZAR APP ANDROID (CAPACITOR)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if we are in root or frontend
if (Test-Path "frontend_web") {
    Set-Location "frontend_web"
} elseif (!(Test-Path "package.json")) {
    Write-Error "❌ Error: Ejecuta este script desde la raiz del proyecto 'ferreteria_refactor'."
    exit 1
}

Write-Host "`n🏗️  Compilando proyecto React..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Error al compilar React."
    exit $LASTEXITCODE
}

Write-Host "`n🔄 Sincronizando Capacitor..." -ForegroundColor Yellow
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Error al sincronizar Capacitor."
    exit $LASTEXITCODE
}

Write-Host "`n✅ ¡LISTO!" -ForegroundColor Green
Write-Host "👉 Abre Android Studio y dale al botón PLAY (▶️)." -ForegroundColor Green
Set-Location ".." # Return to root
Start-Sleep -Seconds 5
